"""Live research pipeline: identify -> search -> permission gate -> fetch & extract -> build.

Every stored fact has a source row (URL, retrieval time, content hash), an exact quote, and a variant_match. Facts from a page that
is not clearly about the named laptop are rejected. Pages we may not fetch are kept as links only."""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import time
import uuid

from ..text_utils import injection_flag, locate_quote
from . import policy
from .extract import extract_facts
from .fetcher import Fetcher, Page
from .search import BudgetExceeded, CreditGuard, SearchProvider, UpstreamError

GENERIC = {"gb", "tb", "ssd", "hdd", "ram", "inch", "laptop", "notebook", "with", "the", "and", "for", "i3", "i5", "i7", "i9", "core", "ryzen", "intel", "amd", "gen",
           "specs", "specifications", "review", "buy", "price", "new", "tech", "support"}
BRAND_DOMAINS = {"apple": ["apple.com"], "macbook": ["apple.com"], "asus": ["asus.com"], "vivobook": ["asus.com"], "zenbook": ["asus.com"], "tuf": ["asus.com"], "rog": ["asus.com"],
                 "hp": ["hp.com"], "pavilion": ["hp.com"], "omen": ["hp.com"], "victus": ["hp.com"], "dell": ["dell.com"], "inspiron": ["dell.com"], "xps": ["dell.com"],
                 "latitude": ["dell.com"], "alienware": ["dell.com"]}


def query_key(q: str) -> str:
    return " ".join(sorted(re.findall(r"[a-z0-9]+", q.lower())))


def distinctive(q: str) -> list[str]:
    out = []
    for t in dict.fromkeys(re.findall(r"[a-z0-9]+", q.lower())):
        if t in GENERIC or re.fullmatch(r"\d{1,2}", t) or re.fullmatch(r"\d+(gb|tb)", t):
            continue
        out.append(t)
    return out


def match_level(tokens: list[str], title: str, url: str, text: str) -> str:
    """How clearly is this page about the named laptop?
    exact_family: every distinctive word is present AND every model-code word (anything with a digit: m2, ux3405, 2022) is in the page title or URL.
    family_only: at least half the words are present (the page may cover a different generation or a whole range)."""
    ident = f"{title} {url}".lower()
    head = f"{ident} {text[:600].lower()}"
    codes = [t for t in tokens if any(ch.isdigit() for ch in t)]
    if tokens and all(t in head for t in tokens) and all(t in ident for t in codes):
        return "exact_family"
    if tokens and sum(1 for t in tokens if t in head) * 2 >= len(tokens):
        return "family_only"
    return "unknown"


SPEC_PAGE = re.compile(r"tech[- ]?specs?|specifications?|/specs\b|support\.apple\.com/en-[\w-]+/\d{5,}|/techspec", re.I)


def is_spec_page(title: str, url: str) -> bool:
    if SPEC_PAGE.search(f"{title} {url}"):
        return True
    d = policy.classify(url)
    return d.tier == "A-lab" and d.action == "fetch"        # Notebookcheck database page (review/news URLs are never fetched)


class Job:
    def __init__(self, conn, job_id):
        self.conn, self.id, self.steps = conn, job_id, []

    def step(self, name: str, status: str, detail: str = "", **counts):
        for s in self.steps:
            if s["name"] == name:
                s.update(status=status, detail=detail, **counts)
                break
        else:
            self.steps.append({"name": name, "status": status, "detail": detail, **counts})
        self.conn.execute("UPDATE research_jobs SET steps=?, status='running' WHERE id=?", (json.dumps(self.steps), self.id))
        self.conn.commit()


def create_job(conn, query: str, force: bool = False) -> tuple[str, bool]:
    """Returns (job_id, reused). Same normalised query within 24 h reuses the finished job (saves credits)."""
    key = query_key(query)
    if not force:
        r = conn.execute("SELECT id FROM research_jobs WHERE query_key=? AND status IN ('done','running','queued') AND created_at > datetime('now','-1 day') ORDER BY created_at DESC LIMIT 1", (key,)).fetchone()
        if r:
            return r[0], True
    jid = uuid.uuid4().hex[:12]
    conn.execute("INSERT INTO research_jobs(id,query,query_key,status) VALUES (?,?,?, 'queued')", (jid, query.strip(), key))
    conn.commit()
    return jid, False


