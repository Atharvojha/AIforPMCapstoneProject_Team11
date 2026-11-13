"""Build the simulation's data from the Flipkart laptop reviews (Zenodo 17612521).

Same filter and IDs as prototype_prathyusha/lapfit_data_pack/build_laptop_extract.py:
3,300 reviews, 14 listings (FKL-01..14), review IDs FK-00001.. in source order.

Usage:  python3 -I sim/build_sim_data.py <path/to/flipkart_product.csv> <out_dir>
Output: <out_dir>/data.js  (window.LAPFIT_DATA = {...}), local only. The review text is for
course use only (licence unverified), so sim/data/ is gitignored.

Topic and lens tags here use KEYWORDS, not the prototype's model-based reader. The
simulation says so on screen.
"""
import hashlib, json, re, sys
from pathlib import Path
import pandas as pd

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
df = pd.read_csv(src, encoding_errors="replace")
LAPTOP = re.compile(r"laptop|notebook|chromebook|macbook", re.I)
NOT = re.compile(r"\btable\b|\bstand\b|\bbag\b|\bsleeve\b", re.I)
lp = df[df.ProductName.str.contains(LAPTOP, na=False) & ~df.ProductName.str.contains(NOT, na=False)].reset_index(drop=True)

def sp(p, t, g=1):
    m = re.search(p, t, re.I); return m.group(g) if m else None

def clean(s):
    return "" if pd.isna(s) else str(s).replace("�", "").replace("\xa0", " ").strip()

laptops, vid = [], {}
for i, (name, g) in enumerate(lp.groupby("ProductName", sort=False), start=1):
    n = clean(name); lid = f"FKL-{i:02d}"; vid[name] = lid
    paren = sp(r"\(([^()]*inch[^()]*)\)\s*$", n) or ""
    bits = [b.strip() for b in paren.split(",")]
    colour = bits[1] if len(bits) > 1 else None
    short = re.split(r"\s+-\s+\(", n)[0]
    short = re.sub(r"\b(Hexa|Octa|Dual|Quad) Core\b", "", short)
    short = re.sub(r"\bwith 90Whr Battery\b", "", short)
    short = re.sub(r"\s+", " ", short).strip()
    ram = sp(r"\((\d+)\s*GB\s*/", n); ssd = sp(r"/\s*(\d+)\s*GB\s*SSD", n)
    gpu = sp(r"/\s*\d+\s*GB\s*Graphics/([^/)]+)", n)
    code = sp(r"\)\s*([A-Z0-9][A-Za-z0-9\-/| ]{4,40}?)\s+(?:Gaming|Thin|Creator|Laptop|\()", n)
    kind = "Gaming" if "Gaming Laptop" in n else "Creator" if "Creator" in n else "Thin and Light" if "Thin and Light" in n else "Laptop"
    laptops.append({
        "id": lid, "title": n, "name": short, "brand": n.split()[0].upper(),
        "cpu": sp(r"((?:Core\s*i\d\s*\d+th Gen)|(?:Ryzen\s*\d[^-]*?\d{4}[A-Z]{0,2})|(?:R\d-\d{4}[A-Z]?)|(?:Celeron[^-]*)|(?:M1))", n),
        "ram_gb": int(ram) if ram else None, "ssd_gb": int(ssd) if ssd else None,
        "gpu": gpu.strip() if gpu else None, "dgpu": bool(gpu),
        "hz": int(sp(r"/\s*(\d+)\s*Hz", n)) if sp(r"/\s*(\d+)\s*Hz", n) else 60,
        "hz_stated": bool(sp(r"/\s*(\d+)\s*Hz", n)),
        "size_in": float(sp(r"\(\s*(\d+(?:\.\d+)?)\s*inch", n)) if sp(r"\(\s*(\d+(?:\.\d+)?)\s*inch", n) else None,
        "weight_kg": float(sp(r"([\d.]+)\s*kg", n)) if sp(r"([\d.]+)\s*kg", n) else None,
        "battery_wh": float(sp(r"(\d+)\s*Whr", n)) if sp(r"(\d+)\s*Whr", n) else None,
        "os": sp(r"/(Windows 1\d(?: Home)?|Mac OS [A-Za-z ]+)", n), "office": "MS Office" in n,
        "colour": colour, "model_code": code.strip() if code else None, "kind": kind,
        "price_inr": int(re.sub(r"[^\d]", "", str(g.Price.iloc[0]).split(".")[0])),
        "reviews_total": len(g),
    })

