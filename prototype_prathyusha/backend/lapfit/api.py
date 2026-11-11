"""FastAPI app (v1). Contracts: docs/API_CONTRACTS.md. Run: .venv/bin/uvicorn lapfit.api:app --app-dir backend --port 8000"""
from __future__ import annotations

import re
import time
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import json as _json
import threading

from . import __version__, advisor, analysis, claim_checker, compare as compare_mod, listing_check
from .llm import OllamaProvider
from .research import pipeline as research_pipeline
from .research.search import CreditGuard, make_provider, monthly_budget
from . import fit_engine as fe
from .config import settings
from .db import connect, migrate
from .retrieval import CATEGORY_QUERIES, Retriever

BRAND_WORDS = {"apple", "macbook", "asus", "vivobook", "zenbook", "rog", "tuf", "hp", "pavilion", "omen", "victus", "lenovo", "thinkpad", "ideapad", "legion",
               "loq", "yoga", "dell", "inspiron", "xps", "latitude", "alienware", "acer", "aspire", "nitro", "predator", "swift", "msi", "katana", "raider",
               "samsung", "galaxy", "microsoft", "surface", "razer", "gigabyte", "framework", "chromebook", "laptop", "notebook"}


class AppState:
    conn = None
    retriever: Retriever | None = None


state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    state.conn = connect()
    migrate(state.conn)
    yield
    state.conn.close()


app = FastAPI(title="LapFit API", version=__version__, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET", "POST"], allow_headers=["*"])


@app.middleware("http")
async def request_id_mw(request: Request, call_next):
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    request.state.rid = rid
    t0 = time.time()
    try:
        resp = await call_next(request)
    except Exception:
        return _err(500, "internal", "Unexpected error", rid)
    resp.headers["x-request-id"] = rid
    resp.headers["server-timing"] = f"app;dur={round((time.time() - t0) * 1000)}"
    return resp


def _err(status: int, code: str, message: str, rid: str, details: dict | None = None):
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, "request_id": rid, "details": details or {}}})


@app.exception_handler(HTTPException)
async def http_exc(request: Request, exc: HTTPException):
    code = {404: "not_found", 422: "validation_error", 503: "upstream_unavailable"}.get(exc.status_code, "error")
    return _err(exc.status_code, code, str(exc.detail), getattr(request.state, "rid", "-"))


@app.exception_handler(RequestValidationError)
async def val_exc(request: Request, exc: RequestValidationError):
    return _err(422, "validation_error", "Invalid request", getattr(request.state, "rid", "-"), {"errors": exc.errors()[:5]})


def meta(request: Request) -> dict:
    return {"request_id": request.state.rid, "data_version": settings.ingestion_version, "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")}


def retriever() -> Retriever:
    if state.retriever is None:
        state.retriever = Retriever(state.conn)
    return state.retriever


# ------------------------------------------------------------------ health
@app.get("/api/v1/health")
def health():
    return {"status": "ok", "version": __version__}


@app.get("/api/v1/ready")
def ready():
    out = {"db": False, "llm": False, "embeddings": False, "live_search_configured": make_provider() is not None}
    try:
        out["db"] = state.conn.execute("SELECT COUNT(*) FROM laptop_variants").fetchone()[0] > 0
        out["embeddings"] = state.conn.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0] > 0
    except Exception:
        pass
    try:
        out["llm"] = httpx.get(f"{settings.ollama_host}/api/tags", timeout=2).status_code == 200
    except Exception:
        pass
    return out


# ------------------------------------------------------------------ catalogue
def _owner_state(variant_id):
    return analysis.owner_status(state.conn, variant_id)["state"]


@app.get("/api/v1/laptops")
def laptops(request: Request):
    rows = state.conn.execute("SELECT * FROM laptop_variants WHERE catalogue_set!='well_evidenced' ORDER BY id").fetchall()
    items = []
    for v in rows:
        facts = {f["attribute"]: f["value_text"] for f in state.conn.execute(
            "SELECT attribute,value_text FROM spec_facts WHERE variant_id=? AND source_id='S-FLIPKART-LISTING'", (v["id"],))}
        nb = state.conn.execute("SELECT COUNT(*) FROM benchmarks WHERE variant_id=?", (v["id"],)).fetchone()[0]
        items.append({"id": v["id"], "display_name": v["display_name"], "catalogue_set": v["catalogue_set"], "review_count": v["review_count"],
                      "specs": facts, "lab_records": nb, "owner_analysis": _owner_state(v["id"]), "variant_confidence": "exact_listing"})
    return {"items": items, **meta(request)}


