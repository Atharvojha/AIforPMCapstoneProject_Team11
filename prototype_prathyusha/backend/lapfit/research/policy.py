"""Source policy (docs/SOURCE_POLICY.md): domain tiers, SSRF guard, robots.txt. Robots permission is necessary, not sufficient."""
from __future__ import annotations

import ipaddress
import re
import socket
import time
from dataclasses import dataclass
from urllib import robotparser
from urllib.parse import urlsplit

USER_AGENT = "LapFitResearchBot/0.1 (student project, IIIT Hyderabad; not for resale)"
TIER_A = ("apple.com", "asus.com", "hp.com", "dell.com")                  # fetch + extract short facts
TIER_B = ("rtings.com", "laptopmedia.com")                               # link only: terms unreadable/blocked (see SOURCE_POLICY)
SPEC_ONLY = ("notebookcheck.net",)                                        # D-033: spec/database pages only; short quotes with link + name; never review text
REVIEWISH = re.compile(r"review|news|\bversus\b|\bvs\b|comparison|best-|top-|-test\b|first-look|hands-on|deal|price-cut", re.I)
TIER_C = ("lenovo.com", "msi.com", "acer.com")                            # technically blocked/unreachable: link only, never circumvent


class PolicyError(Exception):
    pass


@dataclass
class Decision:
    tier: str            # A | B | C | other
    action: str          # fetch | link_only | blocked
    reason: str


SENTENCE_WORDS = {"with", "the", "but", "and", "is", "are", "for", "in", "to", "how", "why", "what", "than", "from", "its", "it", "of", "on", "at", "vs", "or", "more", "less", "better", "best", "new"}


def is_database_page(path: str) -> bool:
    """Notebookcheck spec/database page: '/Brand-Model-SKU.<id>.0.html' with a short, code-like slug. Articles and reviews share the URL
    shape but have long, sentence-like slugs; anything uncertain is treated as an article (link only)."""
    m = re.search(r"/([^/]+)\.(\d+)\.0\.html$", path)
    if not m:
        return False
    slug = m.group(1)
    words = [w.lower() for w in slug.split("-") if w]
    if len(words) > 8 or REVIEWISH.search(slug):
        return False
    return not any(w in SENTENCE_WORDS for w in words)


def _host_matches(host: str, domains) -> bool:
    return any(host == d or host.endswith("." + d) for d in domains)


def classify(url: str) -> Decision:
    try:
        p = urlsplit(url)
    except Exception:
        return Decision("other", "blocked", "malformed URL")
    host = (p.hostname or "").lower()
    if p.scheme != "https":
        return Decision("other", "blocked", "only https links are allowed")
    if p.username or p.password:
        return Decision("other", "blocked", "URL contains credentials")
    if p.port not in (None, 443):
        return Decision("other", "blocked", "non-standard port")
    if not host:
        return Decision("other", "blocked", "no host")
    if _host_matches(host, TIER_A):
        return Decision("A", "fetch", "official manufacturer page")
    if _host_matches(host, SPEC_ONLY):
        if is_database_page(p.path):
            return Decision("A-lab", "fetch", "independent site's specification page (short facts only, with link and credit)")
        return Decision("A-lab", "link_only", "article or review text: we read only specification pages from this site")
    if _host_matches(host, TIER_B):
        return Decision("B", "link_only", "independent lab site: terms of use not yet verified, so link only")
    if _host_matches(host, TIER_C):
        return Decision("C", "link_only", "site blocks automated access or is unreachable; we do not work around that")
    return Decision("other", "link_only", "site is not on the approved list; link only")


_NAT64 = ipaddress.ip_network("64:ff9b::/96")      # well-known DNS64/NAT64 prefix: wraps an ordinary IPv4 address (RFC 6052)


def is_public_ip(ip: str) -> bool:
    a = ipaddress.ip_address(ip)
    if a.version == 6:
        if a.ipv4_mapped is not None:                      # ::ffff:a.b.c.d
            return is_public_ip(str(a.ipv4_mapped))
        if a in _NAT64:                                    # 64:ff9b::a.b.c.d  -> judge the embedded IPv4 address
            return is_public_ip(str(ipaddress.IPv4Address(int(a) & 0xFFFFFFFF)))
    return not (a.is_private or a.is_loopback or a.is_link_local or a.is_multicast or a.is_reserved or a.is_unspecified)


def assert_public_host(host: str) -> list[str]:
    """Resolve and reject loopback/private/link-local/etc. Returns the public IPs. Raises PolicyError."""
    if not host:
        raise PolicyError("no host")
    try:
        ipaddress.ip_address(host)
        ips = [host]
    except ValueError:
        if host.lower() in ("localhost",) or host.lower().endswith((".local", ".internal", ".localhost")):
            raise PolicyError("local host names are not allowed")
        try:
            ips = sorted({ai[4][0] for ai in socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP)})
        except socket.gaierror as e:
            raise PolicyError(f"cannot resolve host: {e}")
    bad = [ip for ip in ips if not is_public_ip(ip)]
    if bad or not ips:
        raise PolicyError(f"host resolves to a non-public address ({bad[0] if bad else 'none'})")
    return ips


class RobotsCache:
    """robots.txt per host, cached 24 h. Conservative: 404/410 => allow; 401/403/5xx/timeouts => disallow."""

    def __init__(self, get=None, ttl=86400):
        self._get, self._ttl, self._c = get, ttl, {}

    def _fetch(self, host):
        import httpx
        r = (self._get or (lambda u: httpx.get(u, headers={"User-Agent": USER_AGENT}, timeout=10, follow_redirects=False)))(f"https://{host}/robots.txt")
        return r.status_code, r.text

    def allowed(self, url: str) -> tuple[bool, str]:
        host = urlsplit(url).hostname or ""
        hit = self._c.get(host)
        if not hit or time.time() - hit[0] > self._ttl:
            try:
                code, body = self._fetch(host)
            except Exception as e:
                self._c[host] = (time.time(), None, f"robots.txt unreachable ({type(e).__name__})")
                hit = self._c[host]
            else:
                if code in (404, 410):
                    rp = robotparser.RobotFileParser(); rp.parse([]); self._c[host] = (time.time(), rp, "no robots.txt")
                elif code == 200:
                    rp = robotparser.RobotFileParser(); rp.parse(body.splitlines()); self._c[host] = (time.time(), rp, "ok")
                else:
                    self._c[host] = (time.time(), None, f"robots.txt returned {code}")
                hit = self._c[host]
        rp, why = hit[1], hit[2]
        if rp is None:
            return False, why
        path = urlsplit(url)
        target = path.path + (("?" + path.query) if path.query else "")
        return (rp.can_fetch(USER_AGENT, f"https://{host}{target}"), "robots.txt allows" if rp.can_fetch(USER_AGENT, f"https://{host}{target}") else "robots.txt disallows this page")


class Throttle:
    """At most one request per `gap` seconds per host."""

    def __init__(self, gap=2.0, clock=time.monotonic, sleep=time.sleep):
        self.gap, self.clock, self.sleep, self.last = gap, clock, sleep, {}

    def wait(self, host):
        now = self.clock()
        if host in self.last:
            due = self.last[host] + self.gap
            if due > now:
                self.sleep(due - now)
        self.last[host] = self.clock()