TOPICS = {
 "battery": r"\bbattery|backup|charg", "heat": r"\bheat|\bhot\b|temperature|\bfan|cooling|warm",
 "performance": r"performance|\bspeed|\bfast|\blag|\bhang|smooth|\bslow", "display": r"display|screen|panel|brightness",
 "keyboard": r"keyboard|\bkeys?\b|trackpad|touchpad", "build": r"\bbuild|quality|hinge|body|plastic|sturdy",
 "sound": r"\bsound|speaker|audio", "webcam": r"webcam|web cam|camera", "weight": r"\bheavy|\bweight|lightweight|light weight|portable",
 "value": r"value for money|worth|price|budget", "gaming": r"\bgam(e|ing)|fps|gta|valorant|pubg|fortnite",
}
NEG = r"\bnot\b|n't|\bno\b|bad|poor|worst|issue|problem|lag|hang|drain|disappoint|average|heavy|\blow\b|less|waste|slow|heating|noisy|loud|dim"
POS = r"good|great|awesome|excellent|nice|best|smooth|fast|amazing|superb|love|perfect|decent|fine|impressive|cool"
LENS = {"gamers": r"\bgam(e|er|ing)|fps|gta|valorant|pubg|fortnite|csgo", "students": r"college|student|\bstudy|studies|online class|school",
        "coders": r"coding|programming|developer|\bcode\b|python|java", "office": r"office work|\boffice\b|excel|work from home|wfh"}

reviews, seen = [], set()
for pos, r in enumerate(lp.itertuples(index=False), start=1):
    body = clean(r.Summary); title = clean(r.Review)
    h = hashlib.sha256(body.lower().encode()).hexdigest()[:12]
    dup = h in seen; seen.add(h)
    low = body.lower()
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+|(?<=[a-z]),(?=\s*[A-Za-z])", body) if len(s.strip()) > 12]
    tags = {}
    for t, pat in TOPICS.items():
        hit = [s for s in sents if re.search(pat, s, re.I)]
        if not hit: continue
        s = hit[0]
        neg, posw = bool(re.search(NEG, s, re.I)), bool(re.search(POS, s, re.I))
        pol = "neg" if neg and not posw else "pos" if posw and not neg else ("pos" if int(r.Rate if str(r.Rate).isdigit() else 3) >= 4 and not neg else "mixed")
        tags[t] = [pol, s]   # s is an exact substring of body
    lens = [k for k, p in LENS.items() if re.search(p, low)]
    reviews.append({"rid": f"FK-{pos:05d}", "lid": vid[r.ProductName], "stars": int(r.Rate) if str(r.Rate).isdigit() else None,
                    "title": title, "text": body, "dup": dup, "tags": tags, "lens": lens})

for t in reviews:
    for k, (pol, s) in t["tags"].items():
        assert s in t["text"], (t["rid"], k)

meta = {"source": "Flipkart product reviews, Zenodo record 17612521 (laptop subset, same IDs as the team's extract)",
        "source_url": "https://zenodo.org/records/17612521", "listing_note": "Prices and specs come from the 2022-era Flipkart listing title in the dataset; they are not today's prices.",
        "method_note": "In this simulation, topics and reviewer types are found by keyword matching. The product uses the reviewed topic reader.",
        "laptops": len(laptops), "reviews": len(reviews), "unique_reviews": sum(not r["dup"] for r in reviews)}
(out / "data.js").write_text("window.LAPFIT_DATA=" + json.dumps({"meta": meta, "laptops": laptops, "reviews": reviews}, ensure_ascii=False) + ";")
print(json.dumps(meta, indent=1)); print(json.dumps([{k: l[k] for k in ("id", "name", "cpu", "colour", "model_code", "weight_kg", "price_inr")} for l in laptops], indent=0, ensure_ascii=False))