@app.get("/api/v1/laptops/{variant_id}")
def laptop(variant_id: str, request: Request):
    v = analysis.variant_row(state.conn, variant_id)
    if not v:
        raise HTTPException(404, f"Unknown laptop {variant_id}")
    facts = analysis._facts(state.conn, variant_id)
    src = {r["id"]: dict(r) for r in state.conn.execute("SELECT id,url,publisher,source_class,published_at,retrieved_at,permission FROM sources")}
    for f in facts:
        f["source"] = src.get(f["source_id"])
    bench = analysis._bench(state.conn, variant_id)
    for b in bench:
        b["source"] = src.get(b["source_id"])
    return {"variant": dict(v), "spec_facts": facts, "benchmarks": bench, "owner_analysis": analysis.owner_status(state.conn, variant_id), **meta(request)}


# ------------------------------------------------------------------ search
def _tokens(q: str):
    return [t for t in re.findall(r"[\w']+", q.lower()) if len(t) > 1]


GENERIC = {"gb", "tb", "ssd", "hdd", "ram", "inch", "inches", "laptop", "notebook", "with", "the", "and", "for", "i3", "i5", "i7", "i9", "core", "ryzen",
           "intel", "amd", "gen", "nvidia", "geforce", "graphics", "windows", "win", "home", "wifi", "new", "buy", "price", "best", "under", "review", "specs",
           "cpu", "gpu", "ddr4", "ddr5", "fhd", "hd", "ips", "oled", "touch", "thin", "light", "gaming", "series", "model"}


ACCESSORY = {"bag", "bags", "backpack", "sleeve", "case", "cover", "stand", "charger", "adapter", "adaptor", "mouse", "keyboard", "skin", "decal", "dock", "hub", "cable", "cooling", "pad", "table", "desk",
             "protector", "battery", "ram", "ssd", "screen", "cleaner", "light", "lock", "bracket", "riser"}


def is_accessory_query(tokens: list[str]) -> bool:
    """'laptop bag', 'laptop charger': accessory words and no model-like token (a word containing a digit)."""
    return bool(set(tokens) & ACCESSORY) and not any(any(ch.isdigit() for ch in t) for t in tokens) and not (set(tokens) & {"macbook", "ideapad", "vivobook", "pavilion", "thinkpad", "zenbook"})


def distinctive(tokens: list[str]) -> list[str]:
    """Identifier-like tokens only: drop generic spec words and bare small numbers/RAM-style sizes ('15', '16gb')."""
    out = []
    for t in dict.fromkeys(tokens):
        if t in GENERIC or re.fullmatch(r"\d{1,2}", t) or re.fullmatch(r"\d+\s?(gb|tb|inch|hz)", t):
            continue
        out.append(t)
    return out


@app.get("/api/v1/search")
def search(q: str, request: Request):
    q = (q or "").strip()
    if not q or len(q) > 300:
        raise HTTPException(422, "Query must be 1–300 characters")
    toks = _tokens(q)
    dist = distinctive(toks)
    matches = []
    if dist:
        for v in state.conn.execute("SELECT id, display_name, listing_title, aliases, catalogue_set, review_count FROM laptop_variants WHERE catalogue_set!='well_evidenced'").fetchall():
            hay = f"{v['listing_title']} {v['display_name']} {v['aliases']}".lower()
            n = sum(1 for t in dist if t in hay)
            if n:
                matches.append({"variant_id": v["id"], "display_name": v["display_name"], "catalogue_set": v["catalogue_set"], "review_count": v["review_count"],
                                "variant_confidence": "exact_listing", "matched_terms": n, "of_terms": len(dist), "ratio": n / len(dist)})
        best = max((m["ratio"] for m in matches), default=0)
        matches = sorted([m for m in matches if m["ratio"] >= max(0.5, best - 1e-9)], key=lambda m: (-m["ratio"], -m["review_count"]))[:6]
    laptopish = bool(set(toks) & BRAND_WORDS) or bool(re.search(r"\bryzen\b|\bi[3579]\b|\bcore\b|\brtx\b|\bgtx\b", q.lower()))
    resp = {"query": q, "matches": matches, "research_offer": None, "message": None, **meta(request)}
    if matches:
        resp["intent"] = "laptop"
        if len(matches) > 1 and matches[0]["ratio"] == matches[1]["ratio"]:
            resp["intent"] = "ambiguous"
            resp["message"] = "More than one listing matches. Pick the exact configuration."
    elif is_accessory_query(toks):
        resp["intent"] = "out_of_scope"
        resp["message"] = "LapFit checks laptops, not accessories. Try a laptop name (for example “IdeaPad 3 15ALC6”) or a claim about a laptop."
    elif laptopish and dist:
        resp["intent"] = "laptop"
        resp["message"] = "This laptop is not in LapFit's catalogue."
        on = make_provider() is not None
        resp["research_offer"] = {"available": on, "reason": "not in catalogue",
                                  "unavailable_reason": None if on else "Live research is not configured (no search key). Catalogue results only."}
    else:
        resp["intent"] = "out_of_scope"
        resp["message"] = "LapFit answers laptop questions. Try a model name (e.g. “IdeaPad 3 15ALC6”) or a claim about a laptop."
    return resp


