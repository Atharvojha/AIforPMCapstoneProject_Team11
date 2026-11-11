"""Deterministic text helpers: dedup normalisation, exact quote validation, rule-based safety flags.

These are the code-level guarantees the LLM cannot be trusted with (see CH-020)."""
from __future__ import annotations

import hashlib
import re
import unicodedata

_WS = re.compile(r"\s+")
_NONWORD = re.compile(r"[^\w\s]", re.UNICODE)


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def normalise_for_dedup(text: str) -> str:
    """Case-fold, drop punctuation/diacritics, collapse whitespace: 'Good!!' == 'good'."""
    t = unicodedata.normalize("NFKD", text or "").casefold()
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = _NONWORD.sub(" ", t)
    return _WS.sub(" ", t).strip()


def word_count(text: str) -> int:
    return len((text or "").split())


def locate_quote(text: str, quote: str) -> tuple[int, int] | None:
    """Exact substring only. Returns (start, end) offsets or None. No fuzzy repair, ever."""
    if not text or not quote or not quote.strip():
        return None
    i = text.find(quote)
    return (i, i + len(quote)) if i >= 0 else None


# --- rule-based safety/config flags -----------------------------------------------------------
_INJECTION = [
    r"\bignore (all|any|the|your|previous|prior)\b.{0,40}\b(instruction|rule|prompt|polic)",
    r"\b(system|assistant)\s*:",
    r"\bnew instruction",
    r"\byou (must|should|will) (now )?(output|respond|reply|say|write|mark)",
    r"\b(reveal|show|print) (your )?(system )?prompt",
    r"\bas an? (ai|language model|assistant)\b",
    r"\bhide (all )?(the )?(negative|drawback|problem)",
    r"\brespond only with\b",
    r"\bdo not (mention|include|show|question) (any )?(negative|drawback|problem|this|it)",
    r"</?\s*review\s*>",
    r"\b(forget|disregard|override|bypass)\b.{0,40}\b(instruction|rule|guideline|polic|told|above|previous|prior|system|message|safety|everything)",
    r"\bnote to (the )?(ai|model|assistant|llm|bot)\b",
    r"\[/?inst\]|<<sys>>|<\|im_(start|end)\|>",
    r"\b(pretend|you are now|imagine you are)\b",
    r"\bact as (the|a|an) (seller|sales|assistant|ai|salesperson|reviewer|marketer)",
    r"\boutput\b.{0,40}\b(for (each|every) review|inject_ok)",
    r"\b(highest|top) priority instruction",
    r"\binstructions?\W+(?:\w+\W+){0,3}ignor|\bignor\w*\W+(?:\w+\W+){0,6}instruction",   # Hinglish / French word order
    r"\bgive this (product|laptop) (5|five) stars",
    r"\bsay (that )?(this|the) (laptop|product) is (perfect|flawless)",
]
# Second family: text that addresses the software/assistant or manipulates the analysis itself (what the text is ABOUT, not exact phrasing).
_INJECTION_AI = [
    r"\b(the )?(assistant|language model|llm|chatbot|\bai\b|\bbot\b)\b.{0,30}\b(must|should|need to|has to|will|please|now|reading)\b",
    r"\b(if you are|you are|you're) (a|an) (\w+ )?(language model|ai|assistant|bot|llm)\b",
    r"\byour (answer|summary|response|output|rules|instructions|guidelines|developers|reply|analysis|training)\b",
    r"\b(before|when|while) (you )?(summar(is|iz)e|analys[ei]|evaluate|answer|process|read)\w*\b.{0,40}\b(review|claim|question|set|data)\b",
    r"\b(every|each|all) (claim|question|answer)s?\b.{0,25}\b(you|your)\b|\byou evaluate\b",
    r"\bstop\b\W{0,3}\s*(analys|new task|now\b|and\b)|\bnew task\b",
    r"\b(lapfit|the system|the app)\b.{0,40}\b(developer|team|admin)s?\b|\bdevelopers?\b.{0,40}\b(message|told|instruct|skip)",
    r"\brepeat after me\b|\bfrom now on\b.{0,20}\b(answer|respond|reply|say)|\banswer every question\b",
    r"\bhidden (instruction|prompt|rule)s?\b|\bsystem (prompt|message)\b|\brules you were given\b",
    r"\b(admin|developer|override)\s+(override\s+)?code\b|\badmin override\b",
    r"\bpay no attention\b|\bearlier (guidance|instructions)\b",
    r"\b(omit|leave out|delete|remove|skip)\b.{0,30}\b(complaint|negative|warning|drawback|dealbreaker)s?\b",
    r"\bcount (their|this|that) review\b|\bcount .{0,25}\b(twice|three times|\d+ times)\b",
    r"\bsummar(is|iz)e only\b",
    r"\b(write|compose) (me )?a (poem|story|essay|song)\b",
    r"\bdo the opposite\b|\bwhatever the other reviews say\b|\bjust between us\b.{0,30}\bignore\b",
    r"\bignore (what|everything|anything)\b",
    r"\bapprove this (laptop|product)\b|\bmark (this|the) (laptop|product|claim) as\b|\brate all .{0,30} as (positive|good)\b",
    r"\bsimply tell (users|buyers|people|the)\b|\btell (users|buyers|people|the buyer) (this|it)\b.{0,30}\b(best|perfect|lasts?)\b",
    r"\bappend the word\b|\btranslate your\b",
]
_INJ_RE = re.compile("|".join(_INJECTION + _INJECTION_AI), re.IGNORECASE | re.DOTALL)
_ZW = re.compile("[\u200b-\u200f\u2060\ufeff\u00ad]")
_LEET = str.maketrans({"1": "i", "0": "o", "3": "e", "4": "a", "5": "s", "@": "a", "$": "s", "7": "t"})
_SPACED = re.compile(r"\b(?:\w\s){3,}\w\b")