def run_research(conn: sqlite3.Connection, job_id: str, provider: SearchProvider, guard: CreditGuard, fetcher: Fetcher | None = None, max_fetch: int = 4) -> dict:
    fetcher = fetcher or Fetcher()
    row = conn.execute("SELECT query FROM research_jobs WHERE id=?", (job_id,)).fetchone()
    query = row[0]
    job = Job(conn, job_id)
    counts = {"fetched": 0, "link_only": 0, "rejected": 0, "failed": 0, "facts": 0}
    credits = 0
    try:
        # 1 identify
        toks = distinctive(query)
        if not toks:
            raise ValueError("Please give a laptop name or model (for example “ASUS Zenbook 14 UX3405”).")
        job.step("identify", "done", f"Looking for: {' '.join(toks)}")
        doms = sorted({d for t in toks for d in BRAND_DOMAINS.get(t, [])})
        # 2 search (official pages first; then a broad search for links only)
        job.step("search", "running", "Searching official pages and the wider web")
        hits, seen = [], set()
        plan = []
        if doms:
            plan.append((f"{query} specifications", doms))
        plan.append((f"{query} specifications", ["notebookcheck.net"]))         # independent spec database (D-033): spec pages only
        plan.append((f"{query} review battery life", None))                    # broad: links only
        for q, inc in plan:
            guard.charge(provider.credits_per_search)
            credits += provider.credits_per_search
            for h in provider.search(q, include_domains=inc):
                if h.url not in seen:
                    seen.add(h.url)
                    hits.append(h)
        job.step("search", "done", f"{len(hits)} pages found", credits=credits)
        # 3 permission gate + 4 fetch & extract
        job.step("permission", "running", "Checking which pages we may read")
        stored: list[dict] = []
        n_fetch = 0          # successful reads (capped by max_fetch)
        n_tries = 0          # network attempts (capped at 3x), so a run of policy blocks cannot burn the reading budget
        for h in hits:
            d = policy.classify(h.url)
            decision, reason = ("link_only", d.reason) if d.action != "fetch" else ("fetched", "")
            if d.action == "fetch" and (n_fetch >= max_fetch or n_tries >= max_fetch * 3):
                decision, reason = "link_only", "reading limit reached for this lookup"
            if decision == "fetched":
                page, via = None, None
                before = getattr(fetcher, "attempts", 0)
                try:
                    page = fetcher.fetch(h.url)
                except Exception as e:  # PolicyError or network error: never kills the job
                    msg = str(e) if isinstance(e, policy.PolicyError) else type(e).__name__
                    # Fallback ONLY for transient refusals (429 rate limit, 5xx, timeouts): the search provider's licensed copy of an allowlisted page.
                    # Never for robots.txt disallow, 403, policy blocks or redirects off the allowlist (we do not route around a refusal).
                    n_tries += getattr(fetcher, "attempts", 0) - before
                    transient = bool(re.search(r"HTTP (429|5\d\d)\b|Timeout|ConnectError", msg)) and "robots" not in msg
                    if transient and h.raw_content:
                        txt = h.raw_content
                        page = Page(h.url, h.title, txt, hashlib.sha256(txt.encode("utf-8")).hexdigest()[:16], len(txt))
                        via = "text supplied by the search service because the site rate-limited us"
                    else:
                        decision, reason = ("blocked" if isinstance(e, policy.PolicyError) else "failed"), msg
                        counts["failed"] += 1
                if page is not None:
                    if via is None:
                        n_tries += getattr(fetcher, "attempts", 0) - before
                    level = match_level(toks, page.title, page.url, page.text)
                    if level == "exact_family" and not is_spec_page(page.title, page.url):
                        level = "family_only"          # news/marketing pages are noisy: never feed the must-have checks
                    if level == "unknown":
                        decision, reason = "rejected", "page is not clearly about this laptop"
                        counts["rejected"] += 1
                    elif injection_flag(page.text[:5000]):
                        decision, reason = "rejected", "page contains instruction-like text; not used"
                        counts["rejected"] += 1
                    else:
                        facts = [f for f in extract_facts(page.text) if locate_quote(page.text, f.quote)]
                        if not facts:
                            decision, reason = "rejected", "no usable specifications found on the page"
                            counts["rejected"] += 1
                        else:
                            stored.append({"page": page, "facts": facts, "level": level, "via": via})
                            counts["fetched"] += 1
                            n_fetch += 1
                            if via:
                                reason = via
            if decision == "link_only":
                counts["link_only"] += 1
            conn.execute("INSERT INTO research_links(job_id,url,title,decision,tier,reason,snippet) VALUES (?,?,?,?,?,?,?)", (job_id, h.url, h.title, decision, d.tier, reason, h.snippet))
        conn.commit()
        job.step("permission", "done", f"{counts['fetched']} read, {counts['link_only']} link only, {counts['rejected'] + counts['failed']} not used")
        # 5 build
        variant_id = None
        if stored:
            variant_id = _build(conn, job_id, query, stored)
            counts["facts"] = conn.execute("SELECT COUNT(*) FROM spec_facts WHERE variant_id=?", (variant_id,)).fetchone()[0]
            job.step("build", "done", f"{counts['facts']} facts stored with their sources")
        else:
            job.step("build", "done", "No official details could be read. Links are listed instead.")
        conn.execute("UPDATE research_jobs SET status='done', variant_id=?, counts=?, credits_used=?, finished_at=datetime('now') WHERE id=?", (variant_id, json.dumps(counts), credits, job_id))
        conn.commit()
        return {"job_id": job_id, "variant_id": variant_id, **counts, "credits_used": credits}
    except (BudgetExceeded, UpstreamError, ValueError) as e:
        conn.execute("UPDATE research_jobs SET status='failed', error=?, credits_used=?, finished_at=datetime('now') WHERE id=?", (str(e), credits, job_id))
        conn.commit()
        return {"job_id": job_id, "error": str(e), "credits_used": credits}