# ------------------------------------------------------------------ fit analysis
class ProfileIn(BaseModel):
    workloads: dict[str, str] = Field(default_factory=dict)
    hard_requirements: dict[str, float] = Field(default_factory=dict)
    priorities: list[str] = Field(default_factory=list)
    weights: dict[str, float] | None = None


class FitIn(BaseModel):
    variant_id: str
    profile: ProfileIn


@app.post("/api/v1/fit-analysis")
def fit_analysis(body: FitIn, request: Request):
    bad = [w for w in body.profile.workloads if w not in fe.WORKLOAD_WEIGHTS]
    if bad:
        raise HTTPException(422, f"Unknown workload(s): {bad}. Allowed: {sorted(fe.WORKLOAD_WEIGHTS)}")
    badp = [p for p in body.profile.priorities if p not in fe.CATEGORIES]
    if badp:
        raise HTTPException(422, f"Unknown priority categories: {badp}")
    try:
        res = analysis.analyze(state.conn, body.variant_id, body.profile.model_dump())
    except KeyError:
        raise HTTPException(404, f"Unknown laptop {body.variant_id}")
    return {**res, **meta(request)}


# ------------------------------------------------------------------ live research
class ResearchIn(BaseModel):
    query: str = Field(min_length=3, max_length=200)
    force: bool = False


def _run_job(job_id: str, provider):
    conn = connect()
    try:
        research_pipeline.run_research(conn, job_id, provider, CreditGuard(conn, provider.name, monthly_budget()))
    except Exception as e:  # last-resort: never leave a job 'running'
        conn.execute("UPDATE research_jobs SET status='failed', error=?, finished_at=datetime('now') WHERE id=?", (f"Unexpected error: {type(e).__name__}", job_id))
        conn.commit()
    finally:
        conn.close()


@app.post("/api/v1/research")
def research_start(body: ResearchIn, request: Request):
    provider = make_provider()
    if provider is None:
        raise HTTPException(503, "Looking up new laptops online is not switched on (no search key is set), so only the laptops in the catalogue are available.")
    jid, reused = research_pipeline.create_job(state.conn, body.query, force=body.force)
    if not reused:
        threading.Thread(target=_run_job, args=(jid, provider), daemon=True).start()
    return {"job_id": jid, "reused": reused, **meta(request)}


@app.get("/api/v1/research/{job_id}")
def research_status(job_id: str, request: Request):
    j = state.conn.execute("SELECT * FROM research_jobs WHERE id=?", (job_id,)).fetchone()
    if not j:
        raise HTTPException(404, "Unknown lookup")
    links = [dict(r) for r in state.conn.execute("SELECT url,title,decision,tier,reason FROM research_links WHERE job_id=? ORDER BY id", (job_id,))]
    return {"job_id": j["id"], "query": j["query"], "status": j["status"], "variant_id": j["variant_id"], "steps": _json.loads(j["steps"] or "[]"),
            "counts": _json.loads(j["counts"]) if j["counts"] else None, "error": j["error"], "credits_used": j["credits_used"], "links": links, **meta(request)}


# ------------------------------------------------------------------ compare
class CompareIn(BaseModel):
    variant_ids: list[str] = Field(min_length=2, max_length=4)
    profile: ProfileIn


@app.post("/api/v1/compare")
def compare_laptops(body: CompareIn, request: Request):
    try:
        res = compare_mod.compare(state.conn, body.variant_ids, body.profile.model_dump())
    except KeyError as e:
        raise HTTPException(404, f"Unknown laptop {e.args[0]}")
    except ValueError as e:
        raise HTTPException(422, str(e))
    return {**res, **meta(request)}


