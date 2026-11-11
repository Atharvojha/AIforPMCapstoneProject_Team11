"""Claim Checker: route a free-text claim to a deterministic engine and return an evidence ledger.

Claim types (D-012): spec_fact | measured | experiential | predictive | unsupported.
The verdict ladder (MVP_SCOPE §4) is applied by code. No model is used here: routing is rule-based so behaviour is testable and
safe; unsupported phrasing gets an honest message instead of a guess. Every sub-claim runs a counter-evidence search and reports it."""
from __future__ import annotations

import re
import sqlite3

from . import text_utils as tu

EXACT = ("exact_listing", "exact_family")
SPLIT = re.compile(r"(?<=[.!?:;])\s+|\s+and\s+(?=(has|have|with|weighs|is|comes|lasts))", re.IGNORECASE)


# ------------------------------------------------------------------ safety: drop sentences that instruct the checker
def sanitise(claim: str) -> tuple[str, bool]:
    parts = [p for p in re.split(r"(?<=[.!?:;])\s+", claim.strip()) if p]
    kept, ignored = [], False
    for p in parts:
        if tu.injection_flag(p) and not re.search(r"\b(battery|ram|weigh|kg|hours?|nits|fan|heat|upgrad)\b", p, re.IGNORECASE):
            ignored = True
            continue
        if tu.injection_flag(p):   # instruction mixed with a claim: keep only the claim part (after a colon, or after 'say/tell/claim that')
            ignored = True
            tail = re.split(r"[:;]\s*", p)[-1]
            m = re.split(r"\b(?:say|tell(?: them| users| me)?|state|claim|write|report|declare)\s+(?:that\s+)?", p, flags=re.I)
            if tail and tail != p:
                kept.append(tail)
            elif len(m) > 1 and m[-1].strip():
                kept.append(m[-1].strip())
            continue
        kept.append(p)
    return " ".join(kept).strip(), ignored