def _injection_view(text: str) -> list[str]:
    """Text variants to scan: as written, with hidden characters removed, with spaced-out letters joined, and with leetspeak undone."""
    t = unicodedata.normalize("NFKC", text or "")
    t = _ZW.sub("", t)
    joined = _SPACED.sub(lambda m: m.group(0).replace(" ", ""), t)
    return [t, joined, joined.translate(_LEET)]


def injection_flag(text: str) -> str | None:
    """Returns 'instruction_like' if the text addresses the reader/model with instructions (also when obfuscated)."""
    return "instruction_like" if any(_INJ_RE.search(v) for v in _injection_view(text)) else None


_HW = r"(ram|memory|ssd|hdd|nvme|storage|sodimm)"
# first-person / past-tense: the reviewer changed their machine, so their experience is not the stock listing
_MODIFIED = re.compile(
    rf"\b(i|i\s?have|i\s?just|just|also|however,?)\s+(upgraded|added|installed|replaced|bought|put|changed)\b.{{0,40}}\b{_HW}\b|"
    rf"\b(upgraded|added|installed|replaced)\b\s+(an?\s+)?(extra|additional|another|new)?\s*\d*\s?(gb|tb)?\s*{_HW}\b|"
    rf"\b(upgraded|added|installed)\s+(the\s+)?{_HW}\b|"
    rf"\b{_HW}\s+(is|was|has been)\s+(upgraded|added)\b",
    re.IGNORECASE | re.DOTALL)
# mentions upgrading as an intent/recommendation/capability: evidence about upgradeability, NOT a config mismatch
_UPGRADE_MENTION = re.compile(r"\bupgrad\w*|\bexpandable\b|\b(extra|free|additional|empty)\s+(ram\s+)?slot", re.IGNORECASE)


def config_mismatch_hint(text: str) -> str | None:
    """'hardware_modified' => reviewer changed RAM/storage (set aside as different configuration).
    'upgrade_mentioned' => talks about upgrading/upgradability (kept; relevant to upgradeability claims)."""
    t = text or ""
    if _MODIFIED.search(t):
        return "hardware_modified"
    if _UPGRADE_MENTION.search(t):
        return "upgrade_mentioned"
    return None


def is_trivial(text: str, min_words: int = 4) -> bool:
    """Too short to carry a testable claim (e.g. 'Good', 'Nice product')."""
    return word_count(text) < min_words