# ------------------------------------------------------------------ claim checker
class ClaimIn(BaseModel):
    variant_id: str | None = None
    claim_text: str = Field(min_length=3, max_length=500)


class OverridesIn(BaseModel):
    uses: list[str] | None = None
    importance: dict[str, int] | None = None
    hard: dict[str, float | None] | None = None
    brands_avoid: list[str] | None = None
    needs_gpu: bool | None = None


class AdviceIn(BaseModel):
    text: str = Field(min_length=3, max_length=2000)
    overrides: OverridesIn | None = None


@app.post("/api/v1/advice")
def advice(body: AdviceIn, request: Request):
    ov = body.overrides.model_dump(exclude_none=False) if body.overrides else None
    return {**advisor.advise(state.conn, body.text, ov), **meta(request)}


@app.post("/api/v1/needs")
def needs(body: AdviceIn, request: Request):
    """The needs sheet: every category, how much it matters, the number to aim for. Same input as /advice, no laptops."""
    ov = body.overrides.model_dump(exclude_none=False) if body.overrides else None
    return {**advisor.needs_sheet(body.text, ov), **meta(request)}


class ListingIn(BaseModel):
    text: str = Field(min_length=3, max_length=6000)


_ollama_up = {"at": 0.0, "ok": False}


def _ollama_ready() -> bool:
    """Cheap check (cached 20 s) so a stopped model never makes the page wait for a timeout."""
    now = time.time()
    if now - _ollama_up["at"] > 20:
        try:
            _ollama_up["ok"] = httpx.get(settings.ollama_host.rstrip("/") + "/api/tags", timeout=1.5).status_code == 200
        except Exception:
            _ollama_up["ok"] = False
        _ollama_up["at"] = now
    return _ollama_up["ok"]


@app.post("/api/v1/listing-check")
def listing_check_ep(body: ListingIn, request: Request):
    provider = OllamaProvider(num_predict=500, timeout=60, retries=0) if _ollama_ready() else None
    res = listing_check.check_listing(state.conn, body.text, provider)
    if res.get("lookup"):
        res["lookup"]["available"] = make_provider() is not None
    return {**res, **meta(request)}


@app.post("/api/v1/claim-checks")
def claim_checks(body: ClaimIn, request: Request):
    if not body.variant_id:      # no laptop chosen: work out the scope (laptop, brand, model line or everything) from the words
        return {"id": uuid.uuid4().hex[:12], "persisted": False, **advisor.check_free_claim(state.conn, body.claim_text), **meta(request)}
    try:
        res = claim_checker.check_claim(state.conn, body.variant_id, body.claim_text)
    except KeyError:
        raise HTTPException(404, f"Unknown laptop {body.variant_id}")
    return {"id": uuid.uuid4().hex[:12], "persisted": False, **res, **meta(request)}


# ------------------------------------------------------------------ trust page data
def _load(name):
    f = settings.data_pack.parents[1] / "eval" / "results" / name if False else __import__("pathlib").Path(__file__).resolve().parents[2] / "eval" / "results" / name
    try:
        return _json.load(open(f))
    except Exception:
        return None


def _now_values() -> dict:
    v, sf, cl, ex, rt = (_load("var_eval_latest.json"), _load("safe_eval_latest.json"), _load("claim_eval_g_claim_v2_heldout.json"),
                         _load("ext_eval_g_ext_v1_heldout.json"), _load("ret_eval_latest.json"))
    out = {}
    if v: out["search"] = f"{v['summary']['overall']} questions right (tuned on these)"
    if sf: out["safety"] = f"Unsafe addresses blocked {sf['ssrf_correct']}; link rules {sf['url_policy_correct']}; altered quotes rejected {sf['quote_validator_correct']}"
    if cl: out["claims"] = f"{cl['summary']['overall_verdict_agreement']} on the same claims after fixes (tuned on these)"
    if ex: out["extraction"] = f"Same fresh set: topic precision {ex['category_precision']:.2f}, recall {ex['category_recall']:.2f}, opinion right {ex['polarity_accuracy_on_matched']} (not tuned on)"
    if rt: r = rt["results"]; out["retrieval"] = f"Keywords {r['lexical']['MAP']}, meaning-based {r['vector']['MAP']}, both {r['hybrid']['MAP']}"
    nd, tp = _load("needs_eval_g_needs_v1_heldout.json"), _load("topic_eval_topics-v3_g_ext_v3_heldout.json")
    if nd: out["needs"] = f"Same requests after fixes: uses {nd['uses_exact']} (tuned on these)"
    if tp: out["topics"] = f"Reader v3, fresh set: precision {tp['topic_precision']}, recall {tp['topic_recall']}, opinion right {tp['opinion_right_on_matched']}"
    l1, l2, l3 = _load("listing_eval_g_listing_v1.json"), _load("listing_eval_g_listing_v2_heldout.json"), _load("listing_eval_g_listing_v3_fresh.json")
    if l1 and l2 and l3:
        def vr(x): return x["results"]["rules"]
        out["listing"] = ("After fixes: " + ", ".join(f"{n} {vr(x)['verdict_ok']}/{vr(x)['claims']}" for n, x in (("set 1", l1), ("set 2", l2), ("set 3", l3))) + " verdicts right (each set was also used to fix bugs after its first run, so only the first-run figures are clean)")
    out["inj_screen"] = "Now catches known patterns; new wording still mostly slips past"
    return out


