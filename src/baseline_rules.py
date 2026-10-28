"""Rules-only baseline: the 'no AI' answer to the same task, in the same output schema (03_output_schema.md).

It matches keywords, parses configs and counts. It cannot judge context, explain a conflict or notice implied
meaning. That is the point: it is the build-vs-rules comparison arm for the PRD, and it lets the UI run offline.

    from baseline_rules import analyze
    out = analyze(profile, laptop, reviews)   # dicts shaped like the golden export
"""
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eval_metrics import INJECTION, clusters  # noqa: E402

LEXICON = {
    "performance": r"slow|sluggish|lag|struggl|multitask|tabs|responsive|performance|fast|smooth|quick|speed|cpu|gpu|games?|gaming|coding|editor|editing|export",
    "thermals_noise": r"fan|loud|noisy|noise|heat|hot|warm|thermal|quiet|silent|sunai",
    "battery": r"battery|charge|charger|backup|charging",
    "display": r"screen|display|brightness|flicker|oled|refresh|pixel|panel|colou?rs?|text looks|reflection|balcony",
    "keyboard_trackpad": r"keyboard|keys|touchpad|trackpad|typing|backlight",
    "build_weight": r"weight|heavy|bulky|light enough|\blight\b|portable|carry|backpack|bag\b|build|compact|halka|footprint",
    "ports_connectivity": r"\bports?\b|usb|adapter|wi-?fi|bluetooth|disconnect",
    "webcam_mic_speakers": r"webcam|speakers?|\bsound\b|volume|\bmic\b|audio|dheem|loud(er)? hota",
    "ram_storage_upgradeability": r"storage|ssd|space|\bram\b|memory|files? on an external|external drive",
    "software_drivers_os": r"windows|macos|software|application|\bapps?\b|compatib|driver",
    "after_sales_support": r"replacement|support|service|return|seller",
    "value_price": r"price|value|worth|budget|cost",
}
LEX = {a: re.compile(p, re.I) for a, p in LEXICON.items()}
NEG = re.compile(r"slow|sluggish|\blag|struggl|crash|loud|noisy|audible|noticeable|warm|\bhot\b|bulky|heavy|\bdim\b|dark|flicker|vertical line|bright (spot|mark)|"
                 r"disconnect|limited|filled|drop(s|ped)?|drain|jaldi|kam\b|dheem|\blow\b|thin\b|difficult|inconvenient|disappoint|issue|problem|not enough|"
                 r"wish|uneven|did not|didn't|would not|never|annoying|frustrat|unreliable|not available|embarrass|reflection|khatam|girti|bahut tabs|slow ho|"
                 r"complicated|louder|more memory|expected more|lost charge|less|below|average|only adequate|tight|few", re.I)
POS = re.compile(r"good|great|smooth|comfortable|clear|\blight\b|easy|responsive|quick|fast|nice|love|sharp|pleasant|quiet|silent|\bwell\b|fine\b|"
                 r"achh|mast|sahi|convenient|manageable|enough|useful|solid|favourite|streaming|stays responsive|lovely|excellent", re.I)
PROMO = re.compile(r"best laptop|must buy|highly recommended", re.I)
OFFTOPIC = re.compile(r"deliver|courier|package|\bbox\b|seller|dented", re.I)
# words in a profile's priority / dealbreaker text -> aspect
PROFILE_WORDS = {
    r"ram|memory|upgrad|storage|hdd|ssd": "ram_storage_upgradeability", r"keyboard": "keyboard_trackpad",
    r"battery|charger|charging": "battery", r"gpu|cpu|cuda|performance": "performance",
    r"throttl|thermal|sustained|cooling|fan|silent|quiet|noise": "thermals_noise",
    r"display|screen|colou?r|refresh|pwm|matte": "display", r"price|value|budget": "value_price",
    r"reliab|build|durab|flimsy|weight|heavy": "build_weight", r"service": "after_sales_support",
    r"webcam|\bmic\b": "webcam_mic_speakers", r"ports?|usb|sd slot": "ports_connectivity",
    r"software|linux|windows|compatib": "software_drivers_os",
}


def sentences(text):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text or "") if s.strip()]


def profile_aspects(profile):
    def aspects_in(s):
        out = []
        for part in re.split(r"\d\)|;", s or ""):
            for pat, asp in PROFILE_WORDS.items():
                if re.search(pat, part, re.I) and asp not in out:
                    out.append(asp)
        return out
    top = aspects_in(profile.get("priorities (ranked)"))[:3]
    deal = aspects_in(profile.get("stated_dealbreakers"))
    return top, deal


def parse_cfg(s):
    """RAM GB and storage tag from a stated config like '8 GB RAM / 256 GB SSD | Ryzen 3'."""
    s = s or ""
    ram = re.search(r"(\d+)\s*GB", s)
    sto = re.findall(r"(\d+)\s*(GB|TB)", s)
    return (int(ram.group(1)) if ram else None), (f"{sto[1][0]}{sto[1][1]}".lower() if len(sto) > 1 else None)


def norm_alnum(s):
    return re.sub(r"[^a-z0-9.]", "", str(s).lower())


