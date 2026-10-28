"""Draft the golden labels by applying Labelling_Guide to HAND-WRITTEN review annotations.

PROVENANCE: the annotations below and every judgement call were written by Claude (an AI), not by the team. The labels
are therefore AI-drafted and NOT human-verified. They were written before any model output was scored, and without
reading model outputs while deciding. A human spot-check is still needed before they can be called frozen.

    python3 src/label_items.py            # derive labels, print them, write data/labels_draft.json
    python3 src/label_items.py --write    # also write them into the workbook (needs openpyxl)

Annotation format per review: "aspect:polarity:context;..."
  aspect  perf therm batt disp kbd build ports cam mem(RAM) sto(storage space) sw svc val   (see ASP)
  polarity  +  positive | -  clear complaint | m  mild or ambiguous remark | 0  neutral mention
  context   what use the claim is about: G general property | unit defect on this unit | or a use tag (see FAM)
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")

ASP = {"perf": "performance", "therm": "thermals_noise", "batt": "battery", "disp": "display", "kbd": "keyboard_trackpad",
       "build": "build_weight", "ports": "ports_connectivity", "cam": "webcam_mic_speakers", "mem": "ram_storage_upgradeability",
       "sw": "software_drivers_os", "sto": "ram_storage_upgradeability", "svc": "after_sales_support", "val": "value_price"}
CODE = {v: k for k, v in ASP.items()}

ANN = {
 # L01 Acer Aspire 14 (8GB / 256GB)
 "R001": "batt:-:calls", "R002": "perf:-:multi;perf:+:basic", "R003": "disp:-:unit;svc:0:G", "R004": "sto:-:G",
 "R005": "perf:-:G;therm:-:G", "R006": "perf:-:multi;perf:+:basic", "R007": "disp:+:G;build:+:G;cam:-:G",
 "R008": "kbd:+:G;batt:m:classes", "R009": "cam:m:calls;perf:+:classes", "R010": "sto:+:G;perf:m:G",
 "R011": "build:+:carry;kbd:+:writing", "R012": "perf:+:basic", "R013": "val:+:G;perf:+:basic;sto:m:G",
 "R014": "disp:+:G", "R015": "perf:+:classes;perf:+:calls",
 # L02 MSI Katana 15 (16GB / 1TB, RTX 3050)
 "R016": "therm:-:gaming", "R017": "batt:-:unplugged", "R018": "kbd:-:unit;svc:0:G", "R019": "build:-:G",
 "R020": "perf:-:gaming", "R021": "perf:+:gaming;therm:-:gaming;disp:+:G", "R022": "perf:+:heavy;perf:+:gaming;batt:m:unplugged",
 "R023": "disp:+:G;disp:m:bright", "R024": "sto:+:G;cam:-:G", "R025": "sto:-:G", "R026": "perf:+:gaming;disp:+:gaming;build:m:G",
 "R027": "perf:+:gaming;perf:+:coding", "R028": "perf:+:G;sto:+:G;therm:+:gaming", "R029": "kbd:+:G;disp:+:G",
 "R030": "perf:+:coding;perf:+:heavy;batt:m:desk",
 # L03 MSI Modern 14 (16GB / 512GB)
 "R031": "batt:-:calls", "R032": "perf:+:G;cam:-:G", "R033": "disp:-:unit;svc:0:G", "R034": "kbd:-:writing",
 "R035": "perf:-:multi", "R036": "perf:+:basic;batt:-:unplugged", "R037": "build:+:G;cam:m:calls",
 "R038": "disp:+:G;disp:m:bright", "R039": "perf:+:basic;kbd:m:G", "R040": "build:+:G;perf:+:G;mem:m:G",
 "R041": "perf:+:coding;build:+:G", "R042": "build:+:carry;perf:+:classes", "R043": "perf:+:basic;cam:m:G",
 "R044": "kbd:+:G;build:+:G", "R045": "perf:+:multi",
 # L04 Samsung Galaxy Book4 (16GB / 512GB)
 "R046": "disp:-:unit;svc:0:G", "R047": "batt:-:calls", "R048": "ports:-:G", "R049": "disp:-:bright", "R050": "perf:-:multi",
 "R051": "kbd:+:G;cam:-:calls", "R052": "perf:+:basic;disp:m:G", "R053": "build:+:carry;ports:m:G", "R054": "batt:+:reading;batt:-:calls",
 "R055": "perf:+:G;therm:m:heavy", "R056": "perf:+:basic;perf:+:calls", "R057": "build:+:carry;disp:+:basic", "R058": "sw:+:G",
 "R059": "perf:+:classes", "R060": "disp:+:basic;kbd:+:G",
 # L05 Motobook 60 Pro (16GB / 512GB, 2.8K OLED)
 "R061": "disp:-:unit;svc:0:G", "R062": "disp:+:G;batt:-:bright", "R063": "kbd:-:writing", "R064": "therm:-:heavy",
 "R065": "disp:-:unit", "R066": "disp:+:G;batt:m:carry", "R067": "perf:+:G;therm:-:heavy;therm:+:light",
 "R068": "kbd:+:G;disp:+:G;cam:m:G", "R069": "build:+:carry;sto:m:media", "R070": "sto:+:G;batt:m:G",
 "R071": "disp:+:G;disp:+:media", "R072": "perf:+:multi;build:+:carry", "R073": "build:+:G;disp:+:G;cam:m:G", "R074": "disp:+:G",
 "R075": "perf:+:basic;build:+:G",
 # L06 MacBook Air M4 (16GB / 256GB)
 "R076": "disp:-:unit;svc:0:G", "R077": "perf:+:G;sto:-:media", "R078": "sw:-:G", "R079": "ports:-:G", "R080": "batt:-:unit",
 "R081": "perf:+:G;sto:-:G", "R082": "disp:+:G;build:+:G;ports:-:G", "R083": "perf:+:G;sw:0:G", "R084": "batt:+:writing;batt:-:calls",
 "R085": "perf:+:G;sto:m:G", "R086": "build:+:carry;perf:+:calls", "R087": "kbd:+:G;perf:+:basic", "R088": "perf:+:coding;sto:m:G",
 "R089": "disp:+:G;therm:+:basic", "R090": "build:+:carry;ports:m:G",
}
# reviewer owns a different configuration from the listing (RAM, storage, CPU or screen variant): not applicable
CFG = {"R005", "R010", "R020", "R025", "R035", "R040", "R050", "R055", "R065", "R070", "R080", "R085"}
# synthetic adversarial reviews: flagged, never used as evidence
FLAG = {"R091": "promotional or duplicate cluster", "R092": "promotional or duplicate cluster", "R093": "promotional or duplicate cluster",
        "R094": "promotional or duplicate cluster", "R095": "contains an instruction to the reader", "R096": "off-topic (delivery and seller)",
        "R097": "contradicts its own stated config and the listing"}

# context tag -> use family; families a student profile covers; families that overlap partially
FAM = {"basic": "L", "classes": "L", "writing": "L", "reading": "L", "light": "L", "calls": "C", "multi": "X", "coding": "X", "heavy": "H",
       "media": "H", "gaming": "Gm", "carry": "M", "unplugged": "M", "bright": "M", "desk": "D"}
PARTIAL = {frozenset(p) for p in (("L", "C"), ("X", "L"), ("X", "H"), ("H", "Gm"))}
PFAM = {"P01": "XLM", "P02": "HXD", "P03": "LCMX", "P04": "HDX", "P05": "HD", "P06": "LCM", "P07": "LCMX", "P08": "HDX", "P09": "LCM",
        "P10": "LMX", "P11": "XGD", "P12": "LDM"}
PFAM["P11"] = ["X", "Gm", "D"]
PFAM = {k: (v if isinstance(v, list) else list(v)) for k, v in PFAM.items()}
# (top priorities, stated dealbreakers, extra needs) as aspect codes
PASP = {
 "P01": (["mem", "kbd", "batt"], ["mem", "kbd"], ["sw"]), "P02": (["perf", "therm", "mem"], ["therm"], []),
 "P03": (["val", "build", "batt"], ["mem", "build", "svc"], []), "P04": (["disp", "mem", "perf"], ["disp", "therm"], []),
 "P05": (["perf", "disp", "ports"], ["therm", "mem"], ["sw"]), "P06": (["build", "batt", "therm"], ["build", "batt"], []),
 "P07": (["kbd", "cam", "batt"], ["cam", "kbd"], []), "P08": (["perf", "mem"], ["perf", "therm"], ["sw"]),
 "P09": (["batt", "ports", "build"], ["batt", "ports"], []), "P10": (["therm", "kbd", "disp"], ["therm", "kbd"], []),
 "P11": (["perf", "therm", "disp"], ["therm"], []), "P12": (["kbd", "disp", "build"], ["kbd", "disp"], []),
}
# judgement calls the rules cannot make: dealbreaker backed by one review plus a verifiable listing fact (rule b)
LISTING_FACT = {"G005": {"sw": ["R078"]}}  # AutoCAD / SolidWorks need Windows; this laptop runs macOS and a reviewer could not run a needed app
NOTES = {}  # item_id -> extra sentence for why_correct


def events(rid):
    out = []
    for tok in ANN[rid].split(";"):
        a, p, c = tok.split(":")
        out.append((a, p, c))
    return out


def overlap(pid, ctx):
    if ctx in ("G", "unit"):
        return "full"
    f, P = FAM[ctx], PFAM[pid]
    if f in P:
        return "full"
    return "partial" if any(frozenset((f, p)) in PARTIAL for p in P) else "none"


def label(item):
    pid, rids = item["profile"]["profile_id"], [r["review_id"] for r in item["reviews"]]
    applies, partly, notes = [], [], {}
    for rid in rids:
        if rid in FLAG:
            notes[rid] = "flagged: " + FLAG[rid]
        elif rid in CFG:
            notes[rid] = "different configuration from the listing"
        else:
            spec = [(a, p, c) for a, p, c in events(rid) if c not in ("G", "unit")]
            if not spec:
                applies.append(rid)
            else:
                ov = [overlap(pid, c) for _, _, c in spec]
                if "full" in ov:
                    applies.append(rid)
                elif "partial" in ov:
                    partly.append(rid)
                else:
                    notes[rid] = "different kind of use: " + "/".join(sorted({c for _, _, c in spec}))
    usable = applies + partly
    top, deal, extra = PASP[pid]
    paspects = list(dict.fromkeys(top + deal + extra))
    ev = {a: {"-": set(), "m": set(), "+": set(), "any": set(), "negctx": {}, "posctx": {}} for a in paspects}
    for rid in usable:
        for a, p, c in events(rid):
            if overlap(pid, c) == "none":
                continue
            targets = [a] + (["mem"] if (a == "perf" and c == "multi") else [])   # multitasking slowdown is RAM evidence
            for t in targets:
                if t not in ev:
                    continue
                e = ev[t]
                e["any"].add(rid)
                if p in "-m+":
                    e[p].add(rid)
                fam = "G" if c in ("G", "unit") else FAM[c]
                if p == "-" and c != "unit":
                    e["negctx"].setdefault(rid, set()).add(fam)
                if p == "+":
                    e["posctx"].setdefault(rid, set()).add(fam)
    deal_out, watch, conf_out, gaps = {}, {}, [], []
    for a in paspects:
        e = ev[a]; c = e["-"]
        # mild remarks ("average", "could be clearer") never create a dealbreaker or watch-out; two CLEAR reports do
        if len(c) >= 2:
            deal_out[a] = sorted(c)
        elif len(c) == 1:
            watch[a] = sorted(c)
        # a conflict is two reviewers contradicting each other: a clear complaint (not an arrival defect) against a
        # positive, from reviews that do not themselves report both; skipped if they describe clearly different uses
        sideA = sorted(set(e["negctx"]) - e["+"])
        sideB = sorted(e["+"] - e["-"] - e["m"])
        if sideA and sideB:
            specA = {x for r in sideA for x in e["negctx"][r] if x != "G"}
            specB = {x for r in sideB for x in e["posctx"][r] if x != "G"}
            general = any("G" in e["negctx"][r] for r in sideA) or any("G" in e["posctx"][r] for r in sideB)
            if general or (specA & specB):
                conf_out.append((a, sideA, sideB, "unresolved", None))
        if len(e["any"]) < 2:
            gaps.append(a)
    if "mem" in deal_out and "perf" in deal_out and set(deal_out["mem"]) <= set(deal_out["perf"]):
        del deal_out["mem"]   # multitasking slowdown counted as both performance and RAM: keep the symptom aspect only
    for a, ids in LISTING_FACT.get(item["item_id"], {}).items():
        deal_out[a] = ids; watch.pop(a, None)
    topu = list(dict.fromkeys(top)); cover = {a: len(ev[a]["any"]) for a in topu}
    if len(rids) < 3 or cover[topu[0]] < 2:
        confidence = "Insufficient"
    elif all(v >= 3 for v in cover.values()):
        confidence = "High"
    elif all(v >= 2 for v in cover.values()):
        confidence = "Medium"
    else:
        confidence = "Low"
    L = lambda a: ASP[a].replace("_", " ")
    why = [f"{len(usable)} of {len(rids)} reviews apply or partly apply."]
    if notes:
        grp = {}
        for r, n in notes.items():
            grp.setdefault(n, []).append(r)
        why.append("Not applicable: " + "; ".join(f"{', '.join(v)} ({k})" for k, v in grp.items()) + ".")
    if deal_out:
        why.append("Dealbreaker: " + "; ".join(f"{L(a)} ({', '.join(i)})" for a, i in deal_out.items()) + ".")
    if watch:
        why.append("Watch-out, single complaint: " + "; ".join(f"{L(a)} ({', '.join(i)})" for a, i in watch.items()) + ".")
    if conf_out:
        why.append("Disagreement: " + "; ".join(f"{L(a)} {','.join(A)} vs {','.join(B)} ({'explained by usage' if s == 'explained' else 'unresolved'})" for a, A, B, s, _ in conf_out) + ".")
    why.append(f"Confidence {confidence}: top priority {L(topu[0])} is covered by {cover[topu[0]]} applicable reviews" + (f"; gaps: {', '.join(L(g) for g in gaps)}" if gaps else "") + ".")
    if item["item_id"] in NOTES:
        why.append(NOTES[item["item_id"]])
    return {"item_id": item["item_id"], "applicable": sorted(usable), "not_applicable": sorted(notes),
            "dealbreakers": {ASP[a]: i for a, i in deal_out.items()}, "watchouts": {ASP[a]: i for a, i in watch.items()},
            "conflicts": [{"aspect": ASP[a], "a": A, "b": B, "status": s, "cause": c} for a, A, B, s, c in conf_out],
            "gaps": [ASP[g] for g in gaps], "confidence": confidence, "why": " ".join(why)}


def main():
    items = [json.loads(l) for l in open(os.path.join(ROOT, "data", "items_inputs.jsonl"), encoding="utf-8")]
    labels = [label(i) for i in items]
    json.dump(labels, open(os.path.join(ROOT, "data", "labels_draft.json"), "w"), indent=1)
    for it, lb in zip(items, labels):
        print(f"{it['item_id']} {it['subtype'][:24]:24s} {it['profile']['profile_id']}-{it['laptop']['laptop_id']}  app {len(lb['applicable']):2d}/{len(it['reviews']):2d}  conf={lb['confidence']}")
        print(f"   not: {lb['not_applicable']}")
        print(f"   DEAL: {lb['dealbreakers']}  WATCH: {lb['watchouts']}")
        print(f"   CONF: {[(c['aspect'], c['a'], c['b'], c['status']) for c in lb['conflicts']]}  GAPS: {lb['gaps']}")
    if "--write" in sys.argv:
        write(labels)


def blueprint_gaps(item, lb):
    """Where the real evidence differs from what the item's subtype was designed to test (reported, never forced)."""
    st, out = item["subtype"], []
    if st.startswith("H1") and not lb["dealbreakers"]:
        out.append("designed as a clear dealbreaker, but the reviews give no aspect with 2+ clear reports for this student")
    if st.startswith("H2") and lb["dealbreakers"]:
        out.append("designed as no-dealbreaker, but 2+ clear reports exist on an aspect this student cares about")
    if st.startswith("H5") and not any(c["status"] == "explained" for c in lb["conflicts"]):
        out.append("designed as a conflict explained by context; no reviewers contradict each other in a way a usage difference explains")
    if st.startswith("E6"):
        out.append("battery complaints are explicit here, so inference from implicit wording is only weakly tested")
    return out


