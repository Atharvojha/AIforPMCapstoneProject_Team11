"""Deterministic fact extraction from page text. No model reads unseen pages, so nothing can be invented:
every fact carries a quote that is an exact substring of the page text and contains the number."""
from __future__ import annotations

import re
from dataclasses import dataclass

NUM = r"(\d+(?:[.,]\d+)?)"


@dataclass
class Fact:
    attribute: str
    value_text: str
    value_num: float | None
    unit: str | None
    quote: str


def _window(text: str, start: int, end: int, span: int = 70) -> str:
    """Quote = the sentence/line fragment around a match, trimmed to ~140 chars at word boundaries; always an exact substring."""
    a = max(0, start - span)
    b = min(len(text), end + span)
    if a > 0 and not text[a - 1].isspace():
        nxt = re.search(r"\s", text[a:start])
        a = a + nxt.end() if nxt else start
    if b < len(text) and not text[b].isspace():
        prv = text.rfind(" ", end, b)
        b = prv if prv > end else end
    seg = text[a:b]
    cut_l = max(seg.rfind("\n", 0, start - a), seg.rfind(". ", 0, start - a))
    if cut_l >= 0:
        a += cut_l + 1
    seg = text[a:b]
    cut_r = [i for i in (seg.find("\n", end - a), seg.find(". ", end - a)) if i >= 0]
    if cut_r:
        b = a + min(cut_r) + 1
    return text[a:b].strip()


def _f(s: str) -> float:
    return float(s.replace(",", "."))


# (attribute, regex, unit, plausible range). Regexes are deliberately conservative: a missed fact is shown as "not found", a wrong one is not acceptable.
LIST_BEFORE = re.compile(r"((?:\d+(?:[.,]\d+)?\s*(?:GB|TB)\s*(?:,\s*(?:or\s+|and\s+)?|\s+or\s+|\s+and\s+))+)$", re.I)
LIST_ITEM = re.compile(r"(\d+(?:[.,]\d+)?)\s*(GB|TB)", re.I)
RANGE = re.compile(NUM + r"\s*(?:kg)?\s*[~\u2013\-]\s*" + NUM + r"\s*kg\b", re.I)
PATTERNS: list[tuple[str, re.Pattern, str, tuple[float, float]]] = [
    ("weight_kg", re.compile(NUM + r"\s*(?:kg|kilograms?)\b", re.I), "kg", (0.5, 6.0)),
    ("battery_wh", re.compile(NUM + r"\s*[- ]?(?:watt[- ]?hours?|whrs?|wh)\b", re.I), "Wh", (20.0, 120.0)),
    ("ram_gb", re.compile(NUM + r"\s*GB\s*(?:of\s*)?(?:(?:LPDDR\w+|DDR\w+|unified|on[- ]?board|soldered|dual-channel)\s*)*(?:memory|RAM|LPDDR\w+|DDR\w+|on[- ]?board)\b", re.I), "GB", (2, 128)),
    ("storage_gb", re.compile(NUM + r"\s*(GB|TB)\s+(?:[\w.\u2122\u00ae\-]+\s+){0,4}?(?:SSD|eMMC)\b", re.I), "GB", (64, 8192)),
    ("display_size_in", re.compile(NUM + r"\s*[- ]?(?:inch(?:es)?\b|\")", re.I), "in", (10.0, 18.5)),
    ("display_brightness_nits", re.compile(NUM + r"\s*nits\b", re.I), "nits", (100, 2000)),
    ("refresh_hz", re.compile(r"(?<![\d/])" + NUM + r"\s*Hz\b", re.I), "Hz", (30, 480)),
]


