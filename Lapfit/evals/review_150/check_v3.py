"""Validate a v3 group file (one or more scenarios) against SPEC_V3.md.
Usage (from Lapfit/): python3 -I evals/review_150/check_v3.py evals/review_150/v3_G1.json   [--all to check every v3_G*.json together]"""
import json, re, sys, glob, collections
COUNTS = {"SL": 18, "BO": 14, "SO": 16, "PC": 18, "UC": 16, "RG": 16, "OV": 15, "BI": 12, "RT": 15, "MD": 15, "SP": 15}
HOLD = {k: (2 if k == "BI" else 3) for k in COUNTS}
SYL = {"G1": "Ka", "G2": "Lo", "G3": "Mi", "G4": "No", "G5": "Pa", "G6": "Ru"}
KEYS = ["Case ID", "Scenario", "Feature", "AI component", "Persona", "Input", "Evidence context", "Ideal output", "Output type", "Expected flow",
        "Expected behaviour", "Expected format", "Assertion hooks", "Language", "Stress level", "Difficulty", "Evidence mode", "Hold-out",
        "Needs native check", "Situation", "Category tags", "Source", "Inspiration source IDs", "Review notes"]
FLOWS = {"shortlist", "second_opinion", "check_pitch", "used_check", "buy_for_others", "owner_voice", "sell_laptop", "trending", "clarify", "out_of_scope_laptop", "not_laptop", "offline_batch"}
BANNED = re.compile(r"\b(lying|liar|scam|fraud|fake|cheat(ing)?)\b", re.I)
E, W = [], []
files = sorted(glob.glob("evals/review_150/v3_G*.json")) if "--all" in sys.argv else [sys.argv[1]]
rows = []
for f in files:
    for r in json.load(open(f)): r["_file"] = f; rows.append(r)
by = collections.defaultdict(list)
for r in rows: by[str(r.get("Case ID", "?")).split("-")[0]].append(r)
names = collections.defaultdict(set)
for code, rs in by.items():
    if code not in COUNTS: E.append(f"unknown scenario code {code}"); continue
    ids = [r["Case ID"] for r in rs]; want = [f"{code}-{i:02d}" for i in range(1, COUNTS[code] + 1)]
    if ids != want: E.append(f"{code}: IDs must be exactly {want[0]}..{want[-1]} in order (got {len(ids)})")
    C = lambda k: collections.Counter(r.get(k) for r in rs)
    lang, st, per, ho = C("Language"), C("Stress level"), C("Persona"), C("Hold-out")
    if lang.get("hi-en", 0) < 3: E.append(f"{code}: need at least 3 hi-en rows {dict(lang)}")
    if set(lang) - {"en", "hi-en"}: E.append(f"{code}: only en and hi-en allowed (Sri, 13 Nov) {dict(lang)}")
    for l in ("L1", "L2", "L3", "L4", "L5"):
        if st.get(l, 0) < 2: E.append(f"{code}: stress {l} has {st.get(l, 0)} (<2)")
    if len(per) < 6: E.append(f"{code}: only {len(per)} personas")
    if per and max(per.values()) > 4: E.append(f"{code}: persona >4 times {per.most_common(1)}")
    if ho.get("yes", 0) != HOLD[code]: E.append(f"{code}: hold-out {ho.get('yes', 0)} (need {HOLD[code]})")
    if C("Difficulty").get("hard", 0) * 3 < len(rs): W.append(f"{code}: fewer than a third hard")