# ------------------------------------------------------------------ router
NUM = r"(\d+(?:\.\d+)?)"
R_HOURS = re.compile(NUM + r"\s*(?:hours?|hrs?|h)\b", re.IGNORECASE)
R_BATTERY = re.compile(r"battery|lasts?|backup|charge", re.IGNORECASE)
R_RAM_SIZE = re.compile(NUM + r"\s*gb\s*(?:of\s*)?(?:ram|memory)|(?:ram|memory)\D{0,12}" + NUM + r"\s*gb", re.IGNORECASE)
R_WEIGHT = re.compile(NUM + r"\s*(?:kgs?|kilograms?|kilos?)\b", re.IGNORECASE)
R_WH = re.compile(NUM + r"\s*wh\b", re.IGNORECASE)
R_NITS = re.compile(NUM + r"\s*nits", re.IGNORECASE)
R_PRICE = re.compile(r"(?:₹|\brs\.?|\binr)\s*([\d,]+(?:\.\d+)?)|([\d,]{4,})\s*(?:rupees|rs\b)", re.IGNORECASE)
R_STORAGE = re.compile(NUM + r"\s*(GB|TB)\s*(?:of\s*)?(?:ssd|storage|hdd|nvme|disk)", re.IGNORECASE)
R_SIZE = re.compile(NUM + r"\s*[- ]?(?:inch|inches|\")", re.IGNORECASE)
R_HZ = re.compile(NUM + r"\s*Hz\b", re.IGNORECASE)
R_ALLDAY = re.compile(r"all[- ]day|whole day|full (?:work)?day|entire day|workday|all day long", re.IGNORECASE)
R_LE = re.compile(r"at most|no more than|up to|within|maximum of|not more than", re.IGNORECASE)
R_LT = re.compile(r"less than|under|below|cheaper than|lighter than|smaller than|lower than", re.IGNORECASE)
R_GE = re.compile(r"at least|no less than|minimum|not less than", re.IGNORECASE)
R_GT = re.compile(r"more than|over|above|heavier than|larger than|bigger than|higher than|exceeds?", re.IGNORECASE)
R_PRICEK = re.compile(r"(?<![\w.])(\d{2,3}(?:\.\d)?)\s*k\b", re.IGNORECASE)
R_PRICEWORD = re.compile(r"\b(price|priced|cost|costs|costing|budget|cheap|expensive|₹|rs\.?|inr|rupees?)\b|₹", re.IGNORECASE)
R_USE = re.compile(r"browsing|web|video|streaming|playback|netflix|coding|gaming|zoom|meetings?|battery|charge|lasts?", re.IGNORECASE)
R_UPGRADE = re.compile(r"upgrad|expandable|expand(?:ed)?\b.{0,20}\b(?:ram|memory|storage)|(?:ram|memory)\b.{0,25}\bexpand|add (?:more |extra )?(?:ram|memory)|(?:free|empty|spare|extra|second) (?:ram |memory |sodimm )?slot|replace(?:able)? (?:the )?(?:ram|ssd)|soldered", re.IGNORECASE)
R_HEAT = re.compile(r"\bheat|\bhot\b|overheat|\bwarm|temperature|thermal", re.IGNORECASE)
R_NOISE = re.compile(r"\bfan\b|noise|noisy|\bloud|\bquiet|\bsilent", re.IGNORECASE)
R_PREDICT = re.compile(r"(?:(?:good|great|suitable|ok(?:ay)?|fine|enough|best|ideal|perfect|capable)\s+(?:for|at)|(?:can|could|will)\s+(?:easily\s+)?(?:handle|run|do))\s+(.+)", re.IGNORECASE)
R_SUPERLATIVE = re.compile(r"\b(best|worst|perfect|ever|greatest|amazing|incredible)\b", re.IGNORECASE)
R_COOL = re.compile(r"\b(stays?|runs?|remains?|keeps?) (?:very |pretty |quite )?cool\b|\bcool and quiet\b", re.IGNORECASE)
_POSW = re.compile(r"\b(good|great|excellent|amazing|awesome|fantastic|brilliant|best|fast|smooth|powerful|solid|sturdy|durable|worth|decent|nice|superb|impressive|enough|sufficient|reliable|comfortable)\b", re.IGNORECASE)
_NEGW = re.compile(r"\b(poor|bad|terrible|awful|horrible|worst|flimsy|weak|slow|laggy|insufficient|inadequate|cheap|disappointing|useless|unreliable|uncomfortable|dim|dull|short|drains?)\b", re.IGNORECASE)


def opinion_of(text: str):
    """Owner-opinion claim about one area ('The screen is poor'): returns (category, stance) or None. stance: 'positive' | 'negative'."""
    cats = {}
    for c, rx in tu._CAT_RE.items():
        m = rx.search(text)
        if m and c not in ("other", "upgradeability", "ports_connectivity"):
            cats[c] = m.start()
    if not cats:
        return None
    cat = min(cats, key=cats.get)
    pos, neg = bool(_POSW.search(text)), bool(_NEGW.search(text))
    if pos == neg:
        return None
    stance = "positive" if pos else "negative"
    if R_NEGATED.search(text):
        stance = "negative" if stance == "positive" else "positive"
    return cat, stance


R_NEGATED = re.compile(r"\b(doesn'?t|does not|don'?t|no|not|never|without|isn'?t|won'?t)\b", re.IGNORECASE)