@app.get("/api/v1/trust")
def trust(request: Request):
    reg = _load_registry()
    now = _now_values()
    items = [{**i, "now": now.get(i["id"])} for i in reg["items"]]
    c = state.conn
    by_class = {r[0]: r[1] for r in c.execute("SELECT source_class, COUNT(*) FROM sources GROUP BY 1")}
    owner = {r[0]: r[1] for r in c.execute("SELECT r.variant_id, COUNT(*) FROM extraction_runs e JOIN reviews r ON r.id=e.review_id GROUP BY 1")}
    data = {"laptops_in_catalogue": c.execute("SELECT COUNT(*) FROM laptop_variants WHERE catalogue_set='flipkart14'").fetchone()[0],
            "us_laptops_as_evidence": c.execute("SELECT COUNT(*) FROM laptop_variants WHERE catalogue_set='well_evidenced'").fetchone()[0],
            "laptops_looked_up_online": c.execute("SELECT COUNT(*) FROM laptop_variants WHERE catalogue_set='live_researched'").fetchone()[0],
            "owner_reviews": c.execute("SELECT COUNT(*) FROM reviews").fetchone()[0],
            "laptops_with_owner_reviews_fully_read": sum(1 for v in ("FKL-01","FKL-02","FKL-03","FKL-04","FKL-05","FKL-06","FKL-07","FKL-08","FKL-09","FKL-10","FKL-11","FKL-12","FKL-13","FKL-14") if analysis.owner_status(c, v)["state"] == "complete"),
            "lab_or_maker_records": c.execute("SELECT COUNT(*) FROM benchmarks").fetchone()[0], "source_classes": by_class}
    return {"updated": reg["updated"], "note": reg["note"], "items": items, "data": data,
            "limits": ["Every test answer key was written by an AI (Claude) and has not been checked by a person.",
                       "Owner reviews come from a 2022-era Flipkart dataset: short, mostly 5-star, with no dates.",
                       "Topic ratings come from a quick pass over every review. The detailed problem list with exact quotes exists for only 3 of the 14 laptops.",
                       "Lab data exists for 3 of 14 catalogue laptops, and is often for a similar model, not the exact one.",
                       "Brand comparisons use 14 laptops sold in India and 15 sold in the US (Amazon, 2015 to 2023, extra evidence only, never recommended). A brand with few models is a small sample.",
                       "Looking up a new laptop online reads only a few maker pages and never includes owner reviews.",
                       "Hidden instructions in reviews can still add at most one fake claim; we limit the damage rather than catch every attempt."],
            **meta(request)}


def _load_registry():
    import pathlib
    return _json.load(open(pathlib.Path(__file__).resolve().parents[2] / "eval" / "trust_registry.json"))


# ------------------------------------------------------------------ evidence
@app.get("/api/v1/laptops/{variant_id}/ratings")
def ratings(variant_id: str, request: Request):
    if not state.conn.execute("SELECT 1 FROM laptop_variants WHERE id=?", (variant_id,)).fetchone():
        raise HTTPException(404, f"Unknown laptop {variant_id}")
    return {"variant_id": variant_id, "categories": advisor.laptop_ratings(state.conn, variant_id), **meta(request)}


