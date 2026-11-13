"""Mechanical checks on the 150-case workbook (ideal outputs vs evidence context).
Usage: python3 -I evals/review_150/auto_checks.py <xlsx> <outdir>"""
import json, re, sys
from pathlib import Path
import pandas as pd
x = pd.ExcelFile(sys.argv[1]); out = Path(sys.argv[2])
c = x.parse("Cases").fillna(""); a = x.parse("Assertions").fillna("")
rows = []
HINGLISH = re.compile(r"\b(bhai|hai|hu|hoon|kaunsa|chahiye|lu|lena|mein|kya|nahi|par|aur|yaar|batao|accha|thoda|wala|kar)\b", re.I)
def nums(s):  # money, kg, hours, GB numbers as normalised strings
    s = s.replace(",", "")
    return set(re.findall(r"(?:₹|rs\.?\s?|\$|€|£)\s?\d+(?:\.\d+)?|\d+(?:\.\d+)?\s?(?:kg|h\b|hours?|hrs?|gb|tb|hz|%|w\b|wh|nits|mm)", s.lower()))
def norm(n): return re.sub(r"\s+", "", n.replace("hours", "h").replace("hour", "h").replace("hrs", "h").replace("hr", "h").replace("rs.", "₹").replace("rs", "₹"))
for r in c.itertuples(index=False):
    cid, q, ideal, ctx = r[0], r[3], r[4], r[5]
    ids_ctx = set(re.findall(r"\[?([A-Z]\d{3}-[A-Z]+\d*)\]?", ctx)); ids_ideal = set(re.findall(r"\[([A-Z]\d{3}-[A-Z]+\d*)\]", ideal))
    bad_ids = sorted(ids_ideal - ids_ctx)
    ctxq = norm(" ".join(nums(ctx) | nums(q)))
    vals = set()
    for t in (ctx + " " + q).replace(",", "").lower().split():
        m = re.match(r"^(?:₹|rs\.?|\$|€|£)?(\d+(?:\.\d+)?)(k|l|lakh)?\b", t)
        if m: vals.add(round(float(m.group(1)) * (1000 if m.group(2) == "k" else 100000 if m.group(2) in ("l", "lakh") else 1), 2))
    vl = list(vals); derived = vals | {round(abs(x - y), 2) for x in vl for y in vl} | {round(x + y, 2) for x in vl for y in vl} | {round(x * y, 2) for x in vl for y in vl if x < 50 or y < 50}
    def supported(n):
        if norm(n) in ctxq: return True
        v = float(re.search(r"\d+(?:\.\d+)?", n).group()); return round(v, 2) in derived
    unsupported_nums = sorted({n for n in nums(ideal) if not supported(n)})
    # product labels: CamelCase+digits tokens
    prods_ctx = set(re.findall(r"\b[A-Z][a-zA-Z]+\d+[A-Za-z]*\b", ctx)); prods_ideal = set(re.findall(r"\b[A-Z][a-zA-Z]+\d+[A-Za-z]*\b", ideal))
    unknown_prods = sorted(p for p in prods_ideal - prods_ctx if not re.match(r"^(A|B|C)\d", p) and p not in q)
    quotes = re.findall(r"[\"“]([^\"”]{12,})[\"”]", ideal)
    bad_quotes = [s for s in quotes if s not in ctx and s not in q]
    hq, hi = len(HINGLISH.findall(q)), len(HINGLISH.findall(ideal))
    lang_flag = "query Hinglish, ideal English" if hq >= 3 and hi < 2 else ""
    words = len(ideal.split())
    no_ev = r[8] == "no_evidence"
    cites_when_none = bool(ids_ideal) and no_ev
    na = a[a["Case ID"] == cid]
    rows.append(dict(case=cid, scenario=r[1], words=words, bad_citation_ids=bad_ids, numbers_not_in_context_or_query=unsupported_nums,
                     product_names_not_in_context=unknown_prods, quotes_not_exact=bad_quotes, language=lang_flag,
                     cites_in_no_evidence_case=cites_when_none, n_assertions=len(na), n_critical=int((na.Severity == "critical").sum())))
df = pd.DataFrame(rows); out.mkdir(parents=True, exist_ok=True)
df.to_json(out / "auto_checks.json", orient="records", indent=1, force_ascii=False)
flag = lambda col: df[col].apply(lambda v: bool(v) if not isinstance(v, list) else len(v) > 0)
summary = {col: int(flag(col).sum()) for col in ["bad_citation_ids", "numbers_not_in_context_or_query", "product_names_not_in_context", "quotes_not_exact", "language", "cites_in_no_evidence_case"]}
summary["words"] = df.words.describe().round(0).to_dict(); print(json.dumps(summary, indent=1, ensure_ascii=False))
for col in ["bad_citation_ids", "numbers_not_in_context_or_query", "product_names_not_in_context", "quotes_not_exact", "language"]:
    sub = df[flag(col)][["case", col]]; print("\n##", col, len(sub)); print(sub.head(25).to_string(index=False))
# also export cases for reviewers
c.iloc[:, :13].to_json(out / "cases.jsonl", orient="records", lines=True, force_ascii=False)
a.to_json(out / "assertions.jsonl", orient="records", lines=True, force_ascii=False)
