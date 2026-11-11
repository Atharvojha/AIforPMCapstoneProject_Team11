"""Advisor: the two things a student actually does.

1. advise(text)  : free-text needs -> what we understood -> recommended numbers (RAM, storage, ...) with reasons -> laptops ranked, with a
                   rating for every category.
2. check_free_claim(text): a claim with NO laptop chosen ('ASUS laptops are bad at battery', 'I want a laptop with good battery').

Plain rules, no model at request time. The model's only job (reading reviews into topic votes) happens earlier in topic_reader.py.
Every number here is either read from stored data or is a labelled rule of thumb."""
from __future__ import annotations

import math
import re
import sqlite3

from . import claim_checker as cc
from . import compare as compare_mod
from . import fit_engine as fe
from . import text_utils as tu
from .topic_reader import TOPICS, VERSION, votes_conn

TOPIC_LABEL = {"performance": "Speed", "memory": "Memory (RAM)", "battery": "Battery", "display": "Screen", "thermals_noise": "Heat and fan noise",
               "portability": "Weight and size", "keyboard_trackpad": "Keyboard and touchpad", "build_reliability": "Build and durability",
               "value": "Value for money", "ports_connectivity": "Ports and Wi-Fi"}
USE_LABEL = {"programming": "coding", "college_research": "studies and research", "design_video": "design and video editing", "gaming": "gaming",
             "ai_ml": "AI and machine learning", "office": "everyday use (browsing, documents, meetings)"}

# ----------------------------------------------------------------------------------------------------------- understanding text
USE_RX = {
    "programming": r"\bcod(e|ing|er)\b|\bcse?\b|computer science|software engineer|backend|frontend|full.?stack|programm|developer|development|software|python|\bjava\b|web dev|leetcode|compile|android studio|vs ?code|devops|docker",
    "college_research": r"\bstud(y|ies|ent|ents)\b|undergrad|\bgrad(uate)?\b|b\.?tech|m\.?tech|\bphd\b|engineering college|college|universit|assignment|research|lecture|online class|thesis|engineering student|school",
    "design_video": r"video edit|edit(?:ing)? (?:my |some )?videos?|editing|premiere|davinci|photoshop|illustrator|\bdesign|figma|animation|\b3d\b|render|after effects|lightroom|photo edit",
    "gaming": r"\bgam(e|es|ing|er)\b|valorant|bgmi|gta|fortnite|cs ?go|esports|\bfps\b|call of duty",
    "ai_ml": r"machine learning|\bml\b|deep learning|\bai\b|data science|neural|tensorflow|pytorch|\bllms?\b|train(ing)? models",
    "office": r"office|work from home|\bwfh\b|for work\b|my work\b|work laptop|documents?|excel|powerpoint|zoom|meetings?|browsing|youtube|netflix|movies|everyday|daily use|casual|e-?mail|ms word|basic",
}
PRIORITY_RX = {
    "performance": r"\bspeed\b|\bfast\b|quick|snappy|smooth|performance|powerful|\blag|multitask",
    "battery": r"battery|backup|long.?lasting|all day|unplugged|\bcharge",
    "display": r"screen|display|bright|colou?r|\boled\b|resolution|sharp|\bips\b",
    "portability": r"light.?weight|\blight\b|portable|carry|travel|commut|\bslim\b|\bthin\b|compact",
    "keyboard_trackpad": r"keyboard|typing|trackpad|touchpad",
    "thermals_noise": r"quiet|silent|\bcool\b|heat|noise|\bfan\b|thermal|throttl|temperature|overheat|\bhot\b",
    "build_reliability": r"durable|sturdy|build quality|reliab|long.?term|last (for )?(many )?years|rugged",
    "value": r"value for money|\bvalue\b|cheap|affordable|economical|worth",
}
BRAND_RX = {"ASUS": r"\basus\b|\btuf\b|\brog\b|vivobook|zenbook", "HP": r"\bhp\b|pavilion|\bomen\b|\bvictus\b", "LENOVO": r"lenovo|ideapad|thinkpad|\blegion\b",
            "MSI": r"\bmsi\b", "APPLE": r"apple|macbook|\bmac\b|\bm1\b|\bm2\b", "DELL": r"\bdell\b|inspiron|latitude|alienware", "ACER": r"\bacer\b|aspire|nitro|predator", "MICROSOFT": r"microsoft|\bsurface\b"}
BRAND_NAME = {"ASUS": "ASUS", "HP": "HP", "LENOVO": "Lenovo", "MSI": "MSI", "APPLE": "Apple", "DELL": "Dell", "ACER": "Acer", "MICROSOFT": "Microsoft"}
_UNIT = {"k": 1e3, "thousand": 1e3, "lakh": 1e5, "lakhs": 1e5, "lac": 1e5, "lacs": 1e5}
_NOT_MONEY = r"(?!\s*(?:gb|tb|kg|hz|inch|inches|in\b|hours?|hrs?|h\b|wh|nits|mb|%|mah|gen\b))"
R_MONEY = re.compile(r"(?<![\w.])(?:₹|rs\.?\s*|inr\s*)?(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?)?\b" + _NOT_MONEY, re.IGNORECASE)
R_RANGE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?)\b", re.IGNORECASE)
R_RAM = re.compile(r"(\d{1,3})\s*gb\s*(?:of\s*)?(?:ram|memory)|(?:ram|memory)\s*(?:of\s*)?(\d{1,3})\s*gb", re.IGNORECASE)
R_STORE = re.compile(r"(\d+(?:\.\d+)?)\s*(gb|tb)\s*(?:ssd|storage|hard ?disk|nvme)", re.IGNORECASE)
R_KG = re.compile(r"(\d(?:\.\d+)?)\s*kgs?\b", re.IGNORECASE)
R_HOURS = re.compile(r"(\d{1,2})\s*(?:\+\s*)?(?:hours?|hrs?)\b", re.IGNORECASE)
R_AVOID = re.compile(r"(?:not|no|avoid|except|without|hate|dislike|don'?t (?:want|like)|anything but)\s+(?:an?\s+|any\s+)?$", re.IGNORECASE)


def _money(text: str) -> dict:
    out: dict = {}
    m = R_RANGE.search(text)
    if m:
        u = _UNIT[m.group(3).lower()]
        lo, hi = float(m.group(1)) * u, float(m.group(2)) * u
        if 15000 <= hi <= 500000:
            return {"min": lo, "max": hi}
    vals = []
    for m in R_MONEY.finditer(text):
        raw, unit = m.group(1).replace(",", ""), (m.group(2) or "").lower()
        v = float(raw) * _UNIT.get(unit, 1)
        explicit = bool(unit) or "," in m.group(1) or text[max(0, m.start() - 4):m.start()].lower().strip().endswith(("₹", "rs", "rs.", "inr"))
        if 15000 <= v <= 500000 and (explicit or v >= 20000):
            vals.append((v, text[max(0, m.start() - 16):m.start()].lower()))
    if vals:
        v, pre = vals[0]
        out["max"] = v
    return out


CANNOT_CHECK = {"Linux support": r"linux|ubuntu|fedora|\barch\b|dual.?boot", "Thunderbolt / USB4 ports": r"thunderbolt|usb ?4", "OLED screens": r"\boled\b", "4K screens": r"\b4k\b",
                "Touchscreen or 2-in-1": r"touch ?screen|2.in.1|convertible|stylus", "Fingerprint reader": r"fingerprint", "Webcam quality": r"webcam|camera", "Wi-Fi 6 / 6E": r"wi-?fi ?6",
                "Virtualisation (VMs)": r"virtuali[sz]ation|\bvms?\b|\bkvm\b|virtualbox|vmware", "Speakers and audio": r"speakers?|audio|sound"}