def route(text: str) -> dict:
    t = text
    if R_UPGRADE.search(t):
        return {"type": "spec_fact", "attr": "ram_upgrade"}
    m = R_RAM_SIZE.search(t)
    has_wh, has_kg, has_nits = R_WH.search(t), R_WEIGHT.search(t), R_NITS.search(t)
    if has_wh or has_kg or has_nits or m or R_PRICE.search(t) or R_STORAGE.search(t) or R_SIZE.search(t) or R_HZ.search(t) or (R_PRICEK.search(t) and R_PRICEWORD.search(t)):
        return {"type": "spec_fact", "attr": "multi"}
    if (R_HOURS.search(t) and R_USE.search(t)) or (R_ALLDAY.search(t) and re.search(r"battery|lasts?|backup|charge|power", t, re.IGNORECASE)):
        return {"type": "measured", "attr": "battery_hours"}
    if R_HEAT.search(t) or R_NOISE.search(t) or R_COOL.search(t):
        return {"type": "experiential", "attr": "thermals_noise"}
    if opinion_of(t) and not re.search(r"\bever\b|\bgreatest\b|\bmost \w+ (?:laptop|keyboard|screen|display|battery)\b|\b(?:better|faster|slower|cheaper|lighter|brighter|smoother|worse) than\b|\bthan (?:any|all|every)\b|\bbeats?\b", t, re.IGNORECASE):
        return {"type": "experiential", "attr": "owner_opinion"}
    mp = R_PREDICT.search(t)
    if mp and not R_SUPERLATIVE.search(t) and re.search(r"machine learning|\bml\b|\bai\b|deep learning|gaming|games|video|editing|rendering|coding|programming|design|photoshop|data science|development|streaming", t, re.IGNORECASE):
        return {"type": "predictive", "attr": "workload", "workload": mp.group(1).strip(" .")}
    return {"type": "unsupported", "attr": None}


# ------------------------------------------------------------------ helpers
def _facts(conn, vid):
    return [dict(r) for r in conn.execute("SELECT * FROM spec_facts WHERE variant_id=?", (vid,))]


def _src(conn, sid):
    r = conn.execute("SELECT id,url,publisher,source_class FROM sources WHERE id=?", (sid,)).fetchone()
    return dict(r) if r else None


def parse_conditions(b: dict) -> dict:
    cond = (b.get("conditions") or "") + " " + (b.get("test_name") or "")
    n = re.search(r"(?:≈|~)?\s*(\d{2,4})\s*nits", cond, re.IGNORECASE)
    low = cond.lower()
    wl = "video" if re.search(r"video|movie|playback", low) else "web" if re.search(r"web|wi-?fi|browsing", low) else None
    nits = float(n.group(1)) if n else None
    if wl == "web" and "maximum brightness" in low and nits is None:
        nits = 400.0
    return {"workload": wl, "nits": nits}


def verdict_of(for_n: int, against_n: int) -> str:
    if for_n and against_n:
        return "mixed"
    if for_n:
        return "supported"
    if against_n:
        return "contradicted"
    return "insufficient"


def overall(verdicts: list[str]) -> str:
    s = set(verdicts)
    if s == {"insufficient"} or not s:
        return "insufficient"
    if len(s) == 1:
        return s.pop()
    if "supported" in s and "contradicted" in s:
        return "mixed"
    if s == {"supported", "insufficient"}:
        return "mixed"
    if s == {"contradicted", "insufficient"}:
        return "contradicted"
    return "mixed"


def lane_item(kind, text, source=None, **kw):
    return {"kind": kind, "text": text, "source": source, **kw}