def _skip(attr: str, text: str, m: re.Match, quote: str) -> str | None:
    """Return a reason to skip this match, or None to keep it."""
    before, after = text[max(0, m.start() - 6):m.start()], text[m.end():m.end() + 8]
    if attr == "display_size_in" and re.search(r"\b(width|height|depth|thickness|dimensions?)\b", quote, re.I):
        return "device dimension"
    if attr == "refresh_hz" and re.search(r"frequency|50\s*/\s*60|\bAC\b|input|adapter|\b\d+\s*V\b|power", quote, re.I):
        return "power-line frequency"
    if attr == "display_size_in" and (re.search(r"\bx\s*$", before, re.I) or re.match(r"\s*x\s*\d", after, re.I) or re.search(r"\d\s*(?:cm|mm)", after)):
        return "dimension, not screen size"
    if attr == "ram_gb" and re.search(r"at least|minimum|recommended", quote, re.I):
        return "requirement text"
    if re.search(r"external displays?|up to \d+k|connect(?:ed)? (?:up )?to|testing|tested|pre-?production|test(?:ed)? configurations?|footnote", quote, re.I) and attr in ("refresh_hz", "storage_gb", "ram_gb", "battery_wh", "display_size_in"):
        return "context is about another device or a test setup"
    return None


def extract_facts(text: str) -> list[Fact]:
    """One Fact per attribute when all matches agree; several differing values become `<attr>_options` (a list), never a guess."""
    found: dict[str, list[tuple[float, str, str]]] = {}
    for attr, rx, unit, (lo, hi) in PATTERNS:
        for m in rx.finditer(text):
            groups = [g for g in m.groups() if g is not None]
            nums = [g for g in groups if re.fullmatch(r"\d+(?:[.,]\d+)?", g)]
            if not nums:
                continue
            v = _f(nums[0])
            if attr == "storage_gb" and any(g.upper() == "TB" for g in groups):
                v *= 1024
            if not lo <= v <= hi:
                continue
            q = _window(text, m.start(), m.end())
            if len(q.split()) > 25:                            # quote cap (well inside Notebookcheck's 100-word rule)
                words = q.split(); k = next((i for i, w in enumerate(words) if nums[0] in w), 0)
                lo_i = max(0, k - 10); cand = " ".join(words[lo_i:lo_i + 25])
                q = cand if cand in text else q
            if len(q.split()) > 25:
                continue
            if nums[0] not in q or q not in text or _skip(attr, text, m, q):
                continue
            a = attr
            if attr == "display_brightness_nits" and re.search(r"peak|hdr", q, re.I):
                a = "display_peak_brightness_nits"            # marketing HDR peak, not typical brightness
            found.setdefault(a, []).append((v, q, unit))
            if attr in ("ram_gb", "storage_gb"):               # "512GB, 1TB, or 2TB SSD": take every item of the list
                lm = LIST_BEFORE.search(text[max(0, m.start() - 60):m.start()])
                if lm:
                    for num, u in LIST_ITEM.findall(lm.group(1)):
                        x = _f(num) * (1024 if u.upper() == "TB" and attr == "storage_gb" else 1)
                        if lo <= x <= hi:
                            found[a].append((x, q, unit))
            if attr == "weight_kg":                            # "1.20 ~ 1.28 kg": record the other end of the range too
                r = RANGE.search(text, max(0, m.start() - 12), m.end() + 1)
                if r and _f(r.group(1)) != v and lo <= _f(r.group(1)) <= hi:
                    found[a].append((_f(r.group(1)), q if r.group(1) in q else _window(text, r.start(), r.end()), unit))
    facts: list[Fact] = []
    for attr, items in found.items():
        vals = sorted({round(v, 2) for v, _, _ in items})
        if attr == "display_size_in" and len(vals) > 2:
            continue                       # three or more sizes on one page: it covers several models, so we state none
        if len(vals) == 1:
            v, q, unit = items[0]
            facts.append(Fact(attr, f"{v:g}", v, unit, q))
        else:
            q = items[0][1]
            facts.append(Fact(f"{attr}_options", ",".join(f"{x:g}" for x in vals), None, items[0][2], q))
    return facts