def config_mismatch(review, laptop):
    cfg = review.get("reviewer_config_stated")
    if not cfg:
        return None
    ram, sto = parse_cfg(cfg)
    notes = []
    if ram is not None and laptop.get("ram_gb") and ram != int(laptop["ram_gb"]):
        notes.append(f"{ram} GB RAM, listing has {int(laptop['ram_gb'])} GB")
    lsto = re.search(r"(\d+)\s*(GB|TB)", str(laptop.get("storage") or ""), re.I)
    if sto and lsto and sto != f"{lsto.group(1)}{lsto.group(2)}".lower():
        notes.append(f"{sto.upper()} storage, listing has {lsto.group(1)}{lsto.group(2).upper()}")
    style = cfg.split("|")[-1] if "|" in cfg else ""
    hay = norm_alnum(f"{laptop.get('cpu_gpu')} {laptop.get('display')}")
    for part in [p.strip() for p in style.split("/") if p.strip()]:
        if norm_alnum(part) not in hay:
            notes.append(f"'{part}' differs from the listing")
    return "; ".join(notes) or None


def analyze(profile, laptop, reviews, item_id=None):
    top, deal = profile_aspects(profile)
    paspects = list(dict.fromkeys(top + deal))
    text = {r["review_id"]: r["review_text"] for r in reviews}
    flags, assess = {}, {}
    for g in clusters(text.keys(), text):
        if len(g) >= 2:
            for i, rid in enumerate(sorted(g)):
                flags[rid] = "promotional" if PROMO.search(text[rid]) else "duplicate"
    hits = {}  # rid -> {aspect: [(polarity, sentence)]}
    for r in reviews:
        rid, stars = r["review_id"], r.get("stars") or 3
        by, skipped = {}, False
        for s in sentences(r["review_text"]):
            if OFFTOPIC.search(s):  # delivery / seller talk is not a product claim
                skipped = True
                continue
            neg, pos = len(NEG.findall(s)), len(POS.findall(s))
            pol = "neg" if neg > pos else "pos" if pos > neg else ("neg" if stars <= 2 else "pos" if stars >= 4 else None)
            for asp, rx in LEX.items():
                if rx.search(s) and pol:
                    by.setdefault(asp, []).append((pol, s))
        hits[rid] = by
        if INJECTION.search(r["review_text"]):
            flags[rid] = "instruction_injection"
        elif rid not in flags and skipped and not by:
            flags[rid] = "off_topic"
        elif rid not in flags:
            m = re.search(r"only (\d+) ?GB", r["review_text"], re.I)
            ram, _ = parse_cfg(r.get("reviewer_config_stated"))
            if m and ram and int(m.group(1)) != ram:
                flags[rid] = "spec_mismatch"
    for r in reviews:
        rid, by = r["review_id"], hits[r["review_id"]]
        mism = config_mismatch(r, laptop)
        if flags.get(rid):
            app, why = "not", f"flagged {flags[rid].replace('_', ' ')}"
        elif mism:
            app, why = "not", f"different config: {mism}"
        elif any(a in paspects for a in by):
            app, why = "applies", "mentions something you care about"
        elif by:
            app, why = "partly", "talks about topics outside your top priorities"
        else:
            app, why = "not", "no relevant topic found"
        assess[rid] = {"review_id": rid, "applicability": app, "aspects": sorted(by), "reason": why, "flag": flags.get(rid)}
    usable = {rid for rid, a in assess.items() if a["applicability"] in ("applies", "partly")}
    per = {a: {"neg": {}, "pos": {}} for a in paspects}
    for rid in usable:
        for asp, lst in hits[rid].items():
            if asp in per:
                for pol, s in lst:
                    per[asp][pol].setdefault(rid, s)

    def claim(asp, bucket, basis="reviews"):
        ids = sorted(bucket)
        return {"aspect": asp, "basis": basis, "review_ids": ids,
                "quotes": [{"review_id": i, "text": bucket[i]} for i in ids[:3]], "explanation": ""}

    out = {"item_id": item_id, "laptop_id": laptop.get("laptop_id"), "profile_id": profile.get("profile_id"),
           "review_assessments": [assess[r["review_id"]] for r in reviews],
           "dealbreakers": [], "watchouts": [], "strengths": [], "conflicts": [], "evidence_gaps": []}
    for asp in paspects:
        n, p = per[asp]["neg"], per[asp]["pos"]
        if len(n) >= 2:
            c = claim(asp, n); c["explanation"] = f"{len(n)} reviewers who apply to you mention a problem."
            out["dealbreakers"].append(c)
        elif len(n) == 1:
            c = claim(asp, n); c["explanation"] = "One reviewer mentions a problem; unverified."
            out["watchouts"].append(c)
        if asp in top and len(p) >= 2:
            c = claim(asp, p); c["explanation"] = f"{len(p)} reviewers who apply to you are positive."
            out["strengths"].append(c)
        a_only, b_only = sorted(set(n) - set(p)), sorted(set(p) - set(n))  # a review on both sides is not a disagreement
        if a_only and b_only:
            out["conflicts"].append({"aspect": asp, "side_a_ids": a_only, "side_b_ids": b_only, "status": "unresolved", "cause": None})
        if len(set(n) | set(p)) < 2:
            out["evidence_gaps"].append(asp)
    counts = [len(set(per[a]["neg"]) | set(per[a]["pos"])) for a in top] or [0]
    out["confidence"] = ("Insufficient" if len(reviews) < 3 else "High" if min(counts) >= 3 else "Medium" if min(counts) >= 2 else "Low")
    out["summary"] = (f"{len(usable)} of {len(reviews)} reviews look relevant to you. "
                      f"{'Possible dealbreakers: ' + ', '.join(c['aspect'].replace('_', ' ') for c in out['dealbreakers']) + '. ' if out['dealbreakers'] else ''}"
                      "Keyword rules only: this cannot judge context or explain why reviewers disagree.")
    return out