def parse_needs(text: str) -> dict:
    t = text.strip()
    low = t.lower()
    uses = [u for u, rx in USE_RX.items() if re.search(rx, low)]
    # 'office' is the weakest signal: when something more specific is present, keep it only if the person used real office words
    if len(uses) > 1 and "office" in uses and not re.search(r"office|work from home|\bwfh\b|for work\b|my work\b|excel|powerpoint|documents?|meetings?|\bzoom\b", low):
        uses.remove("office")
    if len(uses) > 1 and "office" in uses and re.search(r"\bzoom\b|online class", low) and ("college_research" in uses):
        uses.remove("office")
    prios = [p for p, rx in PRIORITY_RX.items() if re.search(rx, low)]
    like, avoid = [], []
    for b, rx in BRAND_RX.items():
        for m in re.finditer(rx, low):
            (avoid if R_AVOID.search(low[max(0, m.start() - 22):m.start()]) else like).append(b)
            break
    like = [b for b in like if b not in avoid]
    hard: dict = {}
    mm = R_RAM.search(low)
    if mm:
        hard["ram_gb_min"] = float(mm.group(1) or mm.group(2))
    ms = R_STORE.search(low)
    if ms:
        hard["storage_gb_min"] = float(ms.group(1)) * (1000 if ms.group(2).lower() == "tb" else 1)
    mk = R_KG.search(low)
    if mk:
        hard["weight_kg_max"] = float(mk.group(1))
    budget = _money(low)
    if "max" in budget:
        hard["budget_inr_max"] = budget["max"]
    mh = R_HOURS.search(low)
    if mh and re.search(r"battery|backup|last|charge", low):
        hard["battery_h_min"] = float(mh.group(1))
    if not uses and not prios and not hard and not like:
        uses = []
    cannot = [label for label, rx in CANNOT_CHECK.items() if re.search(rx, low)]
    nvidia = bool(re.search(r"cuda|nvidia|\brtx\b|geforce", low))
    understood = []
    if uses:
        understood.append("You will use it for " + ", ".join(USE_LABEL[u] for u in uses) + ".")
    if prios:
        understood.append("You care most about " + ", ".join(TOPIC_LABEL[p].lower() for p in prios) + ".")
    if budget.get("max"):
        understood.append(f"Your budget is about ₹{budget['max']:,.0f}" + (f" (from ₹{budget['min']:,.0f})" if budget.get("min") else "") + ".")
    if "ram_gb_min" in hard:
        understood.append(f"You asked for at least {hard['ram_gb_min']:g} GB RAM.")
    if "weight_kg_max" in hard:
        understood.append(f"You want it under {hard['weight_kg_max']:g} kg.")
    if like:
        understood.append("You mentioned " + ", ".join(BRAND_NAME[b] for b in like) + ".")
    if avoid:
        understood.append("You want to avoid " + ", ".join(BRAND_NAME[b] for b in avoid) + ".")
    if nvidia:
        understood.append("You want NVIDIA graphics (CUDA).")
    if cannot:
        understood.append("We can't check these for you yet, so check them yourself: " + ", ".join(cannot) + ".")
    return {"text": t, "cannot_check": cannot, "needs_nvidia": nvidia, "uses": uses, "priorities": prios, "budget": budget, "hard": hard, "brands_like": like, "brands_avoid": avoid, "understood": understood}


# ----------------------------------------------------------------------------------------------------------- recommended numbers
# Rules of thumb (NOT measured by us). Each rule: attribute -> (minimum, comfortable, reason).
SPEC_RULES: dict[str, dict] = {
    "programming": {"ram_gb": (8, 16, "A code editor, browser tabs, and tools like Docker or an emulator use 8 GB quickly. 16 GB stays smooth."),
                    "storage_gb": (256, 512, "Projects, libraries and virtual machines fill 256 GB fast."), "cpu_tier": (2, 3, "Compiling and running tests is processor work.")},
    "college_research": {"ram_gb": (8, 8, "8 GB handles notes, browser tabs, video calls and documents."), "storage_gb": (256, 512, "Course files and recordings add up."),
                         "battery_h": (6, 8, "So a full college day works without hunting for a socket."), "weight_kg_max": (2.0, 1.7, "You will carry it every day.")},
    "design_video": {"ram_gb": (16, 32, "Video and photo editors keep large files in memory."), "storage_gb": (512, 1000, "Video files are large."),
                     "cpu_tier": (3, 4, "Exporting video is heavy processor work."), "gpu": (1, 1, "A dedicated graphics chip (or Apple’s M-series chip) speeds up editing and export.")},
    "gaming": {"ram_gb": (16, 16, "Modern games run best with 16 GB."), "storage_gb": (512, 1000, "Games are 50 to 150 GB each."), "cpu_tier": (3, 4, "Games need a strong processor."),
               "gpu": (1, 1, "A dedicated graphics card is the most important part for games."), "refresh_hz": (120, 144, "A 120–144 Hz screen makes fast games look smoother.")},
    "ai_ml": {"ram_gb": (16, 32, "Datasets and models are loaded into memory."), "storage_gb": (512, 1000, "Datasets and models are large."),
              "cpu_tier": (3, 4, "Data preparation is processor work."), "gpu": (1, 1, "Training on a graphics card is many times faster than on the processor, and NVIDIA (CUDA) works on both Windows and Linux; AMD cards only on Linux.")},
    "office": {"ram_gb": (8, 8, "8 GB is plenty for browsing, documents and meetings."), "storage_gb": (256, 512, "Enough for documents and photos."),
               "battery_h": (6, 8, "So it lasts through meetings away from a socket."), "weight_kg_max": (2.2, 1.8, "Lighter is easier to carry around."), "cpu_tier": (1, 2, "Everyday tasks do not need a fast processor.")},
}
# Public vendor numbers checked 2026-11-11 by Claude (not by a person). Only facts a page actually states; the rest stay "rule of thumb".
SRC = {
    "docker": {"label": "Docker Desktop on Windows: 8 GB RAM", "url": "https://docs.docker.com/desktop/setup/install/windows-install/"},
    "android": {"label": "Android Studio: 8 GB minimum, 16 GB with the emulator, 32 GB recommended", "url": "https://developer.android.com/studio/install"},
    "premiere": {"label": "Adobe Premiere Pro: 8 GB base, 16 GB for HD, 32 GB or more for 4K", "url": "https://helpx.adobe.com/premiere-pro/system-requirements.html"},
    "bg3": {"label": "Baldur's Gate 3 on Steam: 16 GB RAM recommended, 150 GB SSD", "url": "https://store.steampowered.com/app/1086940/"},
    "win11": {"label": "Windows 11 minimum: 4 GB RAM, 64 GB storage", "url": "https://www.microsoft.com/en-us/windows/windows-11-specifications"},
    "torch": {"label": "PyTorch: CUDA builds run on Windows and Linux; AMD ROCm builds only on Linux", "url": "https://pytorch.org/get-started/locally/"},
}
SOURCED = {("programming", "ram_gb"): ["docker", "android"], ("design_video", "ram_gb"): ["premiere"], ("gaming", "ram_gb"): ["bg3"], ("gaming", "storage_gb"): ["bg3"],
           ("office", "ram_gb"): ["win11"], ("college_research", "ram_gb"): ["win11"], ("ai_ml", "gpu"): ["torch"]}
LABELS = {"ram_gb": ("Memory (RAM)", "GB"), "storage_gb": ("Storage (SSD)", "GB"), "cpu_tier": ("Processor level", ""), "gpu": ("Graphics", ""),
          "refresh_hz": ("Screen refresh rate", "Hz"), "battery_h": ("Battery in real use", "hours"), "weight_kg_max": ("Weight", "kg")}
CPU_NAME = {1: "basic (Celeron, Core i3, Ryzen 3)", 2: "mid (Core i5 U-series, Ryzen 5 U-series)", 3: "strong (Core i5/i7 H-series, Ryzen 5/7 H-series, Apple M-series)", 4: "very strong (Core i7/i9 H, Ryzen 7/9, Apple M-Pro)"}


USE_SHORT = {"programming": "Coding", "college_research": "Studies", "design_video": "Design and video", "gaming": "Gaming", "ai_ml": "AI and ML", "office": "Everyday use"}


def cpu_tier(cpu: str | None) -> int | None:
    if not cpu:
        return None
    c = cpu.lower()
    if re.search(r"apple|\bm[1-9]\b", c):
        return 3
    if re.search(r"celeron|pentium|athlon|\bi3\b|core i3|ryzen 3|\br3\b", c):
        return 1
    if re.search(r"i9|core i7|\bi7\b|ryzen 9|\br9\b|ryzen 7|\br7\b", c):
        return 4
    if re.search(r"\bh\b|\d{4}h|hx|hexa core amd r5-?\d{4}h|r5-?\d{4}h|ryzen 5 \d{4}h", c):
        return 3
    if re.search(r"core i5|\bi5\b|ryzen 5|\br5\b", c):
        return 3 if re.search(r"1[0-3]th gen", c) and re.search(r"gaming|\bh\b", c) else 2
    return None