# ------------------------------------------------------------------ engines
def engine_spec(conn, vid, text, facts) -> list[dict]:
    subs = []
    by = {}
    for f in facts:
        by.setdefault(f["attribute"], []).append(f)

    ALIAS = {"weight_kg": ["weight_kg", "weight_kg_curated"]}

    def attrs(attr):
        return ALIAS.get(attr, [attr])

    def exact(attr):
        return [f for a in attrs(attr) for f in by.get(a, []) if f["variant_match"] in EXACT]

    def lane(f):
        return lane_item("spec", f"{f['attribute']}: {f['value_text']}{(' ' + f['unit']) if f['unit'] else ''}", _src(conn, f["source_id"]),
                         variant_match=f["variant_match"], validation=f["validation_status"], fact_id=f["id"])

    def op_of(m):
        window = text[max(0, m.start() - 28):m.end() + 6]
        return "le" if R_LE.search(window) else "ge" if R_GE.search(window) else "lt" if R_LT.search(window) else "gt" if R_GT.search(window) else "eq"

    def numeric_claim(label, attr, want, tol, claim_unit, op="eq"):
        def holds(v):
            return (v < want if op == "lt" else v <= want + 1e-9 if op == "le" else v > want if op == "gt" else v >= want - 1e-9 if op == "ge" else abs(v - want) <= tol)
        f_ex = exact(attr)
        fors, againsts, na = [], [], []
        for f in f_ex:
            if f["value_num"] is None:
                continue
            (fors if holds(f["value_num"]) else againsts).append(lane(f))
        for a_ in attrs(attr):
            for f in by.get(a_, []):
                if f["variant_match"] not in EXACT:
                    na.append(lane(f))
        v = "supported" if fors and not againsts else "contradicted" if againsts and not fors else "mixed" if fors and againsts else "insufficient"
        label_note = "manufacturer spec" if fors and any((l["source"] or {}).get("source_class") == "manufacturer_spec" for l in fors) else None
        subs.append({"text": label, "type": "spec_fact", "verdict": v, "lanes": {"for": fors, "against": againsts, "not_applicable": na},
                     "note": label_note, "counter": {"ran": True, "found": len(againsts)}})

    word = {"lt": "less than", "le": "at most", "gt": "more than", "ge": "at least", "eq": ""}
    for m in R_WEIGHT.finditer(text):
        o = op_of(m); numeric_claim(f"Weight is {word[o]} {m.group(1)} kg".replace("  ", " "), "weight_kg", float(m.group(1)), 0.06, "kg", o)
    for m in R_WH.finditer(text):
        o = op_of(m); numeric_claim(f"Battery capacity is {word[o]} {m.group(1)} Wh".replace("  ", " "), "battery_wh", float(m.group(1)), 0.6, "Wh", o)
    for m in R_NITS.finditer(text):
        o = op_of(m); numeric_claim(f"Screen brightness is {word[o]} {m.group(1)} nits".replace("  ", " "), "display_brightness_nits", float(m.group(1)), 10, "nits", o)
    for m in R_PRICE.finditer(text):
        amt = float((m.group(1) or m.group(2)).replace(",", "")); o = op_of(m)
        numeric_claim(f"Price is {word[o]} ₹{amt:,.0f}".replace("  ", " "), "price_inr", amt, max(1.0, amt * 0.01), "INR", o)
    if not R_PRICE.search(text) and R_PRICEWORD.search(text):
        for m in R_PRICEK.finditer(text):
            amt = float(m.group(1)) * 1000; o = op_of(m)
            numeric_claim(f"Price is {word[o]} ₹{amt:,.0f}".replace("  ", " "), "price_inr", amt, max(1.0, amt * 0.05), "INR", o)
    for m in R_STORAGE.finditer(text):
        gb = float(m.group(1).replace(",", ".")) * (1024 if m.group(2).upper() == "TB" else 1); o = op_of(m)
        numeric_claim(f"Storage is {word[o]} {m.group(1)} {m.group(2).upper()}".replace("  ", " "), "storage_gb", gb, 1, "GB", o)
    for m in R_SIZE.finditer(text):
        o = op_of(m); numeric_claim(f"Screen is {word[o]} {m.group(1)} inches".replace("  ", " "), "display_size_in", float(m.group(1)), 0.25, "in", o)
    for m in R_HZ.finditer(text):
        o = op_of(m); numeric_claim(f"Screen refresh rate is {word[o]} {m.group(1)} Hz".replace("  ", " "), "refresh_hz", float(m.group(1)), 1, "Hz", o)
    mr = R_RAM_SIZE.search(text)
    if mr:
        want = float(mr.group(1) or mr.group(2))
        opts = [f for f in by.get("ram_options_gb", []) if f["variant_match"] in EXACT]
        listing = exact("ram_gb")
        fors, againsts, note = [], [], None
        listing_val = listing[0]["value_num"] if listing and listing[0]["value_num"] is not None else None
        allowed = [float(x) for x in opts[0]["value_text"].split(",") if x.strip()] if opts else []
        if listing_val is not None and listing_val == want:
            fors.append(lane(listing[0]))
        elif listing_val is not None:
            againsts.append(lane(listing[0]))                                   # this listing has a different amount
            if want in allowed:
                fors.append(lane(opts[0]))                                      # but it exists as an order-time option
                note = f"This listing has {listing_val:g} GB. {want:g} GB is offered as an option at purchase, which is a different version."
        elif opts:
            (fors if want in allowed else againsts).append(lane(opts[0]))
        v = "supported" if fors and not againsts else "contradicted" if againsts and not fors else "mixed" if fors and againsts else "insufficient"
        subs.append({"text": f"RAM of {want:g} GB for this laptop", "type": "spec_fact", "verdict": v,
                     "lanes": {"for": fors, "against": againsts, "not_applicable": []}, "note": note, "counter": {"ran": True, "found": len(againsts)}})
    return subs


