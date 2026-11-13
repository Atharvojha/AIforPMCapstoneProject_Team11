"""Validate one rewrite_S#.json against REWRITE_SPEC.md.
Usage (from the Lapfit folder): python3 -I evals/review_150/check_rewrite.py evals/review_150/rewrite_S1.json S1
Prints ERRORS (must fix) and WARNINGS (review); exit code 1 if any error."""
import json, re, sys, collections
path, sc = sys.argv[1], sys.argv[2]
IDS = {"S1": ("A", 1), "S2": ("A", 26), "S3": ("B", 1), "S4": ("B", 26), "S5": ("C", 1), "S6": ("C", 26)}[sc]
LETTERS = {"S1": "ABCD", "S2": "EFGH", "S3": "IJKL", "S4": "MNOP", "S5": "QRST", "S6": "UVWXYZ"}[sc]
KEYS = ["Case ID", "Scenario", "Persona", "Input query", "Ideal output", "Evidence context", "Situation", "Category tags", "Evidence mode",
        "Prompt style", "Difficulty", "Inspiration source IDs", "LapFit UC", "Language", "Stress level", "Expected behaviour", "Expected format",
        "Hold-out", "Needs native check", "Review notes"]
E, W = [], []
rows = json.load(open(path))
if len(rows) != 25: E.append(f"expected 25 rows, got {len(rows)}")
want = [f"{IDS[0]}{IDS[1] + i:03d}" for i in range(25)]
if [r.get("Case ID") for r in rows] != want: E.append(f"Case IDs must be exactly {want[0]}..{want[-1]} in order")
BANNED = re.compile(r"\b(lying|liar|scam|fraud|fake|cheat(ing)?)\b", re.I)
SUPER = re.compile(r"\b(best|perfect|ultimate)\b", re.I)
names_seen = collections.Counter()
def nums(s):
    s = s.replace(",", "")
    return re.findall(r"(?:₹|\$)\s?\d+(?:\.\d+)?|\b\d+(?:\.\d+)?\s?(?:kg|h|hours?|hrs?|gb|tb|hz|%|nits|w)\b", s.lower())