def recommend_specs(needs: dict) -> list[dict]:
    uses = needs["uses"] or ["office"]
    best: dict[str, dict] = {}
    for u in uses:
        for attr, (lo, ideal, why) in SPEC_RULES[u].items():
            cur = best.setdefault(attr, {"minimum": lo, "ideal": ideal, "rules": [], "why": [], "for": []})
            pick = min if attr == "weight_kg_max" else max
            cur["minimum"], cur["ideal"] = pick(cur["minimum"], lo), pick(cur["ideal"], ideal)
            cur["rules"].append((u, lo, ideal, why))
    for attr, cur in best.items():          # keep only the reasons from the use(s) that actually set the number (no "16 GB" next to "8 GB")
        winners = [(u, why) for u, lo, ideal, why in cur["rules"] if ideal == cur["ideal"]] or [(cur["rules"][0][0], cur["rules"][0][3])]
        cur["why"] = [f"{USE_SHORT[u]}: {why}" for u, why in winners[:2]]
        cur["for"] = [u for u, _ in winners]
    p = needs["priorities"]
    if "performance" in p:
        r = best.setdefault("ram_gb", {"minimum": 8, "ideal": 16, "why": [], "for": []})
        r["ideal"], r["minimum"] = max(r["ideal"], 16), max(r["minimum"], 8)
        r["why"].insert(0, "You said speed matters: 16 GB RAM and an SSD are the two cheapest changes that make a laptop feel faster.")
        c = best.setdefault("cpu_tier", {"minimum": 2, "ideal": 3, "why": [], "for": []})
        c["minimum"], c["ideal"] = max(c["minimum"], 2), max(c["ideal"], 3)
        c["why"].insert(0, "You said speed matters: pick a mid or strong processor.")
    if "battery" in p:
        b = best.setdefault("battery_h", {"minimum": 6, "ideal": 8, "why": [], "for": []})
        b["minimum"], b["ideal"] = max(b["minimum"], 7), max(b["ideal"], 9)
        b["why"].insert(0, "You said battery matters. Ultrabooks and Apple M-series laptops last longest; gaming laptops last 3–5 hours.")
    if "portability" in p:
        w = best.setdefault("weight_kg_max", {"minimum": 2.0, "ideal": 1.7, "why": [], "for": []})
        w["minimum"], w["ideal"] = min(w["minimum"], 1.8), min(w["ideal"], 1.5)
        w["why"].insert(0, "You said you carry it: under 1.8 kg is easy, under 1.5 kg is very light.")
    if needs.get("needs_gpu") is True and "gpu" not in best:
        best["gpu"] = {"minimum": 1, "ideal": 1, "why": ["You asked for a dedicated graphics chip."], "for": []}
    if needs.get("needs_gpu") is False:
        best.pop("gpu", None)
    if needs.get("needs_nvidia") and "gpu" not in best:
        best["gpu"] = {"minimum": 1, "ideal": 1, "why": ["You asked for NVIDIA graphics: CUDA (used by PyTorch and TensorFlow) only runs on NVIDIA."], "for": []}
    h = needs["hard"]
    out = []
    for attr, r in best.items():
        label, unit = LABELS[attr]
        srcs = list(dict.fromkeys(k for u in r.get("for", []) for k in SOURCED.get((u, attr), [])))
        mine = {"ram_gb": h.get("ram_gb_min"), "storage_gb": h.get("storage_gb_min"), "weight_kg_max": h.get("weight_kg_max"), "battery_h": h.get("battery_h_min")}.get(attr)
        out.append({"key": attr, "label": label, "unit": unit, "minimum": r["minimum"], "ideal": r["ideal"], "you_asked": mine, "why": " ".join(r["why"][:2]),
                    "text": _rec_text(attr, r, unit), "kind": "rule of thumb" if not srcs else "checked against vendor pages",
                    "sources": [SRC[k] for k in srcs]})
    order = ["ram_gb", "cpu_tier", "gpu", "storage_gb", "refresh_hz", "battery_h", "weight_kg_max"]
    out.sort(key=lambda x: order.index(x["key"]))
    return out


def _rec_text(attr, r, unit):
    if attr == "cpu_tier":
        return f"at least {CPU_NAME[int(r['minimum'])]}; better: {CPU_NAME[int(r['ideal'])]}"
    if attr == "gpu":
        return "a dedicated graphics chip (or an Apple M-series laptop)"
    if attr == "weight_kg_max":
        return f"under {r['minimum']:g} kg; ideally under {r['ideal']:g} kg"
    def f(v):
        return f"{v / 1000:g} TB" if attr == "storage_gb" and v >= 1000 else f"{v:g} {unit}"
    return f"at least {f(r['minimum'])}; comfortable at {f(r['ideal'])}"