def engine_upgrade(conn, vid, facts) -> list[dict]:
    exact_f = [f for f in facts if f["attribute"] == "ram_upgradeable" and f["variant_match"] in EXACT]
    sib_f = [f for f in facts if f["attribute"] == "ram_upgradeable" and f["variant_match"] not in EXACT]
    fors, againsts, na = [], [], []
    for f in exact_f:
        txt = f["value_text"].lower()
        item = lane_item("spec", f"ram_upgradeable: {f['value_text']}", _src(conn, f["source_id"]), variant_match=f["variant_match"])
        if "not stated" in txt or "unknown" in txt:          # the source is silent: neither for nor against
            continue
        (againsts if re.search(r"^no\b|solder|not upgrad", txt) and "slot" not in txt else fors).append(item)
    for f in sib_f:
        na.append(lane_item("spec", f"Similar model: ram_upgradeable: {f['value_text']}", _src(conn, f["source_id"]), variant_match=f["variant_match"]))
    # owner evidence: owners who say they changed RAM/storage (distinct reviews, duplicates collapsed)
    rows = conn.execute("""SELECT id, original_text, dup_cluster_id FROM reviews WHERE variant_id=? AND config_mismatch_hint='hardware_modified' AND flag IS NULL""", (vid,)).fetchall()
    seen, owners = set(), []
    for r in rows:
        if not re.search(r"\b(ram|memory|sodimm)\b", r["original_text"], re.IGNORECASE):
            continue
        key = r["dup_cluster_id"] or r["id"]
        if key in seen:
            continue
        seen.add(key)
        m = re.search(r"[^.]{0,60}\b(upgraded|added|installed|replaced)\b[^.]{0,60}", r["original_text"], re.IGNORECASE)
        q = m.group(0).strip() if m else None
        if q and tu.locate_quote(r["original_text"], q):
            owners.append(lane_item("owner", q, {"id": "S-FLIPKART-REVIEWS"}, review_id=r["id"]))
    if len(owners) >= 3:
        fors.extend(owners[:6])
    elif owners:
        na.extend([{**o, "text": o["text"] + "  (fewer than 3 different owners, so not enough to count)"} for o in owners])
    v = verdict_of(len(fors), len(againsts))
    note = "sibling_only" if v == "insufficient" and sib_f else None
    return [{"text": "RAM can be upgraded after purchase", "type": "spec_fact", "verdict": v,
             "lanes": {"for": fors, "against": againsts, "not_applicable": na}, "note": note,
             "counter": {"ran": True, "found": len(againsts)}}]


BATTERY_BUCKETS = [("web_moderate", "Web browsing at moderate brightness (about 150 nits)", lambda c: c["workload"] == "web" and (c["nits"] or 0) <= 250 and c["nits"] is not None),
                   ("web_max", "Web browsing at maximum brightness (about 400 nits)", lambda c: c["workload"] == "web" and (c["nits"] or 0) >= 350),
                   ("video", "Video playback", lambda c: c["workload"] == "video"),
                   ("heavy_use", "A full day of coding or campus use", lambda c: False)]