for r in rows:
    cid = r.get("Case ID", "?")
    miss = [k for k in KEYS if k not in r]
    if miss: E.append(f"{cid}: missing keys {miss}"); continue
    q, ideal, ctx = r["Input query"], r["Ideal output"], r["Evidence context"]
    no_ev = r["Evidence mode"] == "no_evidence"
    if no_ev and "No reviews" not in ctx: E.append(f"{cid}: no_evidence row must say 'No reviews, product listing or attachment is available.'")
    cites = set(re.findall(r"\[([A-Z]\d{3}-R\d+)\]", ideal)); ctx_ids = set(re.findall(r"\[([A-Z]\d{3}-R\d+)\]", ctx))
    if cites - ctx_ids: E.append(f"{cid}: cited IDs not in evidence: {sorted(cites - ctx_ids)}")
    if any(not c.startswith(cid) for c in ctx_ids): E.append(f"{cid}: review IDs must start with {cid}")
    if no_ev and cites: E.append(f"{cid}: citations in a no-evidence row")
    if not no_ev and not cites and "CLARIFY" not in r["Expected behaviour"] and "DECLINE" not in r["Expected behaviour"]: W.append(f"{cid}: evidence row with no citation in ideal")
    if not no_ev:
        for m in re.finditer(r"\[" + cid + r"-R\d+\][^\[]*", ctx):
            if not re.search(r"\b\d+\s+owners?\b", m.group()): E.append(f"{cid}: review record lacks 'n owners': {m.group()[:60]}")
    prods = set(re.findall(r"\b([A-Z][a-z]+[A-Z]?[a-z]*\d{2,3}[A-Za-z]?)\b", ctx))
    for p in prods:
        names_seen[p] += 1
        if p[0] not in LETTERS: E.append(f"{cid}: product '{p}' must start with one of {LETTERS}")
    ctxq = (ctx + " " + q).replace(",", "").lower()
    vals = {float(x) for x in re.findall(r"\d+(?:\.\d+)?", ctxq)}
    vals |= {v * 1000 for v in vals if v < 1000} | {v * 100000 for v in vals if v < 20}
    vl = list(vals)[:200]
    der = vals | {round(a - b, 2) for a in vl for b in vl} | {round(a + b, 2) for a in vl for b in vl} | {round(a * b, 2) for a in vl for b in vl if min(a, b) < 60}
    for n in nums(ideal):
        v = float(re.search(r"\d+(?:\.\d+)?", n).group())
        if v not in der and round(v, 2) not in der: W.append(f"{cid}: number '{n}' not traceable to evidence/query (check arithmetic)")
    qcount = ideal.count("?")
    if qcount > 2: E.append(f"{cid}: {qcount} questions in ideal (max 2)")
    if BANNED.search(ideal): E.append(f"{cid}: banned word in ideal: {BANNED.search(ideal).group()}")
    if SUPER.search(ideal): W.append(f"{cid}: superlative '{SUPER.search(ideal).group()}' (allowed only if evidence says so or in negation)")
    wc = len(ideal.split()); lim = 190 if r["Expected format"] in ("F2", "F5", "F6") else 150
    if wc < 45 or wc > lim: E.append(f"{cid}: ideal is {wc} words (allowed 45-{lim})")
    if r["Language"] in ("te-en", "ta-en") and r["Needs native check"] != "yes": E.append(f"{cid}: te-en/ta-en must have Needs native check = yes")
    if r["Language"] == "hi-en" and not re.search(r"\b(hai|hain|lo|lena|karo|kar|mein|nahi|aur|toh|ke|ki|ka)\b", ideal, re.I): E.append(f"{cid}: hi-en query but ideal not in Hinglish")
    if r["Language"] in ("te-en", "ta-en") and re.fullmatch(r"[\x00-\x7F₹’“”–—…•→×≤≥½·]*", ideal) and not re.search(r"\b(undi|ledu|kavali|cheyandi|chudandi|baagundi|venum|irukku|illa|sollunga|paarunga|nalla)\b", ideal, re.I):
        E.append(f"{cid}: {r['Language']} query but ideal not in that language mix")
for p, n in names_seen.items():
    if n > 1: E.append(f"product name '{p}' reused in {n} rows (must be unique)")
C = lambda k: collections.Counter(r.get(k) for r in rows)
lang, stress, persona, ho = C("Language"), C("Stress level"), C("Persona"), C("Hold-out")
if lang.get("hi-en", 0) < 3 or lang.get("te-en", 0) < 2 or lang.get("ta-en", 0) < 1: E.append(f"language quota not met: {dict(lang)}")
for lvl, n in {"L1": 5, "L2": 10, "L3": 4, "L4": 3, "L5": 3}.items():
    if abs(stress.get(lvl, 0) - n) > 1: E.append(f"stress level {lvl}: {stress.get(lvl, 0)} (target {n}±1)")
if len(persona) < 9: E.append(f"only {len(persona)} distinct personas (need ≥9)")
if persona and max(persona.values()) > 4: E.append(f"a persona appears >4 times: {persona.most_common(1)}")
if ho.get("yes", 0) != 5: E.append(f"hold-out must be exactly 5, got {ho.get('yes', 0)}")
print(f"{sc}: {len(rows)} rows · languages {dict(lang)} · stress {dict(stress)} · personas {len(persona)} · UCs {dict(C('LapFit UC'))} · formats {dict(C('Expected format'))} · no-evidence {C('Evidence mode').get('no_evidence', 0)}")
print("ERRORS:", len(E)); [print("  E", e) for e in E]
print("WARNINGS:", len(W)); [print("  W", w) for w in W]
sys.exit(1 if E else 0)