# --- deterministic cross-checks on model-assigned labels (the 8B model mislabels multi-topic reviews) -------------------
_CAT_KEYWORDS = {
    "battery": r"battery|backup|charg|mah|drain",
    "display": r"screen|display|\blcd\b|\bled\b|panel|brightness|resolution|viewing|colou?r|pixel|glare|\btn\b|\bips\b",
    "thermals_noise": r"\bheat|\bhot\b|\bwarm|temperature|\bfan|noise|noisy|\bloud|thermal|throttl",
    "keyboard_trackpad": r"keyboard|\bkeys?\b|touchpad|trackpad|typing|backlit",
    "portability": r"weight|heavy|lightweight|portable|\bcarry|\bslim|\bthin\b",
    "memory": r"\bram\b|memory|\b(4|8|12|16|32)\s?gb\b",
    "gpu": r"graphics|\bgpu\b|\bfps\b|\brtx\b|\bgtx\b|nvidia|radeon|\bgam(e|es|ing)\b",
    "performance": r"performance|\bfast\b|\bslow\b|\blag|speed|processor|\bcpu\b|\bhang|smooth|multitask",
    "other": r"speaker|\bsound\b|audio|volume|\bmic\b|webcam|camera",
    "build_reliability": r"build|plastic|\bbody\b|hinge|sturdy|flimsy|durable|quality",
    "ports_connectivity": r"\bports?\b|\busb\b|\bhdmi\b|wi-?fi|bluetooth",
    "value": r"price|value|money|worth|budget",
    "upgradeability": r"upgrad|\bslot\b",
}
_CAT_RE = {k: re.compile(v, re.IGNORECASE) for k, v in _CAT_KEYWORDS.items()}
_LUKEWARM = re.compile(r"\b(average|avg|okay|ok|decent|fine|not bad|so-?so|could be better|can be better|acceptable|medium|moderate|manageable|i wish|just ok)\b", re.IGNORECASE)
_STRONG = re.compile(r"\b(very|poor|worst|terrible|awful|bad|drains?|hangs?|issues?|problems?|not working|useless|lags?|laggy|excellent|amazing|awesome|best|perfect|great|superb|love)\b", re.IGNORECASE)


_DELIVERY = re.compile(r"deliver|shipping|shipped|packag|packing|courier|seller|flipkart|amazon|return|replace|refund|invoice|customer care|service centre|service center|warranty|dispatch", re.IGNORECASE)
_POS_WORDS = re.compile(r"\b(amazing|awesome|excellent|great|good|nice|best|perfect|fantastic|wonderful|superb|love[ds]?|smooth|fast|powerful|satisfied|worth|fabulous|brilliant|outstanding|impressive)\b", re.IGNORECASE)
_NEG_WORDS = re.compile(r"\b(worst|bad|poor|terrible|awful|drain\w*|slow|laggy|lag|problem|issue|issues|hangs?|freez\w*|heating|overheat\w*|disappoint\w*|useless|waste|horrible|defect\w*|broken|cheap|weak|noisy|loud)\b", re.IGNORECASE)
_NEGATORS = re.compile(r"\b(not|no|never|isn'?t|doesn'?t|don'?t|wasn'?t|without|nothing|barely|hardly|could have|should have)\b", re.IGNORECASE)


def guard_category(quote: str, assigned: str) -> str:
    """Keep the model's category if the quote supports it. If it does not, reassign to the category whose keyword appears EARLIEST in the quote.
    'delivery_or_seller' needs delivery words; otherwise it is a dumping ground and is corrected (to a topic, or 'other')."""
    q = quote or ""
    first = {}
    for c, rx in _CAT_RE.items():
        m = rx.search(q)
        if m:
            first[c] = m.start()
    if assigned == "delivery_or_seller":
        if _DELIVERY.search(q):
            return assigned
        return min(first, key=first.get) if first else "other"
    if assigned in first or not first:
        return assigned
    return min(first, key=first.get)


def guard_polarity(quote: str, polarity: str) -> str:
    """Only fixes 'neutral'/'mixed' labels on unanimous wording: clearly positive words with no negators/negative words => positive; the reverse => negative."""
    if polarity not in ("neutral", "mixed"):
        return polarity
    q = quote or ""
    pos, neg, nega = bool(_POS_WORDS.search(q)), bool(_NEG_WORDS.search(q)), bool(_NEGATORS.search(q))
    if pos and not neg and not nega:
        return "positive"
    if neg and not pos:
        return "negative"
    return polarity


def locate_quote_ci(text: str, quote: str) -> tuple[int, int] | None:
    """Case-only repair: if the quote matches the text ignoring case, return the offsets of the ORIGINAL text slice (same wording, original case)."""
    if not text or not quote or not quote.strip():
        return None
    i = text.lower().find(quote.lower())
    return (i, i + len(quote)) if i >= 0 else None


def guard_strength(quote: str, strength: str) -> str:
    """Lukewarm wording ('average', 'okay', 'medium') can never be a CLEAR statement."""
    if strength == "clear" and _LUKEWARM.search(quote or "") and not _STRONG.search(quote or ""):
        return "mild"
    return strength