def engine_battery(conn, vid, text) -> list[dict]:
    mh = R_HOURS.search(text)
    hours = float(mh.group(1)) if mh else None
    pre = text[max(0, (mh.start() if mh else 0) - 40):(mh.start() if mh else 0)]
    upper = bool(re.search(r"barely|\bonly\b|\bjust\b|merely|less than|under|at most|no more than|up to|within|not even", pre, re.IGNORECASE))
    strict = bool(re.search(r"more than|\bover\b|above|less than|under|below", pre, re.IGNORECASE))
    if hours is None:                         # 'lasts all day': no number, so it can only be checked as a heavy-use claim
        return [{"text": "A full day of coding or campus use", "type": "measured", "verdict": "insufficient", "key": "heavy_use",
                 "lanes": {"for": [], "against": [], "not_applicable": []}, "note": None, "counter": {"ran": True, "found": 0},
                 "reason": "“All day” has no number. No independent test measures a full day of coding or campus use, so we can't judge it.",
                 "doesnt_prove": "A web-surfing or video test does not show how long the battery lasts while coding, on video calls or when editing."}]
    low = text.lower()
    bench = [dict(r) for r in conn.execute("SELECT * FROM benchmarks WHERE variant_id=? AND category='battery'", (vid,))]
    for b in bench:
        b["cond"] = parse_conditions(b)
    claims_b = [b for b in bench if b["methodology"] == "manufacturer_claim"]
    chosen = None
    if re.search(r"\bvideo|movie|playback|netflix", low):
        chosen = ["video"]
    elif re.search(r"browsing|web|wi-?fi", low):
        if re.search(r"moderate|medium|dim|low brightness|150\s*nits|half brightness", low):
            chosen = ["web_moderate"]
        elif re.search(r"max(?:imum)?\s*brightness|full brightness|400\s*nits|brightest", low):
            chosen = ["web_max"]
        else:
            chosen = ["web_moderate", "web_max"]       # brightness not stated: the answer depends on it, so show both
    elif re.search(r"any brightness|every brightness", low):
        chosen = ["web_moderate", "web_max"]
    elif re.search(r"max(?:imum)?\s*brightness|full brightness|brightest|400\s*nits", low):
        chosen = ["web_max"]
    elif re.search(r"moderate|medium brightness|low brightness|dim|150\s*nits", low):
        chosen = ["web_moderate"]
    elif re.search(r"coding|programming|campus|all day|full day|workday|lectures", low):
        chosen = ["heavy_use"]
    else:
        match = [b for b in claims_b if abs((b["value_num"] or -1) - hours) < 0.01]    # the number equals a maker's claim => that claim's conditions
        chosen = [b["cond"]["workload"] == "video" and "video" or "web_moderate" for b in match][:1] or [k for k, _, _ in BATTERY_BUCKETS]
    subs = []
    for key, label, pred in BATTERY_BUCKETS:
        if key not in chosen:
            continue
        in_b = [b for b in bench if b["methodology"] != "manufacturer_claim" and pred(b["cond"])]
        claims_in = [b for b in claims_b if (key == "video" and b["cond"]["workload"] == "video") or (key == "web_moderate" and b["cond"]["workload"] == "web")]
        fors, againsts, na = [], [], []

        def mk(b, claim=False):
            return lane_item("claim" if claim else "lab", f"{b['value_text']} {b['unit']} · {b['test_name']} · {b['conditions']}", _src(conn, b["source_id"]),
                             variant_match=b["variant_match"], validation=b["validation_status"], published=b["published_at"], benchmark_id=b["id"], url=b["source_url"])
        for b in in_b:
            val = b["value_num"]
            if val is None:
                continue
            ok_ = (val < hours if strict else val <= hours) if upper else (val > hours if strict else val >= hours)
            if b["variant_match"] not in EXACT:
                na.append(mk(b))
            elif ok_:
                fors.append(mk(b))
            else:
                againsts.append(mk(b))
        for b in claims_in:
            na.append(mk(b, claim=True))
        # the 'fullscreen' variant shares conditions with the main web result: keep, it is evidence under the same conditions
        v = verdict_of(len(fors), len(againsts))
        note = "claimed_unverified" if v == "insufficient" and claims_in and not in_b else None
        subs.append({"text": f"{label}: battery lasts {'about ' if upper else ''}{'at most ' if upper else ''}{hours:g} hours{'' if upper else ' or more'}", "type": "measured", "verdict": v, "key": key,
                     "lanes": {"for": fors, "against": againsts, "not_applicable": na}, "note": note, "counter": {"ran": True, "found": len(againsts)},
                     "doesnt_prove": "A web-surfing or video test does not show how long the battery lasts while coding, on video calls or when editing." if key != "heavy_use" else None})
    return subs


