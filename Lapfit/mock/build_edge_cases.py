"""Build the Task 4 views from evals/edge_cases.json (single source of truth).

Outputs:
  mock/edge_cases.html             side-by-side page (Back end | User sees)
  03_happy_flows_by_persona.md     §5 replaced between markers
Run: python3 -I mock/build_edge_cases.py   (from the Lapfit folder)
"""
import html, json, pathlib, sys

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
data = json.loads((root / "evals/edge_cases.json").read_text())
cases = data["cases"]
UC = {1: "Second opinion", 2: "Check the pitch", 3: "Situation → shortlist",
      4: "Used or refurbished", 5: "Buying for someone else", 0: "All scenarios"}

# ---------- markdown ----------
def esc_md(s):
    return s.replace("|", "\\|").replace("\n", " ")

md = ["<!-- EDGE_CASES_START -->", "## 5. Task 4: edge cases, back end and front end side by side", "",
      f"Generated from `evals/edge_cases.json` ({data['version']}, {len(cases)} cases) by `mock/build_edge_cases.py`; "
      "edit the JSON, not this section. The side-by-side page is `mock/edge_cases.html`. "
      "Src: **sri** = from Sri's scenario list · **added** = added by Claude · **cross** = all scenarios.", ""]
for u in [1, 2, 3, 4, 5, 0]:
    rows = [c for c in cases if c["uc"] == u]
    md += [f"### {'UC' + str(u) if u else 'Cross-cutting'}: {UC[u]} ({len(rows)})", "",
           "| ID | Edge case | Example input | Back end (what happens) | Front end (what the user sees) | Checks |",
           "|---|---|---|---|---|---|"]
    for c in rows:
        back = " → ".join(c["back"])
        md.append(f"| {c['id']} | **{esc_md(c['group'])}:** {esc_md(c['case'])} ({c['src']}) | {esc_md(c['input'])} | "
                  f"{esc_md(back)} | {esc_md(c['front'])} | {c['assert'] or '-'} |")
    md.append("")
md.append("<!-- EDGE_CASES_END -->")
doc = root / "03_happy_flows_by_persona.md"
s = doc.read_text()
block = "\n".join(md)
if "<!-- EDGE_CASES_START -->" in s:
    a = s.index("<!-- EDGE_CASES_START -->"); b = s.index("<!-- EDGE_CASES_END -->") + len("<!-- EDGE_CASES_END -->")
    s = s[:a] + block + s[b:]
else:
    s = s.rstrip() + "\n\n---\n\n" + block + "\n"
doc.write_text(s)