@app.get("/api/v1/laptops/{variant_id}/opinions")
def opinions(variant_id: str, request: Request, topic: str, k: int = 5):
    """What owners said about one topic of one laptop: counts plus up to k exact sentences per opinion (each opens the full review)."""
    from .topic_reader import TOPICS, VERSION, votes_conn
    if topic not in TOPICS:
        raise HTTPException(422, f"Unknown topic {topic}. Allowed: {TOPICS}")
    if not state.conn.execute("SELECT 1 FROM laptop_variants WHERE id=?", (variant_id,)).fetchone():
        raise HTTPException(404, f"Unknown laptop {variant_id}")
    v = votes_conn()
    try:
        rows = v.execute("SELECT review_id, opinion, quote FROM topic_votes WHERE variant_id=? AND topic=? AND version=?", (variant_id, topic, VERSION)).fetchall()
    finally:
        v.close()
    out = {"positive": [], "negative": [], "mixed": []}
    from .advisor import THERMAL_SHOWN
    for r in sorted(rows, key=lambda r: -len(r["quote"] or "")):      # fuller sentences first
        if topic == "thermals_noise" and not THERMAL_SHOWN.search(r["quote"] or ""):
            continue                                                  # 'very cool laptop' is slang, not evidence about heat
        if len(out[r["opinion"]]) < k and (r["quote"] or "").strip():
            out[r["opinion"]].append({"review_id": r["review_id"], "quote": r["quote"]})
    return {"variant_id": variant_id, "topic": topic, "counts": {o: sum(1 for r in rows if r["opinion"] == o) for o in out}, "examples": out, **meta(request)}


@app.get("/api/v1/laptops/{variant_id}/reviews")
def review_search(variant_id: str, request: Request, q: str, k: int = 8, category: str | None = None):
    if not analysis.variant_row(state.conn, variant_id):
        raise HTTPException(404, f"Unknown laptop {variant_id}")
    query = CATEGORY_QUERIES.get(category or "", "") + " " + q if category else q
    hits = retriever().search(variant_id, query.strip(), k=min(max(k, 1), 20))
    return {"variant_id": variant_id, "query": q, "hits": [
        {"review_id": h.review_id, "text": h.text, "rating": h.rating, "duplicates": h.cluster_size, "flag": h.flag, "config_hint": h.config_hint,
         "ranks": h.ranks, "score": round(h.score, 4)} for h in hits], **meta(request)}


@app.get("/api/v1/evidence/review/{review_id}")
def evidence_review(review_id: str, request: Request):
    r = state.conn.execute("SELECT * FROM reviews WHERE id=?", (review_id,)).fetchone()
    if not r:
        raise HTTPException(404, f"Unknown review {review_id}")
    src = state.conn.execute("SELECT id,url,publisher,source_class,licence_status FROM sources WHERE id=?", (r["source_id"],)).fetchone()
    claims = [dict(c) for c in state.conn.execute("SELECT id,category,claim_text,polarity,strength,quote,quote_start,quote_end,validation_status FROM evidence_claims WHERE review_id=?", (review_id,))]
    for c in claims:
        c["quote_valid"] = r["original_text"][c["quote_start"]:c["quote_end"]] == c["quote"]
    dup = state.conn.execute("SELECT size FROM dup_clusters WHERE id=?", (r["dup_cluster_id"],)).fetchone() if r["dup_cluster_id"] else None
    return {"review": {k: r[k] for k in ("id", "variant_id", "rating", "title", "original_text", "word_count", "flag", "config_mismatch_hint")},
            "source": dict(src) if src else None, "claims": claims, "duplicates": dup["size"] if dup else 1, **meta(request)}


@app.get("/api/v1/methodology")
def methodology(request: Request):
    return {"categories": fe.CATEGORIES, "workload_weights": fe.WORKLOAD_WEIGHTS, "frequency_multipliers": fe.FREQ, "thresholds": fe.CONFIG,
            "rules": ["Hard requirements: met / not met / unknown / spec mismatch; unknown never passes.",
                      "Dealbreaker: >=2 independent clear applicable complaints on a priority; one is a watch-out.",
                      "Category rating needs >=3 independent applicable reports; Wilson lower bound of positive share.",
                      "A number is shown only at >=60% weighted evidence coverage. No overall rank.",
                      "Sibling-variant evidence is shown apart and never counted as this laptop's."],
            "versions": {"api": __version__, "fit_engine": fe.CONFIG["version"], "llm": settings.llm_model, "embed": settings.embed_model,
                         "extraction_prompt": settings.prompt_version}, **meta(request)}
