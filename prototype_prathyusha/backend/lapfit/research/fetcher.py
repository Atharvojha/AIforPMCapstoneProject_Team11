"""Guarded page fetch: https only, allowlisted fetch-tier hosts, public IPs only, manual redirects (each hop re-checked),
size and time limits, content-type check. Fetched text is untrusted data."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

import httpx

from .policy import USER_AGENT, PolicyError, RobotsCache, Throttle, assert_public_host, classify

MAX_BYTES = 2_000_000
OK_TYPES = ("text/html", "text/plain", "application/xhtml+xml")


@dataclass
class Page:
    url: str
    title: str
    text: str
    content_hash: str
    bytes: int


class Fetcher:
    def __init__(self, client: httpx.Client | None = None, robots: RobotsCache | None = None, throttle: Throttle | None = None, resolve_check=assert_public_host):
        self.client = client or httpx.Client(follow_redirects=False, timeout=15, headers={"User-Agent": USER_AGENT})
        self.robots, self.throttle, self.resolve_check = robots or RobotsCache(), throttle or Throttle(), resolve_check
        self.attempts = 0      # real network requests made (policy blocks never reach the network)

    def _guard(self, url: str):
        d = classify(url)
        if d.action != "fetch":
            raise PolicyError(d.reason)
        host = urlsplit(url).hostname or ""
        self.resolve_check(host)
        ok, why = self.robots.allowed(url)
        if not ok:
            raise PolicyError(why)

    def fetch(self, url: str) -> Page:
        cur = url
        for hop in range(4):
            self._guard(cur)
            self.throttle.wait(urlsplit(cur).hostname or "")
            self.attempts += 1
            with self.client.stream("GET", cur) as r:
                if 300 <= r.status_code < 400 and r.headers.get("location"):
                    if hop == 3:
                        raise PolicyError("too many redirects")
                    cur = urljoin(cur, r.headers["location"])
                    continue
                if r.status_code != 200:
                    raise PolicyError(f"page returned HTTP {r.status_code}")
                ctype = r.headers.get("content-type", "").split(";")[0].strip().lower()
                if ctype not in OK_TYPES:
                    raise PolicyError(f"unsupported content type {ctype or 'unknown'}")
                buf = bytearray()
                for chunk in r.iter_bytes():
                    buf += chunk
                    if len(buf) > MAX_BYTES:
                        raise PolicyError("page is larger than 2 MB")
                html = bytes(buf).decode(r.encoding or "utf-8", errors="replace")
                break
        else:
            raise PolicyError("too many redirects")
        import trafilatura
        text = trafilatura.extract(html, include_tables=True, include_comments=False, favor_recall=True) or ""
        meta = trafilatura.extract_metadata(html)
        import html as _html, re as _re
        m = _re.search(r"<title[^>]*>(.*?)</title>", html, _re.I | _re.S)
        title = _html.unescape(_re.sub(r"\s+", " ", m.group(1))).strip() if m else (getattr(meta, "title", None) or "").strip()
        if not text.strip():
            raise PolicyError("no readable text found on the page")
        return Page(cur, title, text, hashlib.sha256(text.encode("utf-8")).hexdigest()[:16], len(buf))