def engine_experiential(conn, vid, text) -> list[dict]:
    """Owner-opinion claims. Needs >=3 different owners; supported/contradicted at >=2/3 agreement; otherwise mixed. Thermals also show lab data apart."""
    thermal = bool(R_HEAT.search(text) or R_NOISE.search(text) or R_COOL.search(text))
    if thermal:
        cat = "thermals_noise"
        is_noise = bool(R_NOISE.search(text)) and not R_HEAT.search(text)
        topic = "fan noise" if is_noise else "heat"
        no_problem = bool(R_NEGATED.search(text)) or bool(re.search(r"\bquiet|silent|cool", text, re.IGNORECASE))
        claim_pos = no_problem                       # for thermals, 'positive' (good) means no problem
        label = f"{topic.capitalize()}: {'is not a problem' if claim_pos else 'is a problem'}"
    else:
        cat, stance = opinion_of(text)
        topic = cat.replace("_", " ")
        claim_pos = stance == "positive"
        label = f"{topic.capitalize()} is {'good' if claim_pos else 'poor'}"
    rows = [dict(r) for r in conn.execute("""SELECT ec.polarity, ec.quote, ec.review_id, r.dup_cluster_id FROM evidence_claims ec JOIN reviews r ON r.id=ec.review_id
                  WHERE ec.variant_id=? AND ec.category=? AND r.flag IS NULL AND r.config_mismatch_hint IS NOT 'hardware_modified'""", (vid, cat))]
    if thermal:   # the stored category lumps heat and fan noise together: judge each claim only on quotes that talk about it
        noise_rx = re.compile(r"\bfan|noise|noisy|loud|buzz|whir|quiet|silent|hum\b", re.IGNORECASE)
        heat_rx = re.compile(r"\bheat|\bhot\b|warm|temperature|thermal|throttl|cool", re.IGNORECASE)
        want = noise_rx if topic == "fan noise" else heat_rx
        rows = [r for r in rows if want.search(r["quote"] or "")]
    seen, pos, neg = set(), [], []
    for c in rows:
        k = c["dup_cluster_id"] or c["review_id"]
        if k in seen or c["polarity"] not in ("positive", "negative"):
            continue
        seen.add(k)
        item = lane_item("owner", c["quote"], {"id": "S-FLIPKART-REVIEWS"}, review_id=c["review_id"])
        (neg if c["polarity"] == "negative" else pos).append(item)
    n = len(pos) + len(neg)
    from .analysis import owner_status
    st = owner_status(conn, vid)
    fors, againsts = (pos, neg) if claim_pos else (neg, pos)
    bench = [dict(r) for r in conn.execute("SELECT * FROM benchmarks WHERE variant_id=? AND category=?", (vid, cat))]
    na = [lane_item("lab", f"{b['value_text']} {b['unit']} · {b['test_name']} · {b['conditions']}", _src(conn, b["source_id"]), variant_match=b["variant_match"],
                    validation=b["validation_status"], benchmark_id=b["id"], url=b["source_url"]) for b in bench if b["variant_match"] not in EXACT]
    if n < 3:
        v = "insufficient"
    else:
        share = len(fors) / n
        v = "supported" if share >= 2 / 3 else "contradicted" if share <= 1 / 3 else "mixed"
    reason = None
    if st["state"] == "not_available":
        reason = "No owner reviews are available for a laptop looked up online."; v = "insufficient"
    elif n < 3:
        reason = f"Only {n} different owners wrote about {topic} in the reviews we have read ({st['processed']} of {st['representatives']} read). At least 3 are needed."
    return [{"text": label, "type": "experiential", "verdict": v,
             "lanes": {"for": fors[:5], "against": againsts[:5], "not_applicable": na}, "note": "sibling_only" if (v == "insufficient" and na) else None,
             "counter": {"ran": True, "found": len(againsts)}, "reason": reason, "early": st["state"] == "partial",
             "doesnt_prove": f"{len(fors)} of {n} different owners agree. Owner remarks are personal experiences from different rooms, workloads and versions of the laptop."}]


