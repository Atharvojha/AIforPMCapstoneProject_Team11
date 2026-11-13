/* LapFit simulation: back-end logic (runs in the browser; also testable in Node).
   Real data: window.LAPFIT_DATA (14 Flipkart laptops, 3,300 reviews). Rules only, no model. */
(function (G) {
const D = G.LAPFIT_DATA;
const L = D.laptops, R = D.reviews.filter(r => !r.dup);
const byId = Object.fromEntries(L.map(l => [l.id, l]));
const MIN_N = 5;

/* ---------- catalogue matching ---------- */
const ALIASES = {
  "FKL-01": ["tuf a17", "tuf gaming a17", "a17", "fa706"], "FKL-02": ["hp pavilion", "pavilion gaming", "pavilion", "ec2145"],
  "FKL-03": ["gf63", "msi gf63", "11sc"], "FKL-04": ["ideapad gaming", "82k1"], "FKL-05": ["tuf f15", "tuf gaming f15", "f15", "fx506"],
  "FKL-06": ["gf63", "msi gf63", "11uc"], "FKL-07": ["hp pavilion", "pavilion gaming", "pavilion", "ec2004"],
  "FKL-08": ["vivobook pro 15", "vivobook pro", "m6500"], "FKL-09": ["vivobook 15", "x515", "vivobook"],
  "FKL-10": ["macbook air m1", "macbook air", "macbook", "mgn93"], "FKL-11": ["ideapad 3", "15alc6"],
  "FKL-12": ["ideapad 3", "81wq"], "FKL-13": ["hp 15s", "15s", "eq2144"], "FKL-14": ["hp 14s", "14s", "dy2507"],
};
const ALSO_TUF = ["tuf gaming", "asus tuf", "tuf"];
const NOT_IN_CATALOGUE = ["victus", "loq", "legion", "omen", "inspiron", "vostro", "latitude", "xps", "thinkpad", "zenbook", "aspire", "nitro",
  "swift", "predator", "rog", "galaxy book", "surface", "ideapad slim", "yoga", "envy", "spectre", "macbook pro", "air m2", "air m3", "air m4",
  "elitebook", "probook", "chromebook", "infinix", "redmi book", "katana", "modern 14", "g15"];
function hasWord(t, w) { return new RegExp("(^|[^a-z0-9])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)").test(t); }
function matchLaptop(text) {
  const t = text.toLowerCase();
  const outside = NOT_IN_CATALOGUE.find(w => hasWord(t, w));
  let scored = L.map(l => {
    let s = 0;
    for (const a of ALIASES[l.id]) if (hasWord(t, a)) s = Math.max(s, a.length);
    if (!s && (l.id === "FKL-01" || l.id === "FKL-05")) for (const a of ALSO_TUF) if (hasWord(t, a)) s = Math.max(s, 3);
    if (s) {
      if (/3050/.test(t)) s += l.gpu && /3050/.test(l.gpu) ? 5 : -5;
      if (/1650/.test(t)) s += l.gpu && /1650/.test(l.gpu) ? 5 : -5;
      if (/ryzen|r5/.test(t)) s += /ryzen|r\d-/i.test(l.cpu || "") ? 4 : -4;
      if (/celeron/.test(t)) s += /celeron/i.test(l.cpu || "") ? 4 : -4;
      if (/\bi3\b/.test(t)) s += /i3/i.test(l.cpu || "") ? 4 : -4;
      if (/\bi5\b/.test(t)) s += /i5/i.test(l.cpu || "") ? 4 : -4;
    }
    return { l, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  if (outside && (!scored.length || scored[0].s < 6)) return { status: "outside", name: outside, brandAlts: brandOf(t) };
  if (!scored.length) return { status: "none" };
  const top = scored.filter(x => x.s === scored[0].s).map(x => x.l);
  return top.length > 1 ? { status: "ambiguous", options: top } : { status: "one", laptop: top[0] };
}
function brandOf(t) {
  const b = ["asus", "hp", "lenovo", "msi", "apple", "dell", "acer"].find(x => hasWord(t, x) || (x === "apple" && /macbook/.test(t)) || (x === "lenovo" && /thinkpad|legion|loq|ideapad|yoga/.test(t)) || (x === "hp" && /victus|omen|envy|spectre|pavilion/.test(t)) || (x === "asus" && /rog|zenbook|tuf|vivobook/.test(t)));
  return b ? L.filter(l => l.brand.toLowerCase() === b) : [];
}

/* ---------- money and needs ---------- */
function money(t) {
  const s = t.toLowerCase().replace(/,/g, "");
  let m = s.match(/(\d+(?:\.\d+)?)\s*(lakh|lac|l)\b/); if (m) return Math.round(parseFloat(m[1]) * 100000);
  m = s.match(/(\d+(?:\.\d+)?)\s*k\b/); if (m) return Math.round(parseFloat(m[1]) * 1000);
  m = s.match(/(?:₹|rs\.?|inr)\s*(\d{4,7})/); if (m) return +m[1];
  m = s.match(/\b(\d{5,6})\b/); if (m) return +m[1];
  const w = { "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90 };
  m = s.match(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety) thousand/); if (m) return w[m[1]] * 1000;
  if (/\bone lakh\b/.test(s)) return 100000;
  return null;
}
const USES = {
  coding: /\b(coding|cse|programming|developer|python|java|full.?stack)\b/i, gaming: /\b(gaming|gamer|valorant|gta|games?|fps|cs2|pubg)\b/i,
  editing: /\b(video editing|editing|premiere|davinci|creator|photoshop)\b/i, office: /\b(office|excel|tally|gst|accounts?|email|word)\b/i,
  study: /\b(college|student|1st year|first year|btech|b\.tech|mba|bba|school|study|online class)\b/i, media: /\b(movies|youtube|netflix|serials)\b/i,
};
const LENS_FOR_USE = { gaming: "gamers", coding: "coders", study: "students", office: "office" };
function parseNeeds(t) {
  const low = t.toLowerCase(), n = { raw: t };
  n.budget = money(t.replace(/(\d+)\s*(gb|tb|hz|kg|hours?|hrs?|%)/gi, ""));
  n.hard = /\b(max|under|below|within|compulsory|can'?t go|not more than|upto|up to)\b|≤|<=/.test(low);
  const ram = low.match(/(\d{1,2})\s*(gb|gigs?)\s*(ram)?(?!\s*ssd)/); n.ram = ram ? +ram[1] : null;
  if (n.ram && n.ram > 64) n.ram = null;
  const ssd = low.match(/(\d{3,4})\s*gb\s*(ssd|storage)|\/\s*(\d{3,4})\s*(?:gb)?\b|(\d)\s*tb|half a tb/);
  n.ssd = ssd ? (ssd[1] ? +ssd[1] : ssd[3] ? +ssd[3] : ssd[4] ? +ssd[4] * 1024 : 512) : null;
  const kg = low.match(/(?:under|below|less than|max|≤)\s*(\d(?:\.\d)?)\s*kg/); n.maxKg = kg ? +kg[1] : (/\b(light|lightweight|portable|carry|travel)\b/.test(low) ? 1.8 : null);
  n.maxKgSoft = !kg;
  n.uses = Object.keys(USES).filter(k => USES[k].test(t));
  n.notBrands = [...low.matchAll(/\b(?:not|no|hates?|avoid|except|other than)\s+(?:a\s+)?(dell|hp|lenovo|asus|acer|msi|apple|mac(?:book)?)\b/g)].map(m => m[1].startsWith("mac") ? "apple" : m[1]);
  n.notGaming = /(don'?t|do not|not)\s+(really\s+)?(want\s+)?(a\s+)?gaming laptop|no gaming laptop|not a gaming/.test(low);
  if (n.notGaming) n.uses = n.uses.filter(u => u !== "gaming");
  n.likes = (low.match(/\b(?:likes?|prefers?)\s+(lenovo|dell|hp|asus|acer|apple|msi)/) || [])[1] || null;
  n.battery = /\b(battery|backup|all day|long lasting)\b/.test(low);
  n.vague = /\b(fast|doesn'?t hang|smooth|powerful|speedy)\b/.test(low);
  n.city = (low.match(/\b(?:in|at|from)\s+(hyderabad|warangal|prayagraj|delhi|mumbai|bangalore|bengaluru|chennai|pune|kolkata|lucknow|jaipur|vizag|indore|patna|kochi|odisha)\b/) || [])[1] || null;
  const pm = low.match(/\bfor (?:my )?(retired )?(father|dad|mother|mom|daughter|son|sister|brother|wife|husband|cousin|uncle|aunt|grandfather|grandmother|kid|child)\b/);
  n.proxy = pm ? (pm[1] || "") + pm[2] : null;
  n.used = /\b(refurb\w*|second.?hand|pre.?owned|grade a|ssd health|battery health|battery cycles?|gameloot|edify|olx)\b/.test(low) || (/\bused\b/.test(low) && !/\bi used\b/.test(low));
  n.bought = /\b(bought|purchased|ordered|got it)\b/.test(low) && /\b(yesterday|today|last week|already|just)\b/.test(low);
  n.wrongBelief = n.ram >= 16 && n.uses.length && n.uses.every(u => u === "office" || u === "media") ? "office16" : null;
  return n;
}

/* ---------- claims ---------- */
const CLAIM_CUE = /(bol rahe|salesman|seller|shopkeeper|shop wale|listing says|youtuber|said|told|says|claims?|sach hai|is (it|that) true|true\?|nijamena|antunnaru)/i;
const CLAIM_SIGNAL = /\d\s*(gb|tb|hz|kg|%|hours?|hrs?|ghante)|\b(i[3579]|ryzen|rtx|gtx|ssd|battery|warranty|onsite|never|always|best|heats?|light|office|graphics|gen|discount|off|display|screen|hinges?|breaks?|service|fan|keyboard|build|quality|lags?|hangs?)\b/i;
function splitClaims(t) {
  if (!CLAIM_CUE.test(t)) return [];
  const body = t
    .replace(/\b(the |a |my )?(seller|salesman|shopkeeper|shop wale bhaiya|shop wale|bhaiya|youtuber|dealer)\b\s*(said that|said|says|told me|bol rahe(?: the| hain)?)?\s*:?/gi, "|")
    .replace(/\b(listing says|they say|he said|she said|told me)\s*:?/gi, "|")
    .replace(/\b(is (it|that|this) true|sach hai|nijamena|true)\b\s*\??/gi, "|")
    .replace(/\b(my friend|friends?|people|everyone)?\s*\b(says|said)\b/gi, "|");
  const segs = body.split(/\||\?|\.\s+(?=I'?m\b|I am\b|Need\b|My\b|Budget\b|Also\b)/i).map(x => x.trim()).filter(Boolean);
  const seg = segs.find(x => CLAIM_SIGNAL.test(x) && x.split(/,|;|\band\b|\baur\b/i).filter(p => CLAIM_SIGNAL.test(p)).length >= Math.min(2, x.split(/,/).length)) || segs.find(x => CLAIM_SIGNAL.test(x));
  if (!seg) return [];
  return seg.split(/,|;|\band\b|\baur\b/i).map(x => x.trim().replace(/^(that|it has|it's|it is|has)\s+/i, "").replace(/[.\s]+$/, "")).filter(x => x.length > 1 && x.length < 80 && CLAIM_SIGNAL.test(x)).slice(0, 8);
}
function hoursFrom(s) { const m = s.match(/(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(?:\d+\s*)?(hours?|hrs?|hr|h\b|ghante)/i); return m ? parseFloat(m[1]) : null; }
function ownerHours(l) {
  const out = [];
  for (const r of R) if (r.lid === l.id && r.tags.battery) { const h = hoursFrom(r.tags.battery[1]); if (h && h >= 0.5 && h <= 20) out.push({ h, r }); }
  return out;
}
function checkClaim(c, l) {
  const t = c.toLowerCase(), V = (v, why, type, ev) => ({ claim: c, v, why, type, ev: ev || null, src: "Flipkart listing title (2022)" });
  if (/%|off\b|discount|mrp/.test(t)) {
    const pct = (t.match(/(\d{1,2})\s*%/) || [])[1];
    return V("seller", pct ? `A ${pct}% discount depends on the MRP, which isn't in our data. The listing price we hold is ₹${l.price_inr.toLocaleString("en-IN")} (2022).` : "Discounts depend on the MRP, which isn't in our data.", "price");
  }
  if (/warranty|onsite|on-site|service|support/.test(t)) return V("cant", "Warranty and service terms aren't in our data. Ask for them in writing on the invoice.", "service");
  if (/best|no\.?\s?1|number one|top/.test(t)) return V("cant", "\"Best\" is an opinion, so it can't be checked. The owner ratings below show how it compares.", "superlative");
  if (/never|no heat|doesn'?t heat|won'?t heat|cool always|heat nahi/.test(t)) {
    const neg = R.filter(r => r.lid === l.id && r.tags.heat && r.tags.heat[0] === "neg");
    return neg.length ? V("no", `${neg.length} owners mention heat problems, so "never" doesn't hold.`, "absolute", neg[0]) : V("na", "Too few heat reports to test an absolute claim.", "absolute");
  }
  const ram = t.match(/(\d{1,2})\s*gb(?!\s*(ssd|storage|graphics|gpu))/);
  if (ram && !/ssd|storage/.test(t)) return +ram[1] === l.ram_gb ? V("ok", `Listing: ${l.ram_gb} GB RAM.`, "spec") : V("no", `Listing says ${l.ram_gb} GB RAM, not ${ram[1]} GB.`, "spec");
  const ssd = t.match(/(\d{3,4})\s*gb|(\d)\s*tb/);
  if (ssd && /ssd|storage|gb/.test(t)) { const g = ssd[1] ? +ssd[1] : +ssd[2] * 1024; return g === l.ssd_gb ? V("ok", `Listing: ${l.ssd_gb} GB SSD.`, "spec") : V("no", `Listing says ${l.ssd_gb} GB SSD.`, "spec"); }
  if (/ssd/.test(t)) return l.ssd_gb <= 256 ? V("half", `Yes, an SSD, but only ${l.ssd_gb} GB, which fills up fast with projects or games.`, "half-truth") : V("ok", `${l.ssd_gb} GB SSD.`, "spec");
  const hz = t.match(/(\d{2,3})\s*hz/);
  if (hz) return l.hz_stated && +hz[1] === l.hz ? V("ok", `Listing: ${l.hz} Hz display.`, "spec") : l.hz_stated ? V("no", `Listing says ${l.hz} Hz.`, "spec") : V("na", "The listing doesn't state the refresh rate.", "spec");
  const gpu = t.match(/(rtx|gtx)\s*(\d{4})/);
  if (gpu) return l.gpu && l.gpu.toLowerCase().includes(gpu[2]) ? V("ok", `Listing: ${l.gpu}.`, "spec") : V("no", l.gpu ? `Listing says ${l.gpu}.` : "No dedicated graphics in the listing.", "spec");
  if (/graphics|gpu/.test(t)) return l.dgpu ? V("ok", `${l.gpu}.`, "spec") : V("no", "No dedicated graphics card in the listing.", "spec");
  const gen = t.match(/(i[3579])\s*(\d{1,2})(?:th|rd|nd)?\s*gen/);
  if (gen) { const ok = (l.cpu || "").toLowerCase().includes(gen[1]) && (l.cpu || "").includes(gen[2] + "th"); return ok ? V("ok", `Listing: ${l.cpu}.`, "spec") : V("no", `Listing says ${l.cpu}.`, "spec"); }
  if (/ryzen|i[3579]\b|m1|celeron/.test(t)) { const k = (t.match(/ryzen\s*\d|i[3579]|m1|celeron/) || [""])[0].replace(/\s/g, ""); return (l.cpu || "").toLowerCase().replace(/\s/g, "").includes(k) || (k === "m1" && l.id === "FKL-10") ? V("ok", `Listing: ${l.cpu}.`, "spec") : V("no", `Listing says ${l.cpu}.`, "spec"); }
  const kg = t.match(/(\d(?:\.\d+)?)\s*kg/);
  if (kg) return Math.abs(+kg[1] - l.weight_kg) <= 0.05 ? V("ok", `Listing: ${l.weight_kg} kg.`, "spec") : V("no", `Listing says ${l.weight_kg} kg.`, "spec");
  if (/light|lightweight|halka/.test(t)) return l.weight_kg <= 1.5 ? V("ok", `${l.weight_kg} kg, light for a laptop.`, "spec") : V("half", `${l.weight_kg} kg: heavier than most thin laptops (under 1.5 kg).`, "spec");
  if (/office|ms office/.test(t)) return l.office ? V("ok", "The listing includes MS Office.", "bundle") : V("no", "MS Office isn't mentioned in the listing.", "bundle");
  if (/battery|ghante|hours?|hrs?|backup/.test(t)) {
    const claimed = hoursFrom(t), hs = ownerHours(l).map(x => x.h).sort((a, b) => a - b);
    if (hs.length < 3) return V("na", `Only ${hs.length} owners gave battery hours, too few to check.`, "performance");
    const med = hs[Math.floor(hs.length / 2)];
    if (!claimed) return V("half", `Owners report a median of about ${med} hours (n=${hs.length}).`, "performance");
    return med >= claimed * 0.9 ? V("ok", `Owners report a median of about ${med} hours (n=${hs.length}).`, "performance") : V("half", `Maybe in light use. Owners report a median of about ${med} hours (n=${hs.length}).`, "performance");
  }
  if (/gaming|games|gta|valorant/.test(t)) return l.dgpu ? V("half", `It has ${l.gpu}. How well a game runs depends on the title and settings; see the gamer owners below.`, "performance") : V("no", "No dedicated graphics, so not suited to modern games.", "performance");
  return V("cant", "We couldn't match this to anything we can check.", "other");
}

/* brand-level claim: owners of that brand vs owners of other brands (macro average over laptops with enough reports) */
const TOPIC_OF = [["hinge", "build", /hinge/i], ["build", "build", /build|quality|plastic|sturdy|body/i], ["battery", "battery", /battery|backup|drain/i],
  ["heat", "heat", /heat|hot|fan|temperature/i], ["service", null, /service|support|warranty/i], ["keyboard", "keyboard", /keyboard|keys/i],
  ["performance", "performance", /lag|hang|slow|fast|speed|performance/i], ["display", "display", /display|screen/i]];
function brandClaim(c) {
  const t = c.toLowerCase();
  const brand = ["asus", "hp", "lenovo", "msi", "apple", "dell", "acer"].find(b => new RegExp("\\b" + b + "\\b").test(t) || (b === "apple" && /mac/.test(t)));
  const tp = TOPIC_OF.find(x => x[2].test(t));
  if (!brand || !tp) return null;
  const mine = L.filter(l => l.brand.toLowerCase() === brand), others = L.filter(l => l.brand.toLowerCase() !== brand);
  if (!mine.length) return { claim: c, brand, topic: tp[0], status: "no-data", why: `We have no ${brand.toUpperCase()} laptops in our data, so we can't check this.` };
  if (!tp[1]) return { claim: c, brand, topic: tp[0], status: "no-data", why: "Service experience isn't in our review data yet (it needs owner reports by city)." };
  const filt = r => tp[0] === "hinge" ? /hinge/i.test(r.text) : true;
  const agg = ls => { let shares = [], n = 0, neg = []; for (const l of ls) { const rs = R.filter(r => r.lid === l.id && r.tags[tp[1]] && filt(r)); const p = rs.filter(r => r.tags[tp[1]][0] === "pos").length, q = rs.filter(r => r.tags[tp[1]][0] === "neg"); n += rs.length; neg.push(...q); if (p + q.length >= 3) shares.push(q.length / (p + q.length)); } return { n, models: shares.length, negShare: shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null, neg }; };
  const a = agg(mine), b = agg(others);
  const enough = a.n >= 20 && a.models >= 1 && b.n >= 20;
  return { claim: c, brand, topic: tp[0], status: enough ? "summary" : "thin", mine: a, others: b, models: mine.length,
    why: enough ? `${brand.toUpperCase()} owners: ${Math.round(a.negShare * 100)}% of ${tp[0]} mentions are complaints (${a.n} reports, ${mine.length} models). Other brands: ${Math.round(b.negShare * 100)}% (${b.n} reports).`
                : `Only ${a.n} ${brand.toUpperCase()} owner reports mention ${tp[0]}, too few to judge a whole brand.` };
}

/* ---------- owner evidence ---------- */
const TOPIC_LABEL = { battery: "Battery", heat: "Heat & fan", performance: "Speed", display: "Screen", keyboard: "Keyboard", build: "Build", sound: "Sound", webcam: "Webcam", weight: "Weight", value: "Value", gaming: "Gaming" };
function topicStats(l, topic, lens) {
  const rs = R.filter(r => r.lid === l.id && r.tags[topic] && (!lens || r.lens.includes(lens)));
  const pos = rs.filter(r => r.tags[topic][0] === "pos"), neg = rs.filter(r => r.tags[topic][0] === "neg"), mix = rs.filter(r => r.tags[topic][0] === "mixed");
  const decided = pos.length + neg.length;
  return { n: rs.length, pos: pos.length, neg: neg.length, mixed: mix.length, share: decided ? pos.length / decided : null, enough: decided >= MIN_N, rs, posR: pos, negR: neg };
}
function wilson(p, n) { if (!n) return 0; const z = 1.96; return (p + z * z / (2 * n) - z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / (1 + z * z / n); }
function topicsFor(n) {
  const t = new Set(["performance", "battery", "heat", "build"]);
  if (n.uses.includes("gaming")) t.add("gaming");
  if (n.uses.includes("media") || n.uses.includes("editing")) t.add("display");
  if (n.uses.includes("coding") || n.uses.includes("office")) t.add("keyboard");
  if (n.maxKg) t.add("weight");
  return [...t];
}
function lensFor(n) { for (const u of n.uses) if (LENS_FOR_USE[u]) return LENS_FOR_USE[u]; return null; }
function quotesFor(l, topic, lens, k) {
  const s = topicStats(l, topic, lens);
  const pick = arr => arr.filter(r => r.tags[topic][1].length > 25).sort((a, b) => b.tags[topic][1].length - a.tags[topic][1].length).slice(0, k);
  return { pos: pick(s.posR), neg: pick(s.negR), stats: s };
}

/* ---------- suggested numbers and shortlist ---------- */
function suggested(n) {
  const heavy = n.uses.some(u => ["coding", "editing", "gaming"].includes(u));
  return {
    ram: { v: heavy ? 16 : 8, why: heavy ? "Coding tools, editors and games run several heavy apps at once; 16 GB keeps them smooth." : "Enough for browsing, documents and video calls." },
    ssd: { v: 512, why: "Room for apps, projects and updates; 256 GB fills up within a year for most students." },
    gpu: { v: n.uses.includes("gaming") || n.uses.includes("editing"), why: n.uses.includes("gaming") ? "Games need a dedicated graphics card." : n.uses.includes("editing") ? "Video editing exports much faster with one." : "Not needed for your use." },
    kg: { v: n.maxKg || null, why: "Under about 1.8 kg is comfortable to carry daily." },
  };
}
function shortlist(n) {
  const sug = suggested(n), lens = lensFor(n), topics = topicsFor(n);
  const musts = [];
  if (n.budget) musts.push({ k: "budget", label: "≤ ₹" + n.budget.toLocaleString("en-IN"), test: l => l.price_inr <= n.budget * (n.hard ? 1 : 1.05) });
  if (n.ram) musts.push({ k: "ram", label: n.ram + " GB RAM", test: l => l.ram_gb >= n.ram });
  if (n.ssd) musts.push({ k: "ssd", label: n.ssd + " GB SSD", test: l => l.ssd_gb >= n.ssd });
  if (n.maxKg && !n.maxKgSoft) musts.push({ k: "kg", label: "≤ " + n.maxKg + " kg", test: l => l.weight_kg <= n.maxKg });
  if (n.uses.includes("gaming")) musts.push({ k: "gpu", label: "graphics card", test: l => l.dgpu });
  n.notBrands.forEach(b => musts.push({ k: "not-" + b, label: "not " + b, test: l => l.brand.toLowerCase() !== b }));
  if (n.notGaming) musts.push({ k: "notgaming", label: "not a gaming laptop", test: l => l.kind !== "Gaming" });
  const pass = L.filter(l => musts.every(m => m.test(l)));
  const score = l => {
    let s = 0, w = 0;
    for (const t of topics) { const st = topicStats(l, t, lens); const st2 = st.enough ? st : topicStats(l, t, null); if (st2.enough) { s += wilson(st2.share, st2.pos + st2.neg); w++; } }
    let base = w ? s / w : 0.3;
    if (n.maxKg && n.maxKgSoft) base -= Math.max(0, l.weight_kg - n.maxKg) * 0.15;
    if (n.likes && l.brand.toLowerCase() === n.likes) base += 0.03;
    if (!n.ram && l.ram_gb >= sug.ram.v) base += 0.02;
    return base;
  };
  const ranked = pass.map(l => ({ l, s: score(l) })).sort((a, b) => b.s - a.s || a.l.price_inr - b.l.price_inr).map(x => x.l);
  let closest = [];
  if (!ranked.length) closest = L.map(l => ({ l, broken: musts.filter(m => !m.test(l)) })).sort((a, b) => a.broken.length - b.broken.length || a.l.price_inr - b.l.price_inr).slice(0, 3);
  return { musts, ranked, closest, lens, topics, sug };
}

/* ---------- goal inference ---------- */
function inferGoal(n, claims, match) {
  if (n.bought) return "reassure";
  if (n.used) return "used";
  if (n.proxy) return "proxy";
  if (claims.length) return "verify";
  if (match && match.status !== "none") return "decide";
  return "find";
}

G.LF = { brandClaim, D, L, R, byId, MIN_N, matchLaptop, parseNeeds, splitClaims, checkClaim, topicStats, quotesFor, ownerHours, suggested, shortlist, inferGoal, topicsFor, lensFor, TOPIC_LABEL, money };
})(typeof window !== "undefined" ? window : globalThis);