def _build(conn, job_id: str, query: str, stored: list[dict]) -> str:
    name = re.sub(r"\s+", " ", query).strip()
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40]
    vid = f"LIVE-{slug}"
    brand = (name.split() or ["?"])[0].upper()
    conn.execute("INSERT OR IGNORE INTO laptop_models(brand, marketing_name) VALUES (?,?)", (brand, name))
    mid = conn.execute("SELECT id FROM laptop_models WHERE brand=? AND marketing_name=?", (brand, name)).fetchone()[0]
    title = stored[0]["page"].title or name
    conn.execute("INSERT OR REPLACE INTO laptop_variants(id,model_id,listing_title,display_name,catalogue_set,aliases,review_count) VALUES (?,?,?,?,?,?,0)",
                 (vid, mid, title, f"{name} (looked up online)", "live_researched", "[]"))
    conn.execute("DELETE FROM fts_variants WHERE variant_id=?", (vid,))
    conn.execute("INSERT INTO fts_variants(text, variant_id) VALUES (?,?)", (f"{name} {title}", vid))
    for s in stored:
        p = s["page"]
        sid = "S-LIVE-" + hashlib.sha1(p.url.encode()).hexdigest()[:8]
        conn.execute("""INSERT OR REPLACE INTO sources(id,url,publisher,source_name,source_class,published_at,retrieved_at,licence_status,permission,attribution_text,content_hash,recheck_after,exact_variant_note,notes)
            VALUES (?,?,?,?,?,NULL,?,?,?,?,?,?,?,?)""", (sid, p.url, policy.urlsplit(p.url).hostname, p.title, ("spec_database" if policy.classify(p.url).tier == "A-lab" else "manufacturer_spec"), time.strftime("%Y-%m-%d"), "public page; short facts + link only",
                                                         "stored_facts_only", ("Source: Notebookcheck.net - " if policy.classify(p.url).tier == "A-lab" else "") + (p.title or p.url), p.content_hash, time.strftime("%Y-%m-%d", time.gmtime(time.time() + 30 * 86400)), name,
                                                         f"live research job {job_id}" + (f"; {s['via']}" if s.get("via") else "")))
        for f in s["facts"]:
            conn.execute("""INSERT OR REPLACE INTO spec_facts(variant_id,attribute,value_text,value_num,unit,source_id,quote,variant_match,validation_status,retrieved_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)""", (vid, f.attribute, f.value_text, f.value_num, f.unit, sid, f.quote, s["level"], "machine_validated", time.strftime("%Y-%m-%d")))
    conn.commit()
    return vid