def engine_predictive(conn, vid, text, workload, facts) -> list[dict]:
    wanted = {"ram_gb": "Memory (RAM)", "gpu": "Graphics processor", "cpu": "Processor"}
    shown = []
    for attr, label in wanted.items():
        f = next((f for f in facts if f["attribute"] == attr and f["variant_match"] in EXACT), None)
        if f:
            shown.append(lane_item("spec", f"{label}: {f['value_text']}{(' ' + f['unit']) if f['unit'] else ''}", _src(conn, f["source_id"]), variant_match=f["variant_match"]))
    return [{"text": f"The laptop is good for {workload}", "type": "predictive", "verdict": "insufficient",
             "lanes": {"for": [], "against": [], "not_applicable": shown}, "note": None, "counter": {"ran": True, "found": 0},
             "reason": "“Good for” depends on your exact work (for example the size of the models you train and whether you use a GPU). We have no tests or owner reports for this kind of use, and we will not guess a threshold for you.",
             "doesnt_prove": "The listing details are facts to compare with your own needs. They are not evidence that the laptop handles your work."}]


# ------------------------------------------------------------------ public
def check_claim(conn: sqlite3.Connection, variant_id: str, claim_text: str) -> dict:
    v = conn.execute("SELECT id, display_name FROM laptop_variants WHERE id=?", (variant_id,)).fetchone()
    if v is None:
        raise KeyError(variant_id)
    clean, ignored = sanitise(claim_text)
    r = route(clean)
    facts = _facts(conn, variant_id)
    clarifier = None
    if r["type"] == "spec_fact":
        subs = engine_upgrade(conn, variant_id, facts) if r["attr"] == "ram_upgrade" else engine_spec(conn, variant_id, clean, facts)
    elif r["type"] == "measured":
        subs = engine_battery(conn, variant_id, clean)
        if len(subs) > 1:
            clarifier = "Battery claims depend on what you do and how bright the screen is. We checked several situations. Tell us yours to narrow it down."
    elif r["type"] == "experiential":
        subs = engine_experiential(conn, variant_id, clean)
        clarifier = "“Too loud” and “hot” mean different things to different people. We can only report what owners and lab tests say."
    elif r["type"] == "predictive":
        subs = engine_predictive(conn, variant_id, clean, r["workload"], facts)
        clarifier = "What exactly will you do (for example, model size, framework, local or cloud)? We can then compare your needs with the listing details."
    else:
        subs = []
    if r["type"] == "unsupported" or not subs:
        return {"variant": {"id": v["id"], "display_name": v["display_name"]}, "claim_text": claim_text, "claim_understood_as": clean, "claim_type": "unsupported",
                "supported": False, "verdict": None, "subclaims": [], "message": "We can’t check this claim yet. It is too vague or subjective to test. Try a specific claim, such as “battery lasts 12 hours”, “RAM is upgradeable”, “weighs 1.3 kg”, “fan is loud” or “runs hot”.",
                "instruction_ignored": ignored, "counter_evidence": {"ran": False, "found": 0}, "provenance": {"live_search_performed": False}}
    verdict = overall([s["verdict"] for s in subs])
    cov_have = sum(1 for s in subs if s["verdict"] != "insufficient")
    return {"variant": {"id": v["id"], "display_name": v["display_name"]}, "claim_text": claim_text, "claim_understood_as": clean, "claim_type": r["type"], "supported": True,
            "verdict": verdict, "subclaims": subs, "clarifier": clarifier, "instruction_ignored": ignored,
            "counter_evidence": {"ran": True, "found": sum(s["counter"]["found"] for s in subs)},
            "what_we_could_check": f"{cov_have} of {len(subs)} situations had usable evidence",
            "provenance": {"corpus": "LapFit catalogue", "live_search_performed": False}}