def write(labels):
    from openpyxl import load_workbook
    wbp = os.path.join(ROOT, "02_golden_dataset_v1.xlsx")
    wb = load_workbook(wbp)
    ws = wb["Items"]
    by = {l["item_id"]: l for l in labels}
    ITEMS = {json.loads(x)["item_id"]: json.loads(x) for x in open(os.path.join(ROOT, "data", "items_inputs.jsonl"), encoding="utf-8")}
    for r in range(2, 42):
        lb = by[ws.cell(row=r, column=1).value]
        conf = [f"{c['aspect']}: {', '.join(c['a'])} vs {', '.join(c['b'])} | " + (f"explained: {c['cause']}" if c["status"] == "explained" else "unresolved") for c in lb["conflicts"]]
        vals = {8: ", ".join(lb["applicable"]), 9: ", ".join(lb["not_applicable"]),
                10: "\n".join(f"{a}: {', '.join(i)}" for a, i in lb["dealbreakers"].items()) or None,
                11: "\n".join(f"{a}: {', '.join(i)}" for a, i in lb["watchouts"].items()) or None,
                12: "\n".join(conf) or None, 13: ", ".join(lb["gaps"]) or None, 14: lb["confidence"], 15: lb["why"],
                16: "Claude (AI-drafted, not human-verified)", 17: None, 18: None, 19: "Labelling"}
        for col, v in vals.items():
            ws.cell(row=r, column=col, value=v)
        gaps_ = blueprint_gaps(ITEMS[lb["item_id"]], lb)
        if gaps_:
            ws.cell(row=r, column=20, value=(ws.cell(row=r, column=20).value or "") + " Label outcome: " + "; ".join(gaps_) + ".")
    wb.save(wbp)
    print("wrote labels to", wbp)


if __name__ == "__main__":
    main()
