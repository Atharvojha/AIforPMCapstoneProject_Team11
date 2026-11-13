/* LapFit simulation: front end. One answer per turn, composed from what the user typed. */
(function () {
const F = window.LF, $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");
const stars = n => n ? "★".repeat(n) + "☆".repeat(5 - n) : "";
const thread = $("#thread");
let compareSet = new Set();

/* ---------- visuals ---------- */
const COLOURS = { silver: "#c9ccd1", "natural silver": "#d2d4d7", "transparent silver": "#cdd2d6", "cool silver": "#c3cad1", "arctic grey": "#9aa1a8",
  "platinum grey": "#b5b9bd", black: "#2b2d30", "shadow black": "#25272a", "graphite black": "#303236", "black plastic": "#2b2b2b" };
function colourOf(l) { const c = (l.colour || "").toLowerCase(); const k = Object.keys(COLOURS).sort((a, b) => b.length - a.length).find(k => c.includes(k)); return COLOURS[k] || "#9aa1a8"; }
function laptopSVG(l, width) {
  const d = l.size_in || 15.6, wide = l.id === "FKL-10" ? [0.848, 0.53] : [0.8716, 0.4903];
  const sw = d * wide[0], sh = d * wide[1], k = 8.5, W = sw * k + 24, H = sh * k + 34, body = colourOf(l), dark = /black|graphite|shadow/i.test(l.colour || "");
  const gaming = l.kind === "Gaming", glow = gaming ? (l.brand === "MSI" ? "#e0403a" : l.brand === "HP" ? "#3ad1c0" : "#e05a3a") : "none";
  return `<svg class="lap-svg" viewBox="0 0 ${W.toFixed(0)} ${(H + 14).toFixed(0)}" width="${width || "100%"}" role="img" aria-label="Illustration of ${esc(l.name)} in ${esc(l.colour)}">
   <rect x="10" y="4" width="${(sw * k + 4).toFixed(1)}" height="${(sh * k + 4).toFixed(1)}" rx="7" fill="${body}" stroke="${dark ? "#55585c" : "#8d9296"}" stroke-width="1"/>
   <rect x="13" y="7" width="${(sw * k - 2).toFixed(1)}" height="${(sh * k - 2).toFixed(1)}" rx="4" fill="url(#scr${l.id})"/>
   <defs><linearGradient id="scr${l.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16324a"/><stop offset=".55" stop-color="#1f5e4b"/><stop offset="1" stop-color="#0e1a16"/></linearGradient></defs>
   <path d="M2 ${(sh * k + 10).toFixed(1)} h${(sw * k + 20).toFixed(1)} l-8 ${16} h-${(sw * k + 4).toFixed(1)} z" fill="${body}" stroke="${dark ? "#55585c" : "#8d9296"}" stroke-width="1"/>
   ${gaming ? `<rect x="${(W * 0.22).toFixed(1)}" y="${(sh * k + 14).toFixed(1)}" width="${(W * 0.56).toFixed(1)}" height="3" rx="1.5" fill="${glow}" opacity=".85"/>` : `<rect x="${(W * 0.4).toFixed(1)}" y="${(sh * k + 19).toFixed(1)}" width="${(W * 0.2).toFixed(1)}" height="4" rx="2" fill="${dark ? "#45484c" : "#a9adb2"}"/>`}
   <text x="${(W / 2).toFixed(1)}" y="${(sh * k / 2 + 10).toFixed(1)}" text-anchor="middle" font-size="12" fill="#e7f1ec" opacity=".75" font-family="Inter, sans-serif">${d}″</text>
  </svg>`;
}
function bottles(kg, maxKg) {
  const full = Math.floor(kg), part = kg - full, n = Math.ceil(kg);
  let s = "";
  for (let i = 0; i < n; i++) { const f = i < full ? 1 : part; s += `<span class="btl" title="1 litre bottle"><i style="height:${(f * 100).toFixed(0)}%"></i></span>`; }
  const over = maxKg && kg > maxKg;
  return `<div class="viz"><div class="viz-h">Weight <b>${kg} kg</b> ≈ ${kg.toFixed(1)} one-litre bottles</div><div class="btls ${over ? "over" : ""}">${s}${maxKg ? `<span class="must-line" style="left:${(maxKg / Math.max(n, maxKg) * 100).toFixed(0)}%">your limit ${maxKg} kg</span>` : ""}</div></div>`;
}
function dayStrip(l) {
  const hs = F.ownerHours(l); if (hs.length < 3) return `<div class="viz"><div class="viz-h">Battery through a day</div><p class="note">Only ${hs.length} owners gave battery hours, too few to draw.</p></div>`;
  const sorted = hs.map(x => x.h).sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
  const dots = hs.map(x => `<span class="hd" style="left:${Math.min(100, x.h / 12 * 100).toFixed(1)}%" title="${x.h} h · ${esc(x.r.rid)}"></span>`).join("");
  return `<div class="viz"><div class="viz-h">Battery through a day: owners report a median of <b>${med} h</b> (n=${hs.length})</div>
   <div class="day"><div class="day-bar"><span class="med" style="width:${Math.min(100, med / 12 * 100).toFixed(1)}%"></span>${dots}</div>
   <div class="day-ticks"><span>8 am</span><span>11 am</span><span>2 pm</span><span>5 pm</span><span>8 pm</span></div></div>
   <p class="src">Each dot is one owner's stated hours. Source: Flipkart owner reviews.</p></div>`;
}
function ramBar(have, need) {
  const pct = Math.min(100, have / 32 * 100), ok = have >= need;
  return `<div class="viz"><div class="viz-h">Memory <b>${have} GB</b> · suggested for you: ${need} GB</div><div class="meter"><span class="${ok ? "ok" : "low"}" style="width:${pct}%"></span><i style="left:${need / 32 * 100}%"></i></div></div>`;
}
function dots(st) {
  const total = st.pos + st.neg + st.mixed; if (!total) return `<span class="note">No reports</span>`;
  const per = total > 60 ? Math.ceil(total / 60) : 1, f = x => Math.round(x / per);
  const d = "g".repeat(f(st.pos)) + "m".repeat(f(st.mixed)) + "r".repeat(f(st.neg));
  return `<span class="dots" aria-label="${st.pos} happy, ${st.mixed} mixed, ${st.neg} unhappy">${[...d].map(c => `<i class="${c}"></i>`).join("")}</span>${per > 1 ? `<span class="note"> 1 dot ≈ ${per} owners</span>` : ""}`;
}
function screensToScale(ls) {
  const k = 9, pal = ["var(--a1)", "var(--a2)", "var(--a3)", "var(--a4)"];
  const maxW = Math.max(...ls.map(l => l.size_in * 0.8716)) * k + 20, maxH = Math.max(...ls.map(l => l.size_in * 0.53)) * k + 20;
  const a4w = 11.69 * k, a4h = 8.27 * k;
  const rects = ls.map((l, i) => { const w = l.size_in * (l.id === "FKL-10" ? 0.848 : 0.8716) * k, h = l.size_in * (l.id === "FKL-10" ? 0.53 : 0.4903) * k; return `<rect x="10" y="${(maxH - h - 10).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="${pal[i]}" stroke-width="2.5" rx="3"/>`; }).join("");
  return `<svg viewBox="0 0 ${Math.max(maxW, a4w + 20).toFixed(0)} ${maxH.toFixed(0)}" class="scale-svg" role="img" aria-label="Screens drawn to scale">
   <rect x="10" y="${(maxH - a4h - 10).toFixed(1)}" width="${a4w.toFixed(1)}" height="${a4h.toFixed(1)}" fill="none" stroke="var(--muted)" stroke-dasharray="4 4"/>
   <text x="14" y="${(maxH - a4h - 14).toFixed(1)}" font-size="11" fill="var(--muted)">A4 sheet</text>${rects}</svg>
   <div class="legend">${ls.map((l, i) => `<span><i style="background:${pal[i]}"></i>${esc(l.name)} · ${l.size_in}″</span>`).join("")}</div>`;
}

/* ---------- evidence ---------- */
const LENSES = [[null, "All owners"], ["students", "Students"], ["gamers", "Gamers"], ["coders", "Coders"], ["office", "Office"]];
function ownersPanel(l, topics, lens, uid) {
  const rows = topics.map(t => {
    const st = F.topicStats(l, t, lens);
    const share = st.enough ? Math.round(st.share * 100) + "% happy" : "too few";
    return `<div class="orow"><div class="ot">${F.TOPIC_LABEL[t]}</div><div class="od">${dots(st)}</div><div class="os ${st.enough ? (st.share >= 0.6 ? "good" : st.share < 0.4 ? "bad" : "mid") : "thin"}">${share}<small>n=${st.n}</small></div>
      <button class="link qbtn" data-l="${l.id}" data-t="${t}" data-lens="${lens || ""}" data-u="${uid}">Quotes</button></div>`;
  }).join("");
  const counts = LENSES.map(([k, lab]) => [k, lab, F.R.filter(r => r.lid === l.id && (!k || r.lens.includes(k))).length]);
  return `<div class="owners" id="ow-${uid}">
   <div class="seg" role="group" aria-label="Whose reviews">${counts.map(([k, lab, n]) => `<button class="${(k || "") === (lens || "") ? "on" : ""}" data-lensfor="${uid}" data-l="${l.id}" data-k="${k || ""}" data-topics="${topics.join(",")}" ${n < 3 && k ? "disabled" : ""}>${lab} <small>${n}</small></button>`).join("")}</div>
   ${lens ? `<p class="note">Only owners whose review mentions ${lens}. Like Zomato counting only nearby diners: their experience is closest to yours.</p>` : ""}
   ${rows}<div class="quotes" id="q-${uid}"></div>
   <p class="src">Green: happy · grey: mixed · red: unhappy. Source: ${F.D.meta.reviews.toLocaleString()} Flipkart owner reviews (<a href="${F.D.meta.source_url}" target="_blank" rel="noopener">Zenodo 17612521</a>). Topics found by keyword matching in this simulation.</p></div>`;
}
function quoteCard(r, topic) {
  const s = r.tags[topic][1], i = r.text.indexOf(s);
  const full = esc(r.text.slice(0, i)) + "<mark>" + esc(s) + "</mark>" + esc(r.text.slice(i + s.length));
  return `<figure class="quote ${r.tags[topic][0]}"><blockquote>“${esc(s)}”</blockquote>
   <figcaption><span class="st">${stars(r.stars)}</span> “${esc(r.title)}” · Flipkart owner ${r.lens.length ? "· mentions " + r.lens.join(", ") : ""} · <span class="rid">${r.rid}</span>
   <details><summary>Read full review</summary><p>${full}</p></details></figcaption></figure>`;
}
function showQuotes(lid, topic, lens, uid) {
  const l = F.byId[lid], q = F.quotesFor(l, topic, lens || null, 2), box = document.getElementById("q-" + uid);
  if (!box) return;
  box.innerHTML = `<div class="qh">${F.TOPIC_LABEL[topic]}: word-for-word owner quotes${lens ? " (" + lens + ")" : ""}</div>` +
    ([...q.pos.slice(0, 2), ...q.neg.slice(0, 2)].map(r => quoteCard(r, topic)).join("") || `<p class="note">No quotes for this group.</p>`);
  box.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/* ---------- pieces ---------- */
function chipsFor(n, match) {
  const c = [];
  if (match && match.status === "one") c.push(["ctx", "Laptop", match.laptop.name, null]);
  if (n.budget) c.push([n.hard || !match || match.status !== "one" ? "must" : "ctx", match && match.status === "one" ? "Your price" : "Must", inr(n.budget), "budget"]);
  if (n.ram) c.push(["must", "Must", n.ram + " GB RAM", "ram"]);
  if (n.ssd) c.push(["must", "Must", n.ssd + " GB SSD", "ssd"]);
  if (n.maxKg) c.push([n.maxKgSoft ? "should" : "must", n.maxKgSoft ? "Should" : "Must", (n.maxKgSoft ? "light (≤" : "≤ ") + n.maxKg + " kg" + (n.maxKgSoft ? ")" : ""), "maxKg"]);
  n.uses.forEach(u => c.push(["ctx", "For", u, "use:" + u]));
  n.notBrands.forEach(b => c.push(["not", "Not", b.toUpperCase(), "not:" + b]));
  if (n.notGaming) c.push(["not", "Not", "a gaming laptop", "notGaming"]);
  if (n.likes) c.push(["should", "Prefers", n.likes, "likes"]);
  if (n.battery) c.push(["should", "Should", "long battery", "battery"]);
  if (n.proxy) c.push(["ctx", "For", "your " + n.proxy, null]);
  if (n.city) c.push(["ctx", "City", n.city, null]);
  return c.map(([cls, lab, v, key]) => `<span class="chip ${cls}"><i>${lab}</i>${esc(v)}${key ? `<button aria-label="Remove ${esc(v)}" data-rm="${key}">×</button>` : ""}</span>`).join("");
}
function fitRows(l, n) {
  const sug = F.suggested(n), rows = [];
  if (n.budget) rows.push([l.price_inr <= n.budget, n.hard ? `Price ${inr(l.price_inr)} (2022 listing) vs your limit ${inr(n.budget)}` : `Listing price in our data ${inr(l.price_inr)} (2022) vs the ${inr(n.budget)} you were quoted`, n.hard]);
  const needRam = n.ram || sug.ram.v; rows.push([l.ram_gb >= needRam, `${l.ram_gb} GB RAM vs ${needRam} GB ${n.ram ? "you asked for" : "suggested for " + (n.uses.join(", ") || "you")}`, !!n.ram]);
  rows.push([l.ssd_gb >= (n.ssd || 512), `${l.ssd_gb} GB SSD vs ${n.ssd || 512} GB ${n.ssd ? "you asked for" : "suggested"}`, !!n.ssd]);
  if (n.uses.includes("gaming")) rows.push([l.dgpu, l.dgpu ? `Graphics: ${l.gpu}` : "No dedicated graphics card", true]);
  if (n.maxKg) rows.push([l.weight_kg <= n.maxKg, `${l.weight_kg} kg vs ${n.maxKgSoft ? "light (≤" + n.maxKg + " kg)" : "your ≤" + n.maxKg + " kg"}`, !n.maxKgSoft]);
  n.notBrands.forEach(b => rows.push([l.brand.toLowerCase() !== b, `Brand ${l.brand} (you said not ${b.toUpperCase()})`, true]));
  return rows;
}
function buyLinks(l) {
  const q = encodeURIComponent((l.model_code || l.name).split("|")[0].trim() + " " + l.brand.toLowerCase());
  return `<div class="buy"><div class="viz-h">Where to buy (search links; check today's price)</div>
   <div class="buy-row"><a href="https://www.flipkart.com/search?q=${q}" target="_blank" rel="noopener">Flipkart ↗</a><a href="https://www.amazon.in/s?k=${q}" target="_blank" rel="noopener">Amazon.in ↗</a><a href="https://www.croma.com/searchB?q=${q}" target="_blank" rel="noopener">Croma ↗</a></div>
   <p class="src">In the product these become affiliate links. They never change the order of results. Model code searched: ${esc((l.model_code || "name").split("|")[0])}</p></div>`;
}
function hero(l, n, uid) {
  const sug = F.suggested(n), topics = F.topicsFor(n), lens = F.lensFor(n);
  const fr = fitRows(l, n), fails = fr.filter(r => !r[0]).length;
  return `<div class="hero">
   <div class="hero-img">${laptopSVG(l)}<div class="cap"><span class="sw" style="background:${colourOf(l)}"></span>${esc(l.colour)} · illustration drawn to its ${l.size_in}″ screen size</div></div>
   <div class="hero-txt"><div class="kind">${esc(l.kind)} · ${esc(l.brand)}</div><h3>${esc(l.name)}</h3>
    <div class="spec">${esc(l.cpu)} · ${l.ram_gb} GB · ${l.ssd_gb} GB SSD · ${l.gpu ? esc(l.gpu) : "integrated graphics"} · ${l.hz_stated ? l.hz + " Hz" : "refresh rate not stated"} · ${esc(l.os || "")}${l.office ? " · MS Office" : ""}</div>
    <ul class="fit">${fr.map(([ok, t, must]) => `<li class="${ok ? "ok" : must ? "no" : "half"}">${ok ? "✓" : must ? "✗" : "½"} ${esc(t)}${!ok && !must ? " (suggestion, not your Must)" : ""}</li>`).join("")}</ul>
    <p class="src">Specs and price: Flipkart listing title in the dataset (2022) · model code ${esc(l.model_code || "-")}</p></div></div>
   <div class="viz-grid">${bottles(l.weight_kg, n.maxKg)}${dayStrip(l)}${ramBar(l.ram_gb, n.ram || sug.ram.v)}</div>
   <h4>What owners say${lens ? " · showing owners like you first" : ""}</h4>${ownersPanel(l, topics, lens, uid)}`;
}
function miniCard(l, n, i, uid) {
  const lens = F.lensFor(n), t = F.topicsFor(n).slice(0, 3);
  const line = t.map(x => { const st = F.topicStats(l, x, lens); const st2 = st.enough ? st : F.topicStats(l, x, null); return `${F.TOPIC_LABEL[x]} ${st2.enough ? Math.round(st2.share * 100) + "% <small>(n=" + (st2.pos + st2.neg) + ")</small>" : "– <small>(too few)</small>"}`; }).join(" · ");
  return `<article class="mini"><div class="mini-img">${laptopSVG(l)}</div><div class="mini-txt">
   <div class="rank">${i + 1}</div><h4>${esc(l.name)}</h4><div class="spec">${inr(l.price_inr)} (2022) · ${l.ram_gb} GB · ${l.ssd_gb} GB · ${l.weight_kg} kg · <span class="sw" style="background:${colourOf(l)}"></span>${esc(l.colour)}</div>
   <div class="why">Owners ${lens ? "like you" : ""} happy: ${line}</div>
   <div class="mini-act"><label><input type="checkbox" data-cmp="${l.id}" ${compareSet.has(l.id) ? "checked" : ""}> Compare</label><button class="link" data-open="${l.id}" data-u="${uid}">See details & quotes</button></div></div></article>`;
}
function stamp(v) { return ({ ok: ["✓", "Checks out"], no: ["≠", "Doesn't match"], half: ["½", "Depends / half-true"], cant: ["?", "Can't be checked"], na: ["n/a", "Not enough evidence"], seller: ["🗣", "Seller's word only"] })[v]; }
function claimGrid(claims, l) {
  return `<div class="stamps">${claims.map((c, i) => {
    const b = !l || !/\d|gb|hz|ssd|i[3579]|ryzen|rtx|gtx|kg|office|battery|ghante|never|heat|warranty|onsite|off|%|light|graphics/i.test(c) ? F.brandClaim(c) : null;
    if (b) return `<div class="stamp ${b.status === "summary" ? "evid" : "na"}"><div class="sv">${b.status === "summary" ? "Evidence so far" : "n/a"}</div><div class="sc">“${esc(c)}”</div><div class="sw2">${esc(b.why)}</div>${b.status === "summary" && b.mine.neg[0] ? `<div class="sq">“${esc(b.mine.neg[0].tags[b.topic === "hinge" ? "build" : b.topic] ? b.mine.neg[0].tags[b.topic === "hinge" ? "build" : b.topic][1] : b.mine.neg[0].text.slice(0, 120))}” <span class="rid">${b.mine.neg[0].rid}</span></div>` : ""}<div class="rev">Brand-level · awaiting review by a person</div></div>`;
    if (!l) return `<div class="stamp na"><div class="sv">?</div><div class="sc">“${esc(c)}”</div><div class="sw2">Tell me which laptop this is about to check it.</div></div>`;
    const r = F.checkClaim(c, l), [sym, lab] = stamp(r.v);
    const ev = r.ev ? `<div class="sq">“${esc(r.ev.tags.heat ? r.ev.tags.heat[1] : r.ev.text.slice(0, 120))}” <span class="rid">${r.ev.rid}</span></div>` : "";
    return `<div class="stamp ${r.v}"><div class="sv">${sym} ${lab}</div><div class="sc">“${esc(c)}”</div><div class="sw2">${esc(r.why)}</div>${ev}<div class="rev">${r.type} · source: ${r.v === "half" && r.type === "performance" ? "owner reviews" : esc(r.src)} · computed by code, awaiting review by a person</div></div>`;
  }).join("")}</div>`;
}

/* ---------- next steps (goal-aware) ---------- */
function offers(goal, ctx) {
  const l = ctx.laptop, n = ctx.n;
  const O = {
    decide: [["seller", "Draft questions for the seller"], ["alts", "Show laptops that fit you better"], ["share", "Make a summary to share"]],
    verify: [["reply", "Draft a polite reply to the seller"], ["seller", "Draft questions to ask before paying"], ["share", "Share this check with family"]],
    find: [["compare", "Compare my top 2 side by side"], ["seller", "Draft questions for the seller"], ["share", "Make a summary to share"]],
    proxy: [["family", "Make a simple summary for your " + (n.proxy || "family")], ["compare", "Compare the top 2"], ["seller", "Draft questions for the seller"]],
    used: [["checklist", "Make this a checklist for the shop visit"], ["seller", "Draft questions for the seller"]],
    reassure: [["return", "Show the return-window steps"], ["seller", "Draft a message to the seller"]],
  }[goal];
  const ask = { decide: "Want me to do one of these next?", verify: "Want me to write back to the seller for you?", find: "Next, shall I compare your top two?", proxy: "Shall I make something you can send?", used: "Going to see it in person?", reassure: "Need help with the next step?" }[goal];
  return `<div class="next"><div class="next-q">${ask}</div><div class="next-row">${O.map(([k, lab]) => `<button class="offer" data-offer="${k}" data-turn="${ctx.uid}">${esc(lab)}</button>`).join("")}</div><div class="draft" id="draft-${ctx.uid}"></div></div>`;
}
function draftText(kind, ctx) {
  const l = ctx.laptop || (ctx.sl && ctx.sl.ranked[0]), n = ctx.n, name = l ? l.name : "the laptop";
  const code = l && l.model_code ? l.model_code.split("|")[0].trim() : "the exact model code";
  const mism = (ctx.claimResults || []).filter(r => r.v === "no" || r.v === "half");
  switch (kind) {
    case "seller": return `Hi, before I buy ${name}:\n1. Please confirm the exact model code on the box and invoice (${code}).\n2. Is the warranty onsite or carry-in, and for how long? Please write it on the invoice.\n3. What is today's final price including all offers, and the replacement window?\n4. Is it a sealed new unit with a GST bill?`;
    case "reply": return `Hi, thanks for the details. I checked them against the listing and owner reviews:\n${mism.map(r => `- "${r.claim}": ${r.why}`).join("\n") || "- Everything you mentioned checks out."}\nCould you confirm these in writing before I pay? Thank you.`;
    case "share": case "family": return `${n.proxy ? "For " + n.proxy + ": " : ""}${name}\nPrice: ${l ? inr(l.price_inr) + " (listing in our data, check today's price)" : ""}\nWhy: ${l ? `${l.ram_gb} GB RAM, ${l.ssd_gb} GB SSD, ${l.weight_kg} kg, ${l.size_in}" screen` : ""}\nOwners: ${l ? F.TOPIC_LABEL.battery + " " + pct(F.topicStats(l, "battery", null)) + ", speed " + pct(F.topicStats(l, "performance", null)) : ""}\nChecked with LapFit: every number has a source.`;
    case "checklist": return `Shop visit checklist (10 min)\n☐ Serial on the sticker = serial in BIOS → check warranty on the maker's site\n☐ Battery report: cycles and remaining capacity\n☐ No BIOS/admin password; not enrolled with a company\n☐ Test every key, port, hinge, speakers, screen (dead pixels)\n☐ Original charger; bill or seller ID in writing`;
    case "return": return `Return or replacement: most marketplaces give a short replacement window (often 7–10 days) for defects, not for change of mind. Check the window on your order page today, keep the box, and note any problem with photos and dates.`;
  }
  return "";
}
function pct(st) { return st.enough ? Math.round(st.share * 100) + "% happy" : "too few reports"; }

/* ---------- turn ---------- */
let turnNo = 0;
function ask(text, forced) {
  if (!text.trim()) return;
  $("#home").hidden = true; thread.hidden = false;
  const you = document.createElement("div"); you.className = "you"; you.textContent = text; thread.appendChild(you);
  const claimsHere = F.splitClaims(text); let needsText = text; claimsHere.forEach(c => { needsText = needsText.replace(c, " "); });
  const ctx = { uid: "t" + (++turnNo), text, n: F.parseNeeds(needsText), match: forced ? { status: "one", laptop: F.byId[forced] } : F.matchLaptop(text), claims: F.splitClaims(text) };
  const prev = window._lastCtx;
  if (prev && /^(actually|budget|now|make it|also|change|it'?s for|for my)/i.test(text.trim()) && !ctx.claims.length && ctx.match.status === "none") {
    const nn = ctx.n; Object.assign(ctx, prev, { uid: ctx.uid, text });
    ctx.n = Object.assign({}, prev.n); if (nn.budget) ctx.n.budget = nn.budget, ctx.n.hard = nn.hard || prev.n.hard;
    if (nn.proxy) ctx.n.proxy = nn.proxy; if (nn.uses.length) ctx.n.uses = [...new Set([...prev.n.uses, ...nn.uses])];
    if (nn.ram) ctx.n.ram = nn.ram; nn.notBrands.forEach(b => ctx.n.notBrands.includes(b) || ctx.n.notBrands.push(b));
    ctx.changed = "Updated from your last message. Everything else is kept.";
  }
  const box = document.createElement("section"); box.className = "answer"; box.id = "ans-" + ctx.uid; thread.appendChild(box);
  box.innerHTML = `<div class="thinking">Reading your message · checking ${F.L.length} laptops and ${F.D.meta.unique_reviews.toLocaleString()} owner reviews…</div>`;
  setTimeout(() => { render(ctx); box.scrollIntoView({ behavior: "smooth", block: "start" }); }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 380);
  window._lastCtx = ctx;
}
function render(ctx) {
  const box = document.getElementById("ans-" + ctx.uid), n = ctx.n, m = ctx.match, uid = ctx.uid;
  if (m.status === "one") ctx.laptop = m.laptop;
  let goal = F.inferGoal(n, ctx.claims, m); if (m.status === "outside" && goal === "decide") goal = "outside"; ctx.goal = goal;
  let h = `<div class="who">LapFit</div><div class="und"><span class="und-l">What I understood</span>${chipsFor(n, m)}${ctx.changed ? `<span class="note">${esc(ctx.changed)}</span>` : ""}</div>`;

  // fact questions (never about modes)
  let q = null;
  if (m.status === "ambiguous") q = { t: `There are ${m.options.length} versions of this in our data. Which one is on your listing?`, tiles: m.options };
  else if (m.status === "one" && !n.uses.length && !ctx.claims.length && !n.used && !n.proxy) q = { t: "What will you mainly use it for? That changes what I check.", replies: ["College and coding", "Office work", "Gaming", "Movies and browsing"] };
  else if (goal === "find" && !n.budget && !n.ram) q = { t: "What's your budget? Meanwhile, here are the numbers I'd aim for.", replies: ["Under 40k", "Under 50k", "Under 70k", "Under 1 lakh"] };
  else if (goal === "proxy" && !n.uses.length) q = { t: `What will your ${n.proxy} mainly use it for?`, replies: ["Email and video calls", "Movies and browsing", "Studies", "Office work"] };

  if (m.status === "outside") {
    const alts = m.brandAlts.length ? m.brandAlts : F.shortlist(n).ranked.slice(0, 3);
    h += `<div class="sec"><h3 class="head warn">“${esc(m.name)}” isn't in our checked list yet</h3><p>In the product, LapFit looks it up on the maker's own site and shows the specs as “from the maker's page, as of today, not yet checked by us”, then checks your claims against them. This simulation has only ${F.L.length} laptops (2022 Flipkart listings).</p>
      ${alts.length ? `<p class="note">Closest in our data${m.brandAlts.length ? " from the same brand" : ""}:</p><div class="minis">${alts.slice(0, 3).map((l, i) => miniCard(l, n, i, uid)).join("")}</div>` : ""}</div>`;
  }
  if (q) {
    h += `<div class="q"><p>${esc(q.t)}</p>${q.tiles ? `<div class="tiles">${q.tiles.map(l => `<button class="tile" data-pick="${l.id}" data-turn="${uid}">${laptopSVG(l, 120)}<b>${esc(l.name)}</b><span>${esc(l.gpu || l.cpu)} · ${inr(l.price_inr)}</span><code>${esc((l.model_code || "").split("|")[0])}</code></button>`).join("")}</div><p class="note">Tip: the model code is on the box or the listing.</p>` : ""}
      ${q.replies ? `<div class="replies">${q.replies.map(r => `<button class="reply" data-reply="${esc(r)}" data-turn="${uid}">${esc(r)}</button>`).join("")}</div>` : ""}</div>`;
    if (goal === "find" && !n.budget) h += suggestedBlock(n);
    if (m.status === "ambiguous" || (m.status === "one" && !n.uses.length) || goal === "proxy" || (goal === "find" && !n.budget)) { box.innerHTML = h; return; }
  }

  // sections
  if (goal === "verify" && ctx.claims.length) {
    const l = ctx.laptop;
    ctx.claimResults = l ? ctx.claims.map(c => F.checkClaim(c, l)) : [];
    const counts = {}; ctx.claimResults.forEach(r => counts[r.v] = (counts[r.v] || 0) + 1);
    const head = l ? (ctx.claims.length === 1 ? `I checked what you were told about the ${l.name}` : `I checked the ${ctx.claims.length} things you were told about the ${l.name}`) : (ctx.claims.length === 1 ? "I checked what you were told" : `I checked the ${ctx.claims.length} things you were told`);
    h += `<div class="sec"><h3 class="head">${esc(head)}</h3>${l ? `<p class="lead">${Object.entries(counts).map(([k, v]) => `<b class="v-${k}">${v} ${stamp(k)[1].toLowerCase()}</b>`).join(" · ")}. Claims are judged, not people.</p>` : ""}
      ${claimGrid(ctx.claims, l)}<p class="src">Every verdict is approved by a person before it counts (within 24 hours). In this simulation all are computed by code and marked “awaiting review”.</p></div>`;
    if (l) h += `<div class="sec">${hero(l, n, uid)}${buyLinks(l)}</div>`;
    if (!l && (n.budget || n.uses.length)) { const sl = F.shortlist(n); ctx.sl = sl; h += shortlistBlock(sl, n, uid, "And laptops for what you need"); }
  } else if (goal === "used") {
    const l = ctx.laptop;
    h += `<div class="sec"><h3 class="head">Used-deal check${l ? ": " + esc(l.name) : ""}</h3>
      <ul class="fit"><li class="${l ? "ok" : "no"}">${l ? "✓ This model and configuration exist in our data (" + esc(l.model_code || "") + ")" : "? Model not in our data: ask for the model code"}</li>
      <li class="no">? Used price: no dated used-price data, so I can't say if it's fair</li><li class="ok">✓ No company-lock words found in what you pasted</li></ul>
      <p class="note">LapFit does not judge physical condition from photos. Use the checklist in person.</p></div>${l ? `<div class="sec">${hero(l, n, uid)}</div>` : ""}`;
  } else if (goal === "outside") {
    h += `<p class="note">Want me to check something else about it? Paste what the seller told you and I'll check what I can.</p>`;
  } else if (goal === "decide" || goal === "reassure") {
    const l = ctx.laptop, fr = fitRows(l, n), fails = fr.filter(r => !r[0] && r[2]), soft = fr.filter(r => !r[0] && !r[2]);
    const head = goal === "reassure" ? (fails.length ? `It mostly fits, but one thing doesn't match what you need` : `It fits what you told me`) : (fails.length ? "Good laptop, wrong for you" : "Good fit for what you need");
    h += `<div class="sec"><h3 class="head ${fails.length ? "bad" : "good"}">${head}</h3><p class="lead">${fails.length ? esc(fails.map(f => f[1]).join("; ")) + "." : "All your Musts pass."}${soft.length ? " Worth knowing: " + esc(soft.map(f => f[1]).join("; ")) + "." : ""}</p>${hero(l, n, uid)}${buyLinks(l)}</div>`;
    const sl = F.shortlist(Object.assign({}, n, { budget: n.budget || l.price_inr * 1.05, hard: true }));
    const better = sl.ranked.filter(x => x.id !== l.id).slice(0, 2);
    if (better.length) h += `<div class="sec" id="alts-${uid}"><h3>Also fits at this price</h3><div class="minis">${better.map((x, i) => miniCard(x, n, i, uid)).join("")}</div></div>`;
  } else {
    const sl = F.shortlist(n); ctx.sl = sl;
    if (!q) h += suggestedBlock(n);
    h += shortlistBlock(sl, n, uid, goal === "proxy" ? `For your ${n.proxy}` : null);
    if (n.wrongBelief) h += `<p class="note">For ${n.uses.join(" and ")}, 8 GB is usually enough; 16 GB helps with many tabs. I kept 16 GB as you asked.</p>`;
  }
  if (goal !== "outside") h += offers(goal, ctx);
  h += `<p class="foot">Simulation on real 2022 Flipkart data: ${F.L.length} laptops, ${F.D.meta.reviews.toLocaleString()} reviews. Prices are from those listings, not today's.</p>`;
  box.innerHTML = h;
}
function suggestedBlock(n) {
  const s = F.suggested(n);
  const sc = (lab, pos, v, why) => `<div class="scale"><span>${lab}</span><div class="sbar"><i style="left:calc(${pos}% - 2px)"></i></div><b>${v}</b><small>${esc(why)}</small></div>`;
  return `<div class="sec"><h3>Numbers I'd aim for${n.uses.length ? " (" + esc(n.uses.join(", ")) + ")" : ""}</h3>
   ${sc("Memory", s.ram.v >= 16 ? 75 : 50, s.ram.v + " GB", s.ram.why)}${sc("Storage", 60, s.ssd.v + " GB SSD", s.ssd.why)}${sc("Graphics", s.gpu.v ? 75 : 25, s.gpu.v ? "dedicated" : "built-in is fine", s.gpu.why)}
   <p class="src">Red: below what we suggest · amber: workable · green: comfortable. Rules of thumb, not measurements.</p></div>`;
}
function shortlistBlock(sl, n, uid, title) {
  if (!sl.ranked.length) return `<div class="sec"><h3 class="head bad">Nothing in our data meets all of these</h3>
    <p class="lead">Your Musts: ${sl.musts.map(m => esc(m.label)).join(" · ")}. Closest options, and the one thing each misses:</p>
    <div class="minis">${sl.closest.map((x, i) => miniCard(x.l, n, i, uid).replace('<div class="why">', `<div class="miss">Misses: ${x.broken.map(b => esc(b.label)).join(", ")}</div><div class="why">`)).join("")}</div>
    <p class="note">In the product this is checked across the full current catalogue before saying “nothing matches”.</p></div>`;
  return `<div class="sec"><h3>${esc(title || (sl.ranked.length === 1 ? "One laptop fits all your Musts" : sl.ranked.length + " laptops fit all your Musts"))}</h3>
   <p class="lead">${sl.musts.length ? "Checked by code: " + sl.musts.map(m => "✓ " + esc(m.label)).join(" · ") + ". " : ""}Ranked by how happy ${sl.lens ? "owners like you (" + sl.lens + ")" : "owners"} are with ${sl.topics.map(t => F.TOPIC_LABEL[t].toLowerCase()).join(", ")}.</p>
   <div class="minis">${sl.ranked.slice(0, 4).map((l, i) => miniCard(l, n, i, uid)).join("")}</div>
   ${sl.ranked.length > 4 ? `<p class="note">+${sl.ranked.length - 4} more that also fit.</p>` : ""}<div id="detail-${uid}"></div></div>`;
}

/* ---------- compare ---------- */
function openCompare() {
  const ls = [...compareSet].map(id => F.byId[id]).slice(0, 4);
  if (ls.length < 2) return;
  const n = (window._lastCtx || {}).n || F.parseNeeds(""), topics = ["performance", "battery", "heat", "build", "display", "keyboard"];
  const best = (f, hi) => { const v = ls.map(f); const b = hi ? Math.max(...v) : Math.min(...v); return v.map(x => x === b); };
  const row = (lab, f, fmt, hi) => { const w = best(f, hi); return `<tr><th>${lab}</th>${ls.map((l, i) => `<td class="${w[i] ? "win" : ""}">${fmt(l)}</td>`).join("")}</tr>`; };
  $("#cmp-body").innerHTML = `<div class="cmp-top">${ls.map(l => `<div>${laptopSVG(l)}<b>${esc(l.name)}</b></div>`).join("")}</div>
   <h4>Screens drawn to scale</h4>${screensToScale(ls)}
   <h4>Weight in your bag</h4><div class="cmp-btl">${ls.map(l => `<div>${bottles(l.weight_kg, n.maxKg)}<span class="note">${esc(l.name)}</span></div>`).join("")}</div>
   <h4>Side by side</h4><div class="table"><table><tbody>
   ${row("Price (2022)", l => l.price_inr, l => inr(l.price_inr), false)}${row("Memory", l => l.ram_gb, l => l.ram_gb + " GB", true)}${row("Storage", l => l.ssd_gb, l => l.ssd_gb + " GB", true)}
   ${row("Weight", l => l.weight_kg, l => l.weight_kg + " kg", false)}${row("Screen", l => l.size_in, l => l.size_in + "″" + (l.hz_stated ? " · " + l.hz + " Hz" : ""), true)}
   <tr><th>Graphics</th>${ls.map(l => `<td>${esc(l.gpu || "built-in")}</td>`).join("")}</tr>
   ${topics.map(t => { const s = ls.map(l => F.topicStats(l, t, null)); const vals = s.map(x => x.enough ? x.share : -1), b = Math.max(...vals); return `<tr><th>Owners: ${F.TOPIC_LABEL[t]}</th>${s.map((x, i) => `<td class="${vals[i] === b && b >= 0 ? "win" : ""}">${x.enough ? `<span class="hbar"><i style="width:${Math.round(x.share * 100)}%"></i></span> ${Math.round(x.share * 100)}% <small>n=${x.n}</small>` : `<small>too few (n=${x.n})</small>`}</td>`).join("")}</tr>`; }).join("")}
   </tbody></table></div><p class="src">Green cell: best of these on that row, from the data. Specs: 2022 Flipkart listings · owners: Flipkart reviews.</p>`;
  $("#cmp").hidden = false; $("#cmp-close").focus();
}
function updateCmpBar() { const b = $("#cmpbar"); b.hidden = compareSet.size < 1; $("#cmpcount").textContent = compareSet.size + " selected"; $("#cmpgo").disabled = compareSet.size < 2; }

/* ---------- events ---------- */
document.addEventListener("click", e => {
  const t = e.target.closest("button, input[type=checkbox]"); if (!t) return;
  const d = t.dataset;
  if (d.reply) { t.closest(".q").querySelectorAll("button").forEach(b => b.disabled = true); const c = window._lastCtx; ask(/^under/i.test(d.reply) ? "budget " + d.reply.replace(/^under /i, "under ") : (c && c.match.status === "one" ? c.text + " (for " + d.reply.toLowerCase() + ")" : (c ? c.text + ". " : "") + d.reply), c && c.match.status === "one" ? c.match.laptop.id : undefined); }
  else if (d.pick) { t.closest(".q").querySelectorAll("button").forEach(b => b.disabled = true); const c = window._lastCtx; const l = F.byId[d.pick]; ask(c.text + " (" + l.name + ", " + (l.model_code || "").split("|")[0] + ")", d.pick); }
  else if (d.rm) { const c = window._lastCtx; if (!c) return; const k = d.rm, n = c.n; if (k === "budget") n.budget = null; else if (k === "ram") n.ram = null; else if (k === "ssd") n.ssd = null; else if (k === "maxKg") n.maxKg = null; else if (k === "notGaming") n.notGaming = false; else if (k === "likes") n.likes = null; else if (k === "battery") n.battery = false; else if (k.startsWith("use:")) n.uses = n.uses.filter(u => u !== k.slice(4)); else if (k.startsWith("not:")) n.notBrands = n.notBrands.filter(b => b !== k.slice(4)); c.changed = "Removed. Results updated."; render(c); }
  else if (d.lensfor) { const l = F.byId[d.l]; const el = document.getElementById("ow-" + d.lensfor); el.outerHTML = ownersPanel(l, d.topics.split(","), d.k || null, d.lensfor); }
  else if (t.classList.contains("qbtn")) showQuotes(d.l, d.t, d.lens, d.u);
  else if (d.open) { const c = window._lastCtx, l = F.byId[d.open]; const box = document.getElementById("detail-" + d.u) || document.getElementById("alts-" + d.u) || t.closest(".sec"); const div = document.createElement("div"); div.className = "sec detail"; div.innerHTML = hero(l, c.n, d.u + "d" + l.id) + buyLinks(l); box.appendChild(div); div.scrollIntoView({ behavior: "smooth", block: "start" }); }
  else if (d.cmp) { t.checked ? compareSet.add(d.cmp) : compareSet.delete(d.cmp); if (compareSet.size > 4) { compareSet.delete(d.cmp); t.checked = false; } updateCmpBar(); }
  else if (d.offer) {
    const c = window._lastCtx; const box = document.getElementById("draft-" + d.turn);
    if (d.offer === "compare") { const ids = (c.sl ? c.sl.ranked : []).slice(0, 2).map(l => l.id); if (ids.length < 2) { box.innerHTML = `<p class="note">Only one laptop fits, so there's nothing to compare yet.</p>`; return; } compareSet = new Set(ids); updateCmpBar(); openCompare(); return; }
    if (d.offer === "alts") { const a = document.getElementById("alts-" + d.turn); if (a) { a.scrollIntoView({ behavior: "smooth" }); return; } box.innerHTML = `<p class="note">Nothing else in our data fits better at this price.</p>`; return; }
    const txt = draftText(d.offer, c);
    box.innerHTML = `<div class="draft-box"><div class="draft-h">Draft: edit it, then copy</div><textarea id="dt-${d.turn}" rows="7">${esc(txt)}</textarea><button class="offer" data-copy="dt-${d.turn}">Copy</button></div>`;
  }
  else if (d.copy) { const ta = document.getElementById(d.copy); (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => t.textContent = "Copied", () => { ta.select(); t.textContent = "Press Ctrl/Cmd+C"; }); }
  else if (t.id === "cmpgo") openCompare();
  else if (t.id === "cmp-close") $("#cmp").hidden = true;
  else if (d.ex) { $("#q").value = d.ex; $("#q").focus(); }
});
$("#form").addEventListener("submit", e => { e.preventDefault(); const v = $("#q").value; $("#q").value = ""; ask(v); });
$("#q").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#form").requestSubmit(); } });
document.addEventListener("keydown", e => { if (e.key === "Escape") $("#cmp").hidden = true; });
$("#new").onclick = () => { thread.innerHTML = ""; thread.hidden = true; $("#home").hidden = false; window._lastCtx = null; compareSet.clear(); updateCmpBar(); };
const EX = ["Shop wale bhaiya bol rahe: i5 11th gen, 16GB, 8 ghante battery, free onsite warranty, 40% off. Sach hai? MSI GF63 RTX 3050",
  "HP Pavilion for 60k, good for college coding?", "1st year CSE, under 70k, coding, long battery, don't want a gaming laptop",
  "laptop for my retired father under 40k, email, movies, he likes Lenovo, hates HP", "my friend said ASUS laptops are bad at battery, true?",
  "gaming laptop under 1.2 kg and 40k", "MacBook Air M1 for 85k for MBA, light to carry", "bought the ASUS TUF F15 yesterday for gaming, did I make a mistake?",
  "Victus 15 for 62k ok?", "I want it fast"];
$("#examples").innerHTML = EX.map(x => `<button class="ex" data-ex="${esc(x)}">${esc(x)}</button>`).join("");
if (location.hash.startsWith("#q=")) setTimeout(() => ask(decodeURIComponent(location.hash.slice(3))), 50);
$("#count").textContent = `${F.L.length} laptops · ${F.D.meta.reviews.toLocaleString()} owner reviews`;
})();
