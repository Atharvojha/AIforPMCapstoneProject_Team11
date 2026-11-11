"""Search providers behind one interface. Tavily is the real provider (D-019). FakeSearch exists only for development/tests."""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Protocol

import httpx

from ..config import settings


@dataclass
class SearchHit:
    url: str
    title: str
    snippet: str
    score: float = 0.0
    raw_content: str | None = None      # page text supplied by the search provider (used only when our own fetch is rate-limited)


class SearchProvider(Protocol):
    name: str
    credits_per_search: int

    def search(self, query: str, include_domains: list[str] | None = None, max_results: int = 6) -> list[SearchHit]: ...


class BudgetExceeded(Exception):
    pass


class UpstreamError(Exception):
    pass


class TavilySearch:
    name = "tavily"
    credits_per_search = 1       # basic depth = 1 credit (verified 2026-11-10 in Tavily docs)

    def __init__(self, api_key: str, client: httpx.Client | None = None):
        self.key, self.client = api_key, client or httpx.Client(timeout=20)

    def search(self, query, include_domains=None, max_results=6):
        # raw content only for the official-domain query: it is the fallback source when an official page rate-limits our own fetch
        body = {"query": query, "search_depth": "basic", "max_results": max_results, "include_answer": False, "include_raw_content": "text" if include_domains else False}
        if include_domains:
            body["include_domains"] = include_domains
        try:
            r = self.client.post("https://api.tavily.com/search", json=body, headers={"Authorization": f"Bearer {self.key}"})
        except Exception as e:
            raise UpstreamError(f"search service unreachable ({type(e).__name__})")
        if r.status_code == 401:
            raise UpstreamError("the search key was rejected (check TAVILY_API_KEY)")
        if r.status_code == 429:
            raise UpstreamError("the search service is rate limiting us; try again shortly")
        if r.status_code != 200:
            raise UpstreamError(f"search service returned HTTP {r.status_code}")
        return [SearchHit(x.get("url", ""), x.get("title", ""), x.get("content", "")[:300], float(x.get("score") or 0), (x.get("raw_content") or None) and x["raw_content"][:80000]) for x in r.json().get("results", []) if x.get("url")]


class FakeSearch:
    """DEV/TEST ONLY (enabled by LAPFIT_DEV_FAKE_SEARCH=1). Returns a fixed list of real URLs; never presented as live web search."""
    name = "fake"
    credits_per_search = 0

    def __init__(self, hits: list[SearchHit] | None = None):
        self.hits = hits or []

    def search(self, query, include_domains=None, max_results=6):
        return self.hits[:max_results]


class CreditGuard:
    """Hard monthly cap below the provider's free allowance."""

    def __init__(self, conn, provider: str, budget: int):
        self.conn, self.provider, self.budget = conn, provider, budget

    def _month(self):
        return time.strftime("%Y-%m")

    def used(self) -> int:
        r = self.conn.execute("SELECT used FROM search_credits WHERE month=? AND provider=?", (self._month(), self.provider)).fetchone()
        return r[0] if r else 0

    def charge(self, n: int):
        if n and self.used() + n > self.budget:
            raise BudgetExceeded(f"Monthly search budget reached ({self.used()} of {self.budget} credits). Live research resumes next month.")
        if n:
            self.conn.execute("INSERT INTO search_credits(month,provider,used,budget) VALUES (?,?,?,?) ON CONFLICT(month,provider) DO UPDATE SET used=used+?, budget=?",
                              (self._month(), self.provider, n, self.budget, n, self.budget))
            self.conn.commit()


def make_provider() -> SearchProvider | None:
    if os.environ.get("LAPFIT_DEV_FAKE_SEARCH") == "1":      # development only: fixed URLs, real fetching and extraction
        urls = [u for u in os.environ.get("LAPFIT_DEV_FAKE_URLS", "").split(",") if u.strip()]
        return FakeSearch([SearchHit(u.strip(), "", "dev stub result") for u in urls])
    key = settings.tavily_key
    if key and not key.endswith("REPLACE_ME"):
        return TavilySearch(key)
    return None


def monthly_budget() -> int:
    try:
        return int(os.environ.get("TAVILY_MONTHLY_BUDGET", "800"))
    except ValueError:
        return 800