for r in rows:
    cid = r.get("Case ID", "?"); miss = [k for k in KEYS if k not in r]
    if miss: E.append(f"{cid}: missing keys {miss}"); continue
    ideal, ctx, typ = r["Ideal output"], r["Evidence context"], r["Output type"]
    if r["Expected flow"] not in FLOWS: E.append(f"{cid}: bad flow {r['Expected flow']}")
    hooks = [h for h in r["Assertion hooks"].split("||") if h.strip()]
    if len(hooks) < 3: E.append(f"{cid}: {len(hooks)} assertion hooks (<3)")
    if not all(re.match(r"\s*\[(code|judge)\]", h) for h in hooks): E.append(f"{cid}: each hook must start with [code] or [judge]")
    if "(critical)" not in r["Assertion hooks"]: E.append(f"{cid}: no hook marked (critical)")
    if typ == "json":
        try: json.loads(ideal)
        except Exception as e: E.append(f"{cid}: Output type json but ideal is not valid JSON ({e})")
    else:
        text = ideal.split("EXTRACTION:")[0] if "EXTRACTION:" in ideal else ideal
        text = text.split("EXPECTED ROUTER:")[0]
        if "!" in re.sub(r"!\[", "[", text): E.append(f"{cid}: exclamation mark in user text")
        if BANNED.search(text): E.append(f"{cid}: banned word '{BANNED.search(text).group()}'")
        qtext = re.sub(r"https?://\S+", "", text)
        if qtext.count("?") > 2: E.append(f"{cid}: {qtext.count('?')} questions (max 2)")
        wc = len(text.split())
        lo = 1 if "DIRECT" in r["Expected behaviour"] else 25  # D-L14: a one-name answer is valid when the user asked for one name
        hi = 380 if "PLAN" in r["Expected behaviour"] else 340  # multi-role team plans and sell plans carry tables
        if wc < lo or wc > hi: E.append(f"{cid}: user text {wc} words ({lo}-{hi})")
        # v3.1 experience standard
        META = re.compile(r"as you asked|in LapFit'?s order|too general to change|\brouter\b|\bchips\b|\bflow\b", re.I)
        if META.search(text): E.append(f"{cid}: meta/system phrase in user text: '{META.search(text).group()}'")
        for u in set(re.findall(r"https?://[^\s)\]>\"']+", ideal)):
            if u.rstrip('.,;') not in ctx: E.append(f"{cid}: URL not in evidence context: {u}")
        for qt in re.findall(r"[\"“]([^\"”\n]{15,})[\"”]", text):
            if qt not in ctx and qt not in r["Input"]: W.append(f"{cid}: quoted text not an exact substring of context/input: {qt[:50]}")
        cardy = r["Expected flow"] in ("shortlist", "second_opinion", "buy_for_others") and r["Evidence mode"] == "provided_evidence" and re.search(r"SHORTLIST|VERDICT|COMPARE|PLAN", r["Expected behaviour"])
        if cardy and not re.search(r"!\[[^\]]*\]\(https?://", ideal): E.append(f"{cid}: cards shown but no image markdown")
        # D-L15: PROVISIONAL rows may withhold buy links while a compulsory Must is unverified
        if cardy and "lapfit.in/go/" not in ideal and not re.search(r"NO-MATCH|PROVISIONAL", r["Expected behaviour"]): E.append(f"{cid}: cards shown but no buy link")
        if "lapfit.in/go/" in ideal and not re.search(r"commission", ideal, re.I): E.append(f"{cid}: buy links without the affiliate footer")
        if "EXTRACTION:" in ideal:
            try: json.loads(ideal.split("EXTRACTION:")[1].strip().split("\n")[0])
            except Exception: E.append(f"{cid}: EXTRACTION line is not valid one-line JSON")
        if r["Scenario"].startswith("RG") and "EXPECTED ROUTER:" not in ideal: E.append(f"{cid}: RG row needs EXPECTED ROUTER line")
        cites = set(re.findall(r"\[([A-Z]{2}-\d{2}-[ELRP]\d*)\]", ideal)); have = set(re.findall(r"\[([A-Z]{2}-\d{2}-[ELRP]\d*)\]", ctx))
        if cites - have: E.append(f"{cid}: cited IDs not in context {sorted(cites - have)}")
        # minimum-evidence rule, as the repo code applies it: n = SUM of n_reports per group
        # (per laptop and topic for F02/F01 evidence; per laptop for OV owner voice)
        recs = []
        for m in re.finditer(r"\[([A-Z]{2}-\d{2}-E\d+)\]\s*([A-Z][A-Za-z]*\d{2,3}[A-Za-z]?)?([^\[]*)", ctx):
            nm = re.search(r"n_reports\s*(\d+)", m.group(3)); tp = re.search(r"topic\s+([a-z_]+)", m.group(3))
            if nm: recs.append((m.group(1), m.group(2) or "?", tp.group(1) if tp else "?", int(nm.group(1))))
        ov = r["Scenario"].startswith("OV")
        grp = collections.Counter()
        for eid, lap, tp, n in recs: grp[(lap,) if ov else (lap, tp)] += n
        for eid, lap, tp, n in recs:
            g = grp[(lap,) if ov else (lap, tp)]
            if g < 20 and eid in cites and not re.search(r"not enough evidence|enough evidence nahi|evidence kam|saripoyina|podhumana", ideal, re.I):
                E.append(f"{cid}: cites {eid} whose group total n={g} <20 but does not say 'not enough evidence'")
        if r["Language"] == "hi-en" and not re.search(r"\b(hai|hain|lo|karo|kar|mein|nahi|aur|toh|ke|ki|ka|kya)\b", text, re.I): E.append(f"{cid}: hi-en but reply not Hinglish")
    if r["Language"] in ("te-en", "ta-en") and r["Needs native check"] != "yes": E.append(f"{cid}: te/ta needs native check yes")
    grp = re.search(r"v3_(G\d)", r["_file"]); syl = SYL.get(grp.group(1)) if grp else None
    for p in set(re.findall(r"\b([A-Z][a-z]+[A-Z]?[a-z]*\d{2,3}[A-Za-z]?)\b", ctx)):
        names[p].add(cid)
        if syl and r["Source"].strip().lower().startswith("new") and not p.startswith(syl): W.append(f"{cid}: new row product '{p}' should start with '{syl}'")
for p, ids in names.items():
    if len({i.split('-')[0] + i.split('-')[1] for i in ids}) > 1: E.append(f"product name '{p}' used in several rows {sorted(ids)}")
print(f"files {len(files)} · rows {len(rows)} · scenarios {{{', '.join(f'{k}:{len(v)}' for k, v in by.items())}}}")
print("ERRORS:", len(E)); [print("  E", e) for e in E[:80]]
print("WARNINGS:", len(W)); [print("  W", w) for w in W[:80]]
sys.exit(1 if E else 0)