# ----------------------------------------------------------------------------------------------------------- ratings from owner reviews
def wilson_lb(p: float, n: int, z: float = 1.96) -> float:
    if n == 0:
        return 0.0
    d = 1 + z * z / n
    return (p + z * z / (2 * n) - z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / d


def _vc():
    return votes_conn()


def topic_stats(votes, variant_ids: list[str] | None = None) -> dict[str, dict[str, dict]]:
    """{variant: {topic: {pos, neg, mixed, n, share, lb}}}. share = (pos + half of mixed) / n."""
    out: dict[str, dict] = {}
    q = f"SELECT variant_id, topic, opinion, COUNT(*) c FROM topic_votes WHERE version='{VERSION}' GROUP BY 1,2,3"
    for r in votes.execute(q):
        if variant_ids and r["variant_id"] not in variant_ids:
            continue
        d = out.setdefault(r["variant_id"], {}).setdefault(r["topic"], {"pos": 0, "neg": 0, "mixed": 0})
        d[{"positive": "pos", "negative": "neg", "mixed": "mixed"}[r["opinion"]]] += r["c"]
    for v in out.values():
        for d in v.values():
            n = d["pos"] + d["neg"] + d["mixed"]
            d["n"], d["share"] = n, (d["pos"] + 0.5 * d["mixed"]) / n
            d["lb"] = wilson_lb(d["share"], n)
    return out


def rating_label(d: dict | None) -> tuple[str, str]:
    """(label, tone). Plain words; 'Not enough reviews' under 3."""
    if not d or d["n"] < 3:
        return "Not enough reviews", "unk"
    if d["share"] >= 0.75:
        return "Great", "ok"
    if d["share"] >= 0.5:
        return "Mixed", "mix"
    return "Weak", "bad"


def laptop_ratings(conn, variant_id: str) -> list[dict]:
    """Topic ratings for ONE laptop (no needs involved): same numbers as the ranked list, for the laptop detail page."""
    st = topic_stats(_vc()).get(variant_id, {})
    out = []
    for t in TOPICS:
        d = st.get(t)
        label, tone = rating_label(d)
        out.append({"topic": t, "label": TOPIC_LABEL[t], "rating": label, "tone": tone, "happy_pct": round(100 * d["share"]) if d and d["n"] >= 3 else None,
                    "n": d["n"] if d else 0, "weight": 1.0 if d and d["n"] else 0.0, "lb": round(100 * d["lb"]) if d and d["n"] >= 3 else None,
                    "happy": d["pos"] if d else 0, "unhappy": d["neg"] if d else 0})
    return sorted(out, key=lambda c: -c["n"])


def reading_progress(conn, votes) -> dict:
    from .topic_reader import pending
    left_in = sum(len(pending(conn, votes, r[0])) for r in conn.execute("SELECT id FROM laptop_variants WHERE catalogue_set='flipkart14'"))
    left_us = sum(len(pending(conn, votes, r[0])) for r in conn.execute("SELECT id FROM laptop_variants WHERE catalogue_set='well_evidenced'"))
    done = votes.execute("SELECT COUNT(*) FROM topic_done WHERE version=?", (VERSION,)).fetchone()[0]
    return {"reviews_read": done, "reviews_left": left_in + left_us, "complete": left_in == 0, "extra_left": left_us}


# ----------------------------------------------------------------------------------------------------------- catalogue facts
def _catalogue(conn, india_only: bool = False) -> list[dict]:
    rows = conn.execute("""SELECT lv.id, lv.display_name, lv.review_count, lv.catalogue_set, lm.brand FROM laptop_variants lv JOIN laptop_models lm ON lm.id=lv.model_id
                           WHERE lv.catalogue_set!='live_researched' ORDER BY lv.id""").fetchall()
    out = []
    for r in rows:
        sp = {a: compare_mod._spec_value(conn, r["id"], a) for a in ("ram_upgradeable", "price_inr", "price_usd", "ram_gb", "storage_gb", "weight_kg", "battery_wh", "refresh_hz", "cpu", "gpu", "display_size_in")}
        val = {k: (v["value"] if v else None) for k, v in sp.items()}
        out.append({"id": r["id"], "name": r["display_name"], "brand": r["brand"].upper(), "reviews": r["review_count"], "spec": val,
                    "market": "US" if r["catalogue_set"] == "well_evidenced" else "IN"})
    seen: dict[str, list[dict]] = {}
    for x in out:
        seen.setdefault(x["name"], []).append(x)
    for name, group in seen.items():                       # two listings with the same title (different graphics/price): make them tell-apart-able
        if len(group) > 1:
            for x in group:
                gpu = str(x["spec"]["gpu"] or "").replace("NVIDIA GeForce ", "").replace("AMD Radeon ", "")
                diff = len({str(g["spec"]["gpu"]) for g in group}) > 1
                price = _num(x["spec"]["price_inr"])
                x["name"] = f"{name} · {gpu}" if diff and gpu else f"{name} · ₹{price:,.0f}" if price else name
    return [x for x in out if x["market"] == "IN"] if india_only else out


def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _has_gpu(g) -> bool | None:
    if g is None:
        return None
    return bool(re.search(r"nvidia|geforce|rtx|gtx|radeon rx|\brx ?\d|arc a\d|m1|m2", str(g), re.IGNORECASE)) or None if not re.search(r"integrated|intel (uhd|iris)|radeon graphics|vega", str(g), re.IGNORECASE) else False


def spec_lines(lap: dict) -> list[dict]:
    """The specs a laptop nerd looks at first, in plain words. Missing values are shown as 'not listed', never guessed."""
    s = lap["spec"]

    def f(v, unit="", nd=None):
        return "not listed" if v in (None, "") else (f"{_num(v):g} {unit}".strip() if _num(v) is not None else str(v))
    ram = f(s["ram_gb"], "GB")
    up = s.get("ram_upgradeable")
    screen = " · ".join(x for x in (f"{_num(s['display_size_in']):g} in" if _num(s["display_size_in"]) else None, f"{_num(s['refresh_hz']):g} Hz" if _num(s["refresh_hz"]) else None) if x) or "not listed"
    return [{"label": "Processor", "value": f(s["cpu"])}, {"label": "Graphics", "value": f(s["gpu"])},
            {"label": "Memory", "value": ram + (f" · upgrade: {up}" if up else "")}, {"label": "Storage", "value": f(s["storage_gb"], "GB SSD")},
            {"label": "Screen", "value": screen}, {"label": "Weight", "value": f(s["weight_kg"], "kg")}, {"label": "Battery size", "value": f(s["battery_wh"], "Wh")}]


def spec_checks(lap: dict, recs: list[dict], needs: dict) -> list[dict]:
    s, h, checks = lap["spec"], needs["hard"], []

    def add(label, need, have, ok, hard=False):
        checks.append({"label": label, "need": need, "have": have, "status": "unknown" if ok is None else "ok" if ok else "miss", "hard": hard})
    price, ram, sto, wt = _num(s["price_inr"]), _num(s["ram_gb"]), _num(s["storage_gb"]), _num(s["weight_kg"])
    if "budget_inr_max" in h:
        add("Price", f"up to ₹{h['budget_inr_max']:,.0f}", f"₹{price:,.0f}" if price else "not known", None if price is None else price <= h["budget_inr_max"], True)
    for r in recs:
        k = r["key"]
        if k == "ram_gb":
            need = h.get("ram_gb_min") or r["minimum"]
            add("Memory (RAM)", f"at least {need:g} GB" + ("" if h.get("ram_gb_min") else " (our suggestion)"), f"{ram:g} GB" if ram else "not known", None if ram is None else ram >= need, bool(h.get("ram_gb_min")))
        elif k == "storage_gb":
            need = h.get("storage_gb_min") or r["minimum"]
            add("Storage", f"at least {need:g} GB" + ("" if h.get("storage_gb_min") else " (our suggestion)"), f"{sto:g} GB" if sto else "not known", None if sto is None else sto >= need, bool(h.get("storage_gb_min")))
        elif k == "weight_kg_max":
            need = h.get("weight_kg_max") or r["minimum"]
            add("Weight", f"under {need:g} kg" + ("" if h.get("weight_kg_max") else " (our suggestion)"), f"{wt:g} kg" if wt else "not known", None if wt is None else wt <= need, bool(h.get("weight_kg_max")))
        elif k == "cpu_tier":
            t = cpu_tier(s["cpu"])
            add("Processor", CPU_NAME[int(r["minimum"])].split(" (")[0] + " or better", str(s["cpu"] or "not known"), None if t is None else t >= r["minimum"])
        elif k == "gpu":
            g = _has_gpu(s["gpu"])
            if needs.get("needs_nvidia"):
                apple = s["gpu"] is None and bool(re.search(r"apple|\bm[1-9]\b", str(s["cpu"] or ""), re.I))      # Apple silicon: integrated graphics, no CUDA
                add("Graphics", "NVIDIA graphics (for CUDA)", "Apple integrated graphics (no CUDA)" if apple else str(s["gpu"] or "not known"),
                    False if apple else None if s["gpu"] is None else bool(re.search(r"nvidia|geforce|rtx|gtx", str(s["gpu"]), re.I)), True)
            else:
                add("Graphics", "dedicated graphics (or Apple M-series)", str(s["gpu"] or "not known"), None if s["gpu"] is None else bool(g))
        elif k == "refresh_hz":
            hz = _num(s["refresh_hz"])
            add("Screen refresh rate", f"at least {r['minimum']:g} Hz", f"{hz:g} Hz" if hz else "not known", None if hz is None else hz >= r["minimum"])
    return checks


LEVEL_NAME = ["Don't care", "Nice to have", "Important", "Must have"]
LEVEL_WEIGHT = {0: 0.0, 1: 1.0, 2: 2.5, 3: 5.0}
HARD_KEYS = ("budget_inr_max", "ram_gb_min", "storage_gb_min", "weight_kg_max", "battery_h_min")


def apply_overrides(needs: dict, ov: dict | None) -> dict:
    """The student edits the sheet (uses, how much each topic matters, their own numbers, brands to avoid). Edits win over what we read from the text."""
    if not ov:
        return needs
    n = {**needs, "hard": dict(needs["hard"]), "uses": list(needs["uses"]), "priorities": list(needs["priorities"]), "brands_avoid": list(needs["brands_avoid"])}
    if ov.get("uses") is not None:
        n["uses"] = [u for u in ov["uses"] if u in USE_LABEL]
    if ov.get("importance"):
        n["importance"] = {t: max(0, min(3, int(v))) for t, v in ov["importance"].items() if t in TOPICS}
        n["priorities"] = [t for t in ("performance", "battery", "portability") if n["importance"].get(t) == 3]
    for k, v in (ov.get("hard") or {}).items():
        if k in HARD_KEYS:
            if v is None:
                n["hard"].pop(k, None)
            else:
                n["hard"][k] = float(v)
    if ov.get("brands_avoid") is not None:
        n["brands_avoid"] = [b for b in ov["brands_avoid"] if b in BRAND_NAME]
    if ov.get("needs_gpu") is not None:
        n["needs_gpu"] = bool(ov["needs_gpu"])
    return n


def use_weights(needs: dict) -> dict[str, float]:
    if needs.get("importance"):                                  # the student set each topic by hand
        raw = {t: LEVEL_WEIGHT[needs["importance"].get(t, 1)] for t in TOPICS}
        tot = sum(raw.values()) or 1
        return {t: v / tot for t, v in raw.items()}
    w: dict[str, float] = {t: 0.0 for t in TOPICS}
    uses = needs["uses"] or ["office"]
    for u in uses:
        for k, v in fe.WORKLOAD_WEIGHTS[u].items():
            if k in w:
                w[k] += v / len(uses)
    for p in needs["priorities"]:
        if p in w:
            w[p] += 25
    s = sum(w.values()) or 1
    return {k: v / s for k, v in w.items()}


def advise(conn: sqlite3.Connection, text: str, overrides: dict | None = None) -> dict:
    needs = apply_overrides(parse_needs(text), overrides)
    recs = recommend_specs(needs)
    votes = _vc()
    stats = topic_stats(votes)
    w = use_weights(needs)
    laps = []
    for lap in _catalogue(conn, india_only=True):      # US (Amazon) laptops are extra evidence for claims, never recommended to an Indian buyer
        if lap["brand"] in needs["brands_avoid"]:
            continue
        st = stats.get(lap["id"], {})
        cats = []
        for t in TOPICS:
            d = st.get(t)
            label, tone = rating_label(d)
            cats.append({"topic": t, "label": TOPIC_LABEL[t], "rating": label, "tone": tone, "happy_pct": round(100 * d["share"]) if d and d["n"] >= 3 else None,
                         "n": d["n"] if d else 0, "weight": round(w[t], 3), "lb": round(100 * d["lb"]) if d and d["n"] >= 3 else None,
                         "happy": d["pos"] if d else 0, "unhappy": d["neg"] if d else 0})
        usable = [c for c in cats if c["happy_pct"] is not None and c["weight"] > 0]
        cov = sum(c["weight"] for c in usable)
        score = (sum(c["weight"] * wilson_lb(st[c["topic"]]["share"], st[c["topic"]]["n"]) for c in usable) / cov) if cov else None
        checks = spec_checks(lap, recs, needs)
        hard_miss = [c for c in checks if c["status"] == "miss" and c["hard"]]
        soft_miss = [c for c in checks if c["status"] == "miss" and not c["hard"]]
        misses = hard_miss + soft_miss
        reasons = []
        for c in sorted(usable, key=lambda c: -c["weight"])[:3]:
            reasons.append(f"{c['label']}: {c['happy_pct']}% of {c['n']} owners were happy")
        warnings = [f"{c['label']}: only {c['happy_pct']}% of {c['n']} owners were happy" for c in cats
                    if c["weight"] >= 0.12 and c["happy_pct"] is not None and c["happy_pct"] < 50 and c["n"] >= 5]
        laps.append({"id": lap["id"], "warnings": warnings, "name": lap["name"], "brand": BRAND_NAME.get(lap["brand"], lap["brand"].title()), "price_inr": _num(lap["spec"]["price_inr"]),
                     "reviews": lap["reviews"], "categories": cats, "checks": checks, "misses": len(hard_miss), "soft_misses": len(soft_miss), "unknown": sum(c["status"] == "unknown" for c in checks),
                     "score": None if score is None or cov < 0.5 else round(100 * score), "coverage": round(cov, 2), "why": reasons, "specs": spec_lines(lap),
                     "liked_brand": lap["brand"] in needs["brands_like"]})
    laps.sort(key=lambda x: (x["misses"], x["soft_misses"], -(x["score"] if x["score"] is not None else -1), not x["liked_brand"]))
    for x in laps:
        hard = [c["label"] for c in x["checks"] if c["status"] == "miss" and c["hard"]]
        soft = [c["label"] for c in x["checks"] if c["status"] == "miss" and not c["hard"]]
        warn_topics = [w.split(":")[0].lower() for w in x["warnings"]]
        x["verdict"] = (("Doesn't meet: " + ", ".join(hard)) if hard else ("Below our suggestion on " + ", ".join(soft)) if soft
                        else ("Meets your numbers, but owners are unhappy about " + ", ".join(warn_topics)) if warn_topics
                        else "Meets your numbers; too few owner reviews to rate it" if x["score"] is None else "Meets everything we checked")
        x["tone"] = "bad" if hard else "mix" if (soft or warn_topics or x["score"] is None) else "ok"
    prof = {"workloads": {u: "daily" for u in needs["uses"]} or {"office": "daily"}, "hard_requirements": needs["hard"], "priorities": needs["priorities"][:3]}
    return {"needs": needs, "recommended": recs, "laptops": laps, "profile": prof, "reading": reading_progress(conn, votes),
            "note": "Ratings come from what owners wrote in reviews. Recommended numbers are rules of thumb, not measurements."}


# ----------------------------------------------------------------------------------------------------------- the needs sheet
SHEET_CATS = [  # (key, label, what it means for the student, the spec it is tied to)
    ("performance", "Speed", "How fast it feels when you open, compile, export.", "cpu_tier"),
    ("memory", "Memory (RAM)", "How many things it can hold open before it slows down.", "ram_gb"),
    ("gpu", "Graphics", "Games, video export, model training. Owners do not rate this; we check the listing.", "gpu"),
    ("battery", "Battery", "How long it runs away from a socket.", "battery_h"),
    ("display", "Screen", "Brightness, colour, sharpness, refresh rate.", "refresh_hz"),
    ("thermals_noise", "Heat and fan noise", "How hot it gets and how loud the fan is.", None),
    ("portability", "Weight and size", "Carrying it every day.", "weight_kg_max"),
    ("keyboard_trackpad", "Keyboard and touchpad", "What you type on for hours.", None),
    ("build_reliability", "Build and durability", "Hinges, body, how it ages.", None),
    ("value", "Value for money", "What you get for the price.", None),
    ("ports_connectivity", "Ports and Wi-Fi", "Ports you need and stable Wi-Fi.", None),
    ("storage", "Storage", "Space for projects, games, videos. Owners do not rate this; we check the listing.", "storage_gb"),
]
SCALES = {"ram_gb": {"steps": [4, 8, 12, 16, 24, 32, 64], "unit": "GB", "label": "RAM"}, "storage_gb": {"steps": [128, 256, 512, 1000, 2000], "unit": "GB", "label": "Storage"},
          "battery_h": {"steps": [4, 5, 6, 7, 8, 10, 12, 14], "unit": "hours", "label": "Battery in real use"},
          "weight_kg_max": {"steps": [1.2, 1.5, 1.7, 1.8, 2.0, 2.2, 2.5, 3.0], "unit": "kg", "label": "Weight", "lower_is_better": True},
          "refresh_hz": {"steps": [60, 90, 120, 144, 165, 240], "unit": "Hz", "label": "Screen refresh rate"}, "cpu_tier": {"steps": [1, 2, 3, 4], "unit": "", "label": "Processor level"}}
HARD_OF = {"ram_gb": "ram_gb_min", "storage_gb": "storage_gb_min", "battery_h": "battery_h_min", "weight_kg_max": "weight_kg_max"}


def importance_levels(needs: dict, w: dict[str, float]) -> dict[str, tuple[int, str]]:
    """(level 0-3, why) for each owner-rated topic, from what the person typed and what their uses usually need."""
    if needs.get("importance"):
        return {k: (needs["importance"].get(k, 1), "You set this.") for k in TOPICS}
    uses = needs["uses"] or ["office"]
    out = {}
    for k in TOPICS:
        v = w.get(k, 0.0)
        lvl = 3 if k in needs["priorities"] else 2 if v >= 0.12 else 1 if v >= 0.04 else 0
        users = [USE_SHORT[u].lower() for u in uses if fe.WORKLOAD_WEIGHTS[u].get(k, 0) >= 10]
        why = "You said so." if k in needs["priorities"] else ("Usual for " + ", ".join(users) + ".") if lvl >= 2 and users else "Not a big deal for what you described." if lvl == 0 else "Good to have."
        out[k] = (lvl, why)
    return out


def needs_sheet(text: str, overrides: dict | None = None) -> dict:
    """Every category with how much it matters, the number to aim for (a source or 'rule of thumb'), and what we could not read from the text."""
    needs = apply_overrides(parse_needs(text), overrides)
    recs = {r["key"]: r for r in recommend_specs(needs)}
    lv = importance_levels(needs, use_weights(needs))
    rows = []
    for key, label, means, spec in SHEET_CATS:
        if key in lv:
            level, why = lv[key]
            if not needs.get("importance"):
                if key == "memory" and "ram_gb" in recs and level < 2:
                    level, why = 2, "Your uses need enough RAM."
                if key == "value" and needs["hard"].get("budget_inr_max") and level < 2:
                    level, why = 2, "You gave a budget."
        elif key == "gpu":
            level, why = (3, "Your uses lean on it.") if "gpu" in recs else (0, "Your uses do not need a dedicated graphics chip.")
        else:
            level, why = (2, "Your uses need it.") if spec in recs else (1, "Good to have.")
        row = {"key": key, "label": label, "means": means, "level": level, "level_name": LEVEL_NAME[level], "why": why, "owner_rated": key in TOPICS}
        r = recs.get(spec) if spec else None
        if r:
            row["number"] = {"spec": spec, "text": r["text"], "minimum": r["minimum"], "ideal": r["ideal"], "yours": needs["hard"].get(HARD_OF.get(spec, "")),
                             "why": r["why"], "kind": r["kind"], "sources": r["sources"], "scale": SCALES.get(spec)}
        rows.append(row)
    return {"needs": needs, "categories": rows, "recommended": list(recs.values()), "budget_inr_max": needs["hard"].get("budget_inr_max"),
            "uses": [{"key": u, "label": USE_LABEL[u], "on": u in needs["uses"]} for u in USE_LABEL],
            "brands": [{"key": b, "label": BRAND_NAME[b], "avoid": b in needs["brands_avoid"]} for b in BRAND_NAME],
            "note": "Numbers marked 'rule of thumb' are our suggestions, not measurements. Change a level or a number and the laptop ranking uses your change."}


# ----------------------------------------------------------------------------------------------------------- free-text claim checking
NUMERIC_WORDS = [(r"\bheavy|bulky|weigh(s|t)? (a lot|too much)", "weight_kg", "high", "Weight (kg)"), (r"\blight(weight)?\b|\bportable\b|\bslim\b", "weight_kg", "low", "Weight (kg)"),
                 (r"expensive|overpriced|costly|pricey", "price_inr", "high", "Price (₹)"), (r"\bcheap\b|affordable|budget", "price_inr", "low", "Price (₹)")]
GENERIC_Q = re.compile(r"\b(which|what|best|recommend|suggest|looking for|want|need|find me|show me)\b", re.IGNORECASE)


def _brand_of(text: str) -> str | None:
    low = text.lower()
    for b, rx in BRAND_RX.items():
        if re.search(rx, low):
            return b
    return None


MODEL_WORDS = {"vivobook", "zenbook", "ideapad", "thinkpad", "legion", "pavilion", "omen", "victus", "macbook", "tuf", "rog", "aspire", "nitro", "predator", "swift", "inspiron",
               "latitude", "xps", "alienware", "surface", "chromebook", "stream", "katana", "yoga", "flex", "spin", "envy", "elitebook", "probook"}
_NOT_MODEL_CODE = re.compile(r"\d+(?:gb|tb|hz|p|k|inch|in|nits|wh|whr|mah|kg|mm|ghz|mhz|th|nd|st|rd)|\d{4}|\d{4,5}(?:h|hs|hx|u|x|k|f|g\d)?|[ri]\d-\d{4,5}\w*|[ri][3579]")


def _named_variants(conn, text: str) -> list[str]:
    """Variants whose MODEL words or codes appear in the text ('macbook', 'ideapad 3', 'tuf f15', 'gf63', '14s'). Brand words, feature words
    ('screen', 'touch', 'laptop') and processor codes ('5600h') never count. When several variants share a model word, the ones that match
    the most model words win ('tuf f15' beats 'tuf'; 'ideapad 3' beats 'ideapad gaming')."""
    low = re.sub(r"[^a-z0-9 ]", " ", text.lower())
    words = set(low.split())
    scored: dict[str, tuple[int, set]] = {}
    for r in conn.execute("SELECT id, display_name FROM laptop_variants WHERE catalogue_set!='live_researched'"):
        toks = re.sub(r"[^a-z0-9 ]", " ", r["display_name"].lower()).split()
        matched, bonus = set(), 0
        for i, t in enumerate(toks):
            is_model = t in MODEL_WORDS or (len(t) >= 3 and any(ch.isdigit() for ch in t) and not _NOT_MODEL_CODE.fullmatch(t))
            if is_model and t in words:
                matched.add(t)
                nxt = toks[i + 1] if i + 1 < len(toks) else ""
                bonus += 1 if nxt and f"{t} {nxt}" in low else 0
        if matched:
            scored[r["id"]] = (len(matched) * 2 + bonus, matched)
    if not scored:
        return []
    top = max(v[0] for v in scored.values())
    return [vid for vid, (sc, m) in scored.items() if sc == top or not any(m & o[1] for k, o in scored.items() if o[0] > sc)]


def _pool(stats: dict, ids: list[str], topic: str) -> dict:
    """Owners pooled for the counts, but the score is the AVERAGE of each laptop's own score (laptops with at least 3 owners),
    so a model with 700 reviews cannot outweigh a brand's other models."""
    pos = neg = mixed = 0
    shares = []
    for i in ids:
        d = stats.get(i, {}).get(topic)
        if d:
            pos += d["pos"]; neg += d["neg"]; mixed += d["mixed"]
            if d["n"] >= 3:
                shares.append(d["share"])
    n = pos + neg + mixed
    return {"pos": pos, "neg": neg, "mixed": mixed, "n": n, "share": (sum(shares) / len(shares)) if shares else None, "models": len(shares)}


THERMAL_SHOWN = re.compile(r"heat|\bhot\b|warm|temperature|thermal|throttl|\bfan|noise|noisy|quiet|silent|cooling|cooler|degrees|overheat", re.IGNORECASE)


def _examples(votes, ids: list[str], topic: str, opinion: str, k: int = 3) -> list[dict]:
    q = f"SELECT review_id, variant_id, quote FROM topic_votes WHERE version='{VERSION}' AND topic=? AND opinion=? AND variant_id IN ({','.join('?' * len(ids))}) AND length(quote)>20 ORDER BY length(quote) LIMIT ?"
    rows = [dict(r) for r in votes.execute(q, [topic, opinion, *ids, 60])]
    if topic == "thermals_noise":                       # 'very cool laptop' is slang for 'awesome', not a temperature: do not show it as evidence about heat
        rows = [r for r in rows if THERMAL_SHOWN.search(r["quote"] or "")]
    # The reader gets about 1 in 8 happy/unhappy calls wrong. A quote that visibly argues the other way ('Absolutely beast ... a bit lag' filed
    # under unhappy) is the worst kind of example, so show clean ones first: agreeing words and no contradicting words.
    agree, contra = (POS_WORDS, NEG_WORDS) if opinion == "positive" else (NEG_WORDS, POS_WORDS)

    def mixedness(r):
        q = r["quote"] or ""
        return (1 if contra.search(q) else 0, 0 if agree.search(q) else 1)
    rows.sort(key=mixedness)
    clean = [r for r in rows if mixedness(r) == (0, 0)]
    return (clean if len(clean) >= k else rows)[:k]


POS_WORDS = re.compile(r"\b(good|great|excellent|amazing|awesome|best|fast|smooth|solid|sturdy|durable|worth|decent|nice|superb|impressive|reliable|comfortable|cool|quiet|silent|fanless|bright|crisp|sharp|"
                       r"premium|stunning|vivid|gorgeous|breathtaking|beautiful|long (?:battery|backup|life)|lightweight|portable|(?:super|very|so|really|ultra|incredibly) light|long.?lasting|lasts? (?:all day|long)|(?:lasts?|lasting) (?:the )?(?:whole|entire|full) day|plenty|enough|snappy|responsive|efficient)\b|stays? cool|runs? cool|no fan|no noise", re.IGNORECASE)
NEG_WORDS = re.compile(r"\b(bad|poor|terrible|awful|horrible|worst|slow|laggy|lags?|stutter\w*|flimsy|weak|insufficient|inadequate|cheap|plastic|creak\w*|dim|dull|disappointing|useless|"
                       r"unreliable|uncomfortable|short|drains?|dies|hot|heats?|heating|throttl\w*|loud|noisy|overheat\w*|warm|burns?|buggy|mushy|overrated|overkill|unusable|joke|trash)\b", re.IGNORECASE)
NEGATORS = re.compile(r"\b(not|no|never|isn'?t|aren'?t|doesn'?t|don'?t|won'?t|without|barely|hardly|hardly any)\b", re.IGNORECASE)


CLAIM_HINTS = {k: re.compile(v, re.IGNORECASE) for k, v in {
    "build_reliability": r"flimsy|sturdy|fragile|creak\w*|wobbl\w*|\bbends?\b|plasticky|rattl\w*|cheaply made|well.built|tank",
    "performance": r"\bstutter\w*|\bslow\b|\bsnappy\b|\bsluggish\b|\bresponsive\b|bottleneck|\blags?\b|\blaggy\b|\bhangs?\b|\bfreez\w*",
    "display": r"\bdim\b|washed out|\bcrisp\b|blurry|\bglare\b|\bnits\b",
    "battery": r"\bdies\b|\bdrains?\b|lasts? (?:all day|long)",
    "keyboard_trackpad": r"\bmushy\b|key travel|\bclicky\b",
    "value": r"overpriced|overrated|bargain|rip.?off|worth (?:the )?(?:money|it)"}.items()}
ADVICE = re.compile(r"overkill|\benough\b|should i|do i need|is it ok|\bworth it\b", re.IGNORECASE)


def claim_topic_and_stance(text: str):
    """(topic, stance) from the claim's own words. Topic must be one the reviews cover. stance is 'positive', 'negative' or None when the
    direction is unclear (never guessed). 'no fan' and 'stays cool' count as positive; 'throttles' and 'flimsy' as negative."""
    from .topic_reader import CAND_RX
    hits = {t: m.start() for t, rx in CAND_RX.items() if (m := rx.search(text))}
    for t, rx in CLAIM_HINTS.items():                         # words a person uses in a CLAIM that the review-reading keyword lists do not need
        if (m := rx.search(text)) and t not in hits:
            hits[t] = m.start()
    # words that name an area more reliably than the loose keyword lists
    if re.search(r"\bfan\b|noise|noisy|\bheat|\bhot\b|throttl|thermal|temperature|overheat|\bcool\b|quiet|silent|fanless", text, re.IGNORECASE):
        hits["thermals_noise"] = -1
    hits.pop("ports_connectivity", None) if len(hits) > 1 else None
    if not hits:
        return None, None
    topic = min(hits, key=hits.get)
    pos, neg = bool(POS_WORDS.search(text)), bool(NEG_WORDS.search(text))
    if pos == neg:
        return topic, None
    stance = "positive" if pos else "negative"
    if NEGATORS.search(text) and not re.search(r"no fan|no noise|fanless", text, re.IGNORECASE):
        stance = "negative" if stance == "positive" else "positive"
    return topic, stance


SPECIFIC_WORDS = ["throttl", "coil whine", "hinge", "bios", "driver", "bluetooth", "wifi", "wi-fi", "webcam", "touchpad", "backlit", "thermal paste", "undervolt", "bloatware", "linux", "ubuntu",
                  "hang", "freez", "bsod", "ssd", "fan", "heating", "overheat", "ips", "tn panel", "ghosting", "screen bleed", "dead pixel", "charger", "adapter"]


def _word_hits(conn, text: str, scope_ids: list[str]) -> dict | None:
    """The exact words nerds care about ('throttle', 'coil whine', 'hinge'): how many different owners used the word, with the sentences."""
    low = text.lower()
    word = next((w for w in SPECIFIC_WORDS if w in low), None)
    if not word:
        return None
    q = f"""SELECT id, variant_id, original_text FROM reviews WHERE variant_id IN ({','.join('?' * len(scope_ids))}) AND lower(original_text) LIKE ?
            AND flag IS NULL AND (dup_cluster_id IS NULL OR id = (SELECT MIN(r2.id) FROM reviews r2 WHERE r2.dup_cluster_id = reviews.dup_cluster_id))"""
    rows = conn.execute(q, [*scope_ids, f"%{word}%"]).fetchall()
    ex = []
    for r in rows:
        i = r["original_text"].lower().find(word)
        txt = r["original_text"]
        a, b = max(0, i - 90), min(len(txt), i + 130)
        if a > 0:
            a = txt.find(" ", a) + 1 or a                      # start and end on whole words
        if b < len(txt):
            b = txt.rfind(" ", i, b) if txt.rfind(" ", i, b) > i else b
        ex.append({"review_id": r["id"], "quote": txt[a:b].strip()})
    ex.sort(key=lambda e: -len(e["quote"]))
    return {"word": word.strip(), "reviews": len(rows), "examples": ex[:4]}


def _brands_in(text: str) -> list[str]:
    low = text.lower()
    return [b for b, rx in BRAND_RX.items() if re.search(rx, low)]


def _attr_scope(cat: list[dict], text: str):
    """Groups nerds actually talk about: 'gaming laptops', 'Ryzen laptops', 'laptops under 50k', 'light laptops'. Indian catalogue only (specs known)."""
    low = text.lower()
    if not re.search(r"laptops?|notebooks?|machines?", low):
        return None
    india = [c for c in cat if c["market"] == "IN"]
    m = re.search(r"(?:under|below|less than|cheaper than)\s*(?:rs\.?|₹)?\s*(\d+)\s*k\b", low)
    rules = [(bool(m), f"Laptops under ₹{m.group(1)}k" if m else "", lambda c: (_num(c["spec"]["price_inr"]) or 1e12) <= float(m.group(1)) * 1000 if m else False),
             (bool(re.search(r"\bgaming\b", low)), "Gaming laptops (dedicated graphics)", lambda c: _has_gpu(c["spec"]["gpu"]) is True),
             (bool(re.search(r"\bryzen\b|\bamd\b", low)), "AMD Ryzen laptops", lambda c: "ryzen" in str(c["spec"]["cpu"]).lower()),
             (bool(re.search(r"\bintel\b|core i[3579]", low)), "Intel laptops", lambda c: bool(re.search(r"core|intel|celeron", str(c["spec"]["cpu"]), re.I))),
             (bool(re.search(r"\b(?:light|lightweight|thin|slim|portable)\b", low)), "Light laptops (1.6 kg or less)", lambda c: (_num(c["spec"]["weight_kg"]) or 9) <= 1.6)]
    for hit, label, fn in rules:
        if hit:
            ids = [c["id"] for c in india if fn(c)]
            if ids:
                return label, ids, india
    return None


def check_free_claim(conn: sqlite3.Connection, text: str) -> dict:
    t = re.sub(r"\s+", " ", text).strip()
    if len(t) < 3:
        return {"mode": "unsupported", "claim": t, "headline": "Type a claim or a question first.", "verdict": "insufficient"}
    s = cc.sanitise(t)[0] if hasattr(cc, "sanitise") else t
    cpu_words = re.findall(r"ryzen|\bintel\b|core i[3579]|\bi[3579]\b|\bm[1-9]\b|\b\d{4,5}[hu]\b|\brtx\b|\bgtx\b|\bgpu\b|\bcpu\b|processor", t, re.IGNORECASE)
    if len(cpu_words) >= 2 and re.search(r"\bvs\.?\b|versus|\bor\b|than|compare|better", t, re.IGNORECASE):
        return {"mode": "unsupported", "claim": t, "verdict": "insufficient", "limits": [], "headline": "We do not compare processors or graphics chips directly. Put the laptops you are considering on the Compare page to see their specs side by side, or describe your use on the first page and we will suggest the level you need."}
    named = _named_variants(conn, t)
    market = {r[0]: r[1] for r in conn.execute("SELECT id, catalogue_set FROM laptop_variants")}
    indian = [v for v in named if market.get(v) == "flipkart14"]
    if len(indian) >= 2 and re.search(r"\bvs\.?\b|versus|\bor\b|compare|better than|which is better", t, re.IGNORECASE):
        return {"mode": "compare", "claim": t, "verdict": None, "compare_ids": indian[:4],
                "headline": f"That is a question about {len(indian[:4])} specific laptops. Side by side is the clearest way to answer it."}
    topic, stance = claim_topic_and_stance(s)
    brands = _brands_in(t)
    brand = brands[0] if brands else None
    if ADVICE.search(t) and not (named or brand or (re.search(r"laptops?", t, re.I) and re.search(r"gaming|ryzen|intel|under|below|light", t, re.I))):
        return {"mode": "unsupported", "claim": t, "verdict": "insufficient", "limits": [], "headline": "That is advice rather than a claim we can test. Describe how you will use the laptop on the first page and we will suggest numbers with reasons."}
    # upgrade claims are about one laptop's hardware: the per-laptop engine reads the listing and owner reports
    if indian and cc.R_UPGRADE.search(t):
        res = cc.check_claim(conn, indian[0], t)
        note = "" if len(indian) == 1 else f" We checked the first match; other versions of this laptop may differ, so check each on the Compare page."
        return {"mode": "laptop", "claim": t, "verdict": res["verdict"], "headline": note.strip(), "laptop_id": indian[0], "result": res}
    if len(indian) == 1 and not (topic and stance and cc.route(s)["type"] == "experiential"):
        if not topic or cc.route(s)["type"] in ("spec_fact", "measured", "predictive"):
            res = cc.check_claim(conn, indian[0], t)          # specs, measured battery, predictive claims: the per-laptop engine
            return {"mode": "laptop", "claim": t, "verdict": res["verdict"], "headline": "", "laptop_id": indian[0], "result": res}
    votes, cat = _vc(), _catalogue(conn)
    stats = topic_stats(votes)
    attr = (not named) and not brand and _attr_scope(cat, t)
    scope_ids = named if named else [c["id"] for c in cat if brand and c["brand"] == brand]
    single = len(named) == 1
    scope_label = (BRAND_NAME[brand] if brand and not named else (cat_name(cat, named[0]) if len(named) == 1 else _line_label(cat, named, t) if named else "")) if scope_ids else ""
    if attr:
        scope_label, scope_ids, cat = attr[0], attr[1], attr[2]
    prog = reading_progress(conn, votes)
    limits = [f"Based on owner reviews of {sum(1 for c in cat if c['market']=='IN')} laptops sold in India (Flipkart, about 2022)"
              + (f" plus {sum(1 for c in cat if c['market']=='US')} laptops sold in the US (Amazon, 2015 to 2023). US laptops are evidence only; we never recommend them." if any(c['market'] == 'US' for c in cat) else ".")
              + " Other models are not covered.",
              "Reviews are personal experiences. A rating here is the share of owners who were happy about this topic, not a lab test."]
    if not prog["complete"]:
        limits.append(f"We are still reading reviews ({prog['reviews_left']} left), so numbers can change.")
    num = next(((a, d, lab) for rx, a, d, lab in NUMERIC_WORDS if re.search(rx, t, re.IGNORECASE)), None)
    if num and scope_ids:                                      # 'HP laptops are heavy', 'Dell laptops are expensive': the listings answer this directly
        return _numeric_claim(t, num, scope_ids, scope_label, cat, limits)
    if topic:
        if len(brands) >= 2 and not named:                    # 'ASUS vs Lenovo battery': a head-to-head, no verdict
            table = _brand_table(cat, stats, topic)
            pick = [r for r in table if any(r["label"] == BRAND_NAME[b] for b in brands)]
            out = _topic_claim(conn, t, topic, "positive", [], "", cat, stats, votes, limits, None, True, 10)
            out["brands"] = table
            out["headline"] = f"{TOPIC_LABEL[topic]}, share of owners who were happy: " + ", ".join(f"{r['label']} {r['happy_pct']}% ({r['models']} laptops)" if r["happy_pct"] is not None else f"{r['label']}: not enough reviews" for r in pick) + "."
            out["mode_note"] = "You compared brands, so there is no single claim to test. Here is how each brand did."
            out["mode"] = "generic"; out["verdict"] = None
            return out
        if stance is None:                                    # direction unclear: show the picture, do not guess a claim
            out = _topic_claim(conn, t, topic, "positive", scope_ids, scope_label, cat, stats, votes, limits, brand, True, 20 if not single else 5)
            out["verdict"] = None; out["mode_note"] = "We could not tell whether you mean good or bad, so here is how it looks without a verdict."
            out["headline"] = f"{TOPIC_LABEL[topic]}: share of owners who were happy" + (f" for {scope_label}:" if scope_ids else ", best first:")
            if scope_ids:
                out["mode"] = "brand" if brand else "line"
            return out
        out = _topic_claim(conn, t, topic, stance, scope_ids, scope_label, cat, stats, votes, limits, brand, bool(GENERIC_Q.search(t)) and not scope_ids, 5 if single else 20)
        if scope_ids:
            hits = _word_hits(conn, t, scope_ids)
            if hits:
                out["word_hits"] = hits
            if re.search(r"no fan|fanless|without (?:a )?fan", t, re.IGNORECASE):       # a hardware fact: owners' heat opinions cannot prove it
                out["verdict"] = "insufficient"
                out["headline"] = ("Whether it has a fan is a hardware fact, and none of our listings or lab pages state it. What owners say about heat and noise: " + out["headline"])
        return out
    if re.search(r"[a-z0-9]+\s*(?:vs\.?|versus|or|than)\s*[a-z0-9]+", t, re.IGNORECASE) and re.search(r"ryzen|intel|core i[3579]|\bi[3579]\b|\bm[1-9]\b|processor|cpu|gpu|rtx|gtx|chip", t, re.IGNORECASE):
        msg = "We do not compare processors or graphics chips directly. Put the laptops you are considering on the Compare page to see their specs side by side, or describe your use on the first page and we will suggest the level you need."
    elif re.search(r"overkill|enough|should i|worth it|do i need|is it ok|recommend", t, re.IGNORECASE):
        msg = "That is advice rather than a claim we can test. Describe how you will use the laptop on the first page and we will suggest numbers with reasons."
    else:
        msg = "We could not tell what to check. Try something like “ASUS laptops are bad at battery”, “Gaming laptops run hot”, “Which laptop has the best screen?” or “MacBook Air gets 12 hours of battery”."
    return {"mode": "unsupported", "claim": t, "verdict": "insufficient", "limits": limits, "headline": msg}


def _line_label(cat, named, text) -> str:
    words = [w for w in re.sub(r"[^a-z0-9 ]", " ", text.lower()).split() if w in MODEL_WORDS]
    first = next((c for c in cat if c["id"] == named[0]), None)
    brand = BRAND_NAME.get(first["brand"], "") if first else ""
    real = next((t for t in (first["name"].split() if first else []) if words and t.lower() == words[0]), words[0].capitalize() if words else "")
    return f"{brand} {real} line".strip() if real else f"{brand} line".strip()


def cat_name(cat, vid):
    return next((c["name"].split(" with ")[0].split(" Core")[0].split(" Ryzen")[0] for c in cat if c["id"] == vid), vid)


def _topic_claim(conn, text, topic, stance, scope_ids, scope_label, cat, stats, votes, limits, brand, generic, min_scope: int = 20) -> dict:
    label = TOPIC_LABEL[topic]
    by_id = {c["id"]: c for c in cat}
    models = []
    for c in cat:
        d = stats.get(c["id"], {}).get(topic)
        models.append({"id": c["id"], "name": by_id[c["id"]]["name"].split(" · ")[0], "brand": BRAND_NAME.get(c["brand"], c["brand"].title()), "n": d["n"] if d else 0,
                       "happy_pct": round(100 * d["share"]) if d and d["n"] >= 3 else None, "unhappy": d["neg"] if d else 0, "in_scope": c["id"] in scope_ids,
                       "price_inr": _num(c["spec"]["price_inr"]), "price_usd": _num(c["spec"]["price_usd"]), "market": c["market"]})
    ranked = sorted([m for m in models if m["happy_pct"] is not None], key=lambda m: (-m["happy_pct"], -m["n"]))
    out = {"claim": text, "topic": topic, "topic_label": label, "stance": stance, "models": ranked, "limits": limits,
           "best": ranked[:3], "worst": ranked[-3:][::-1] if len(ranked) > 3 else [], "scope": scope_label}
    if scope_ids:
        a = _pool(stats, scope_ids, topic)
        b = _pool(stats, [c["id"] for c in cat if c["id"] not in scope_ids], topic)
        out["groups"] = [{"label": scope_label, **_g(a), "models": sum(1 for m in ranked if m["in_scope"])},
                         {"label": "All other brands" if brand else "All other laptops", **_g(b), "models": sum(1 for m in ranked if not m["in_scope"])}]
        enough = a["n"] >= min_scope and a["share"] is not None and b["share"] is not None
        if not enough or b["n"] < 10:
            out["verdict"] = "insufficient"
            out["headline"] = f"Not enough owner reviews about {label.lower()} for {scope_label} ({a['n']} found) to say."
        else:
            diff = a["share"] - b["share"]                 # >0: scope is better than the rest
            claims_good = stance == "positive"
            better_than_rest = diff >= 0.10
            worse_than_rest = diff <= -0.10
            if (claims_good and better_than_rest) or (not claims_good and worse_than_rest):
                out["verdict"] = "supported"
            elif (claims_good and worse_than_rest) or (not claims_good and better_than_rest):
                out["verdict"] = "contradicted"
            else:
                out["verdict"] = "mixed"
            sc, ot = round(100 * a["share"]), round(100 * b["share"])
            rel = "better than" if better_than_rest else "worse than" if worse_than_rest else "about the same as"
            spread = [m["happy_pct"] for m in models if m["in_scope"] and m["happy_pct"] is not None]
            wide = len(spread) > 1 and max(spread) - min(spread) >= 30
            claims_good_ = stance == "positive"
            absolute_fail = (out["verdict"] == "supported" and ((not claims_good_ and a["share"] >= 0.5) or (claims_good_ and a["share"] < 0.5)))
            if absolute_fail:                                   # 'worse than the rest' is not the same as 'bad'
                out["verdict"] = "mixed"
            if wide and out["verdict"] != "insufficient":
                out["verdict"] = "mixed"
            unit = "" if "laptops" in scope_label.lower() else (" laptops" if a["models"] != 1 else " laptop")
            if a["models"] == 1:
                out["headline"] = (f"{scope_label}: {sc}% of the {a['n']} owners who wrote about {label.lower()} were happy, {rel} {ot}% on average across the other {b['models']} laptops. ")
            else:
                out["headline"] = (f"On average across {a['models']} {scope_label}{unit} with enough reviews, {sc}% of owners were happy about {label.lower()} "
                                   f"({a['n']} owners wrote about it), {rel} {ot}% across the other {b['models']} laptops. ")
            if wide:
                out["headline"] += (f"But {scope_label} laptops differ a lot, from {min(spread)}% to {max(spread)}% happy, so there is no single answer for the whole brand: check the model.")
            elif absolute_fail:
                out["headline"] += ("It is worse than the rest, but most owners are still happy about it, so “bad” is too strong." if not claims_good_
                                    else "It is better than the rest, but fewer than half of owners are happy about it, so “good” is too strong.")
            else:
                out["headline"] += "Claim holds." if out["verdict"] == "supported" else "Claim does not hold." if out["verdict"] == "contradicted" else "No clear difference."
        ABS = re.search(r"\b(all|every|always|never|none|nobody|no one)\b", text, re.IGNORECASE)
        scoped = [m for m in models if m["in_scope"] and m["happy_pct"] is not None]
        if ABS and len(scoped) >= 2 and out.get("verdict") in ("supported", "contradicted", "mixed"):
            claims_good = stance == "positive"
            exceptions = [m for m in scoped if (claims_good and m["happy_pct"] < 50) or (not claims_good and m["happy_pct"] >= 50)]
            if exceptions:
                out["verdict"] = "mixed"
                out["headline"] = out["headline"].replace(" Claim holds.", "").replace(" Claim does not hold.", "")
                out["headline"] += f" You said “{ABS.group(1).lower()}”, but {len(exceptions)} of {len(scoped)} do not fit: " + ", ".join(m["name"][:40] for m in exceptions[:3]) + "."
        ids = scope_ids
        out["examples"] = {"happy": _examples(votes, ids, topic, "positive"), "unhappy": _examples(votes, ids, topic, "negative")}
        if stance == "negative" and out.get("verdict") in ("supported", "mixed"):
            out["suggestions_title"] = f"If {label.lower()} matters, these laptops did better"
            out["suggestions"] = [m for m in ranked if not m["in_scope"]][:3]
    else:
        out["verdict"] = None
        out["mode_note"] = "No laptop or brand was named, so there is no single claim to test. Here is how every laptop we have did on this topic."
        out["headline"] = (f"Best for {label.lower()} (share of owners who were happy):" if stance == "positive" else f"Worst for {label.lower()} (share of owners who were unhappy):")
        out["suggestions_title"] = f"Suggested laptops for good {label.lower()}"
        out["suggestions"] = ranked[:3]
        out["brands"] = _brand_table(cat, stats, topic)
    out["mode"] = "brand" if scope_ids and brand and not out.get("mode_note") else "line" if scope_ids else "generic"
    out["brands"] = out.get("brands") or _brand_table(cat, stats, topic)
    return out


def _g(p):
    return {"avg_models": p.get("models"), "n": p["n"], "happy_pct": round(100 * p["share"]) if p["share"] is not None else None, "happy": p["pos"], "unhappy": p["neg"], "mixed": p["mixed"]}


def _brand_table(cat, stats, topic):
    rows = []
    for b in sorted({c["brand"] for c in cat}):
        ids = [c["id"] for c in cat if c["brand"] == b]
        p = _pool(stats, ids, topic)
        rows.append({"label": BRAND_NAME.get(b, b.title()), **_g(p), "models": len(ids)})
    return sorted(rows, key=lambda r: -(r["happy_pct"] if r["happy_pct"] is not None else -1))


def _numeric_claim(text, attr, scope_ids, scope_label, cat, limits) -> dict:
    a, direction, label = attr
    key = {"weight_kg": "weight_kg", "price_inr": "price_inr"}[a]
    vals = [(c, _num(c["spec"][key])) for c in cat]
    vals = [(c, v) for c, v in vals if v is not None]
    ins = [v for c, v in vals if c["id"] in scope_ids]
    outs = [v for c, v in vals if c["id"] not in scope_ids]
    if not ins or not outs:
        return {"mode": "unsupported", "claim": text, "verdict": "insufficient", "limits": limits, "headline": "We do not have enough listings to compare."}
    ai, ao = sum(ins) / len(ins), sum(outs) / len(outs)
    ratio = ai / ao
    high = direction == "high"
    verdict = "supported" if (high and ratio >= 1.10) or (not high and ratio <= 0.90) else "contradicted" if (high and ratio <= 0.90) or (not high and ratio >= 1.10) else "mixed"
    fmt = (lambda v: f"₹{v:,.0f}") if key == "price_inr" else (lambda v: f"{v:.2f} kg")
    rows = sorted([{"id": c["id"], "name": c["name"].split(" · ")[0], "value": fmt(v), "raw": v, "in_scope": c["id"] in scope_ids} for c, v in vals], key=lambda r: r["raw"])
    return {"mode": "numeric", "claim": text, "verdict": verdict, "attribute": label, "limits": limits, "scope": scope_label,
            "headline": f"{scope_label} laptops average {fmt(ai)} against {fmt(ao)} for the others ({len(ins)} vs {len(outs)} models).",
            "groups": [{"label": scope_label, "value": fmt(ai), "models": len(ins)}, {"label": "All other brands", "value": fmt(ao), "models": len(outs)}],
            "numeric_models": rows}