# ---------- html ----------
payload = json.dumps(cases, ensure_ascii=False).replace("</", "<\\/")
page = r"""<title>LapFit Edge Cases</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* Layout: filter bar, then one row per edge case with two panes: back end (left, machine) and user sees (right, phone-like). */
:root{--bg:#f3f4f1;--surface:#fff;--ink:#1d2421;--muted:#5d6a64;--line:#d9ded9;--accent:#1f5e4b;--accent-soft:#e2eee8;
 --machine:#1c2420;--machine-ink:#cfe3da;--machine-dim:#86a197;--sri:#1f5e4b;--added:#6c3f8f;--cross:#3d5a80;
 --f-display:"Bricolage Grotesque","Segoe UI",system-ui,sans-serif;--f-body:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;--f-mono:"JetBrains Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#121614;--surface:#1b211e;--ink:#e7ece9;--muted:#9aa8a1;--line:#2e3833;--accent:#6fc3a3;--accent-soft:#1f3a30;
 --machine:#0b0f0d;--machine-ink:#cfe3da;--machine-dim:#7d978d;--sri:#6fc3a3;--added:#c9a3e6;--cross:#9db8de;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#121614;--surface:#1b211e;--ink:#e7ece9;--muted:#9aa8a1;--line:#2e3833;--accent:#6fc3a3;--accent-soft:#1f3a30;
 --machine:#0b0f0d;--machine-ink:#cfe3da;--machine-dim:#7d978d;--sri:#6fc3a3;--added:#c9a3e6;--cross:#9db8de;color-scheme:dark}
body{background:var(--bg);color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.5;
 padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.wrap{max-width:1100px;margin:0 auto;padding-block:20px 40px}
h1{font-family:var(--f-display);font-size:28px;margin:0 0 4px;text-wrap:balance}
.lede{color:var(--muted);margin:0 0 16px;max-width:70ch}
.bar{position:sticky;top:env(safe-area-inset-top,0px);background:var(--bg);padding-block:10px;z-index:5;display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-bottom:1px solid var(--line)}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}
.f{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:5px 12px;cursor:pointer}
.f[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--surface)}
.f:focus-visible,#search:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
#search{font:inherit;font-size:14px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:10px;padding:6px 10px;min-width:0;flex:1 1 200px}
.count{font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.heads{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0 6px;font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.case{padding-block:16px;border-bottom:1px solid var(--line)}
.top{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;margin-bottom:8px}
.id{font-family:var(--f-mono);font-size:12px;color:var(--muted)}
.title{font-family:var(--f-display);font-size:17px;font-weight:600}
.uc{font-size:12px;color:var(--muted)}
.src{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;border-radius:5px;padding:1px 6px;border:1px solid currentColor}
.src.sri{color:var(--sri)}.src.added{color:var(--added)}.src.cross{color:var(--cross)}
.input{font-family:var(--f-mono);font-size:13px;background:var(--surface);border:1px dashed var(--line);border-radius:8px;padding:6px 10px;margin-bottom:10px;overflow-wrap:anywhere}
.input::before{content:"Input  ";color:var(--muted)}
.panes{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.back{background:var(--machine);color:var(--machine-ink);border-radius:10px;padding:12px 14px;font-family:var(--f-mono);font-size:12.5px;min-width:0}
.back ol{margin:0;padding-left:20px;display:grid;gap:4px}
.back li::marker{color:var(--machine-dim)}
.back .chk{margin-top:8px;color:var(--machine-dim)}
.front{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 14px;min-width:0;position:relative}
.front .who{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--accent);margin-bottom:4px}
.front p{margin:0}
.lbl{display:none;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
@media (max-width:720px){.panes{grid-template-columns:1fr}.heads{display:none}.lbl{display:block}}
.empty{color:var(--muted);padding:24px 0}
</style>
<div class="wrap">
 <h1>LapFit edge cases</h1>
 <p class="lede">What the back end does and what the user sees, side by side, for every edge case in the five scenarios. Values in ‹ › are filled from real data at run time.</p>
 <div class="bar" role="toolbar" aria-label="Filter">
  <div id="filters" style="display:flex;flex-wrap:wrap;gap:6px"></div>
  <input id="search" type="search" placeholder="Search edge cases" aria-label="Search edge cases">
  <span class="count" id="count"></span>
 </div>
 <div class="heads"><div>Back end · what happens</div><div>Front end · what the user sees</div></div>
 <div id="list"></div>
</div>
<script>
const CASES=__DATA__;
const UC={1:"Second opinion",2:"Check the pitch",3:"Situation → shortlist",4:"Used or refurbished",5:"Buying for someone else",0:"All scenarios"};
let uc="all",q="";
const esc=s=>String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const fl=document.getElementById("filters");
[["all","All"],[1,"UC1"],[2,"UC2"],[3,"UC3"],[4,"UC4"],[5,"UC5"],[0,"Cross-cutting"]].forEach(([k,l])=>{
 const b=document.createElement("button");b.className="f";b.type="button";b.textContent=l+(k==="all"?"":" · "+CASES.filter(c=>c.uc===k).length);
 b.title=k==="all"?"All scenarios":UC[k];b.setAttribute("aria-pressed",k==="all");
 b.onclick=()=>{uc=k;fl.querySelectorAll(".f").forEach(x=>x.setAttribute("aria-pressed",x===b));draw();};fl.appendChild(b);});
document.getElementById("search").oninput=e=>{q=e.target.value.toLowerCase();draw();};
function draw(){
 const rows=CASES.filter(c=>(uc==="all"||c.uc===uc)&&(!q||JSON.stringify(c).toLowerCase().includes(q)));
 document.getElementById("count").textContent=rows.length+" of "+CASES.length;
 document.getElementById("list").innerHTML=rows.length?rows.map(c=>`<article class="case">
  <div class="top"><span class="id">${c.id}</span><span class="title">${esc(c.group)}: ${esc(c.case)}</span><span class="uc">${UC[c.uc]}</span><span class="src ${c.src}">${c.src}</span></div>
  <div class="input">${esc(c.input)}</div>
  <div class="panes"><div class="back"><div class="lbl" style="color:var(--machine-dim)">Back end</div><ol>${c.back.map(s=>"<li>"+esc(s)+"</li>").join("")}</ol>${c.assert?'<div class="chk">checks: '+esc(c.assert.replace(/;/g," · "))+"</div>":""}</div>
  <div class="front"><div class="lbl">User sees</div><div class="who">LapFit</div><p>${esc(c.front)}</p></div></div></article>`).join(""):'<p class="empty">No edge cases match.</p>';
}
draw();
</script>
"""
(root / "mock/edge_cases.html").write_text(page.replace("__DATA__", payload))
print(f"ok: {len(cases)} cases", {u: sum(c['uc'] == u for c in cases) for u in UC})
