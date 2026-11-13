// Everything here is counted from stored rows. No model is involved.
import { db, isShowable } from './db.js';
import { SETTINGS } from '../settings.js';
import { allModels, variantsOfModel, getVariant, queryEvidence, computeTrending, ratingFor, PERSONAS, PERSONA_LABEL, TOPICS, TOPIC_LABEL } from './engine.js';
import { fmtInr, fmtStorage } from './util.js';

const day = (n) => new Date(Date.now() - n * 86400000);

export function homeSummary() {
  const models = allModels().length;
  const reports = db.prepare(`SELECT COALESCE(SUM(n_reports),0) c FROM evidence_excerpt e WHERE ${isShowable('e')}`).get().c;
  const variants = db.prepare(`SELECT COUNT(*) c FROM variant v WHERE ${isShowable('v')}`).get().c;
  const t = computeTrending(SETTINGS.TREND_WINDOW_DAYS, 3);
  const unmet = demandSummary().unmet_share;
  return { models, variants, reports, days: t.days, most_checked: t.most_checked[0] || null, rising: t.rising[0] || null, drop: t.drops[0] || null, unmet_share: unmet };
}

export function demandSummary(days = 90) {
  const since = day(days).toISOString();
  const rows = db.prepare('SELECT budget_band, use_cases, musts, matched FROM demand_signal WHERE ts >= ?').all(since);
  const total = rows.length;
  const count = (arr) => Object.entries(arr.reduce((a, k) => ((a[k] = (a[k] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const bands = count(rows.map((r) => r.budget_band)).map(([label, n]) => ({ label, n }));
  const uses = count(rows.flatMap((r) => JSON.parse(r.use_cases))).slice(0, 5).map(([label, n]) => ({ label, n }));
  const musts = count(rows.flatMap((r) => JSON.parse(r.musts))).slice(0, 5).map(([label, n]) => ({ label, n }));
  const unmetRows = rows.filter((r) => r.matched === 0);
  const unmet = count(unmetRows.map((r) => JSON.stringify([r.budget_band, JSON.parse(r.musts)]))).slice(0, 5).map(([k, n]) => { const [band, ms] = JSON.parse(k); return { budget: band, musts: ms, n }; });
  return { days, total, bands, uses, musts, unmet, unmet_share: total ? Math.round((unmetRows.length / total) * 100) : 0 };
}

export function insightsFor(laptopId) {
  const m = allModels().find((x) => x.id === laptopId);
  if (!m) return null;
  const vs = variantsOfModel(laptopId);
  // persona x topic: average rating and n
  const rows = db.prepare(`SELECT persona, topic, SUM(n_reports) n, SUM(rating * n_reports) * 1.0 / SUM(n_reports) r FROM evidence_excerpt e WHERE e.laptop_id = ? AND ${isShowable('e')} AND persona IS NOT NULL AND rating IS NOT NULL GROUP BY persona, topic`).all(laptopId);
  const cell = new Map(rows.map((r) => [`${r.persona}|${r.topic}`, { n: r.n, rating: Math.round(r.r * 10) / 10 }]));
  const usedTopics = TOPICS.filter((t) => rows.some((r) => r.topic === t));
  const usedPersonas = PERSONAS.filter((p) => rows.some((r) => r.persona === p));
  const matrix = { topics: usedTopics.map((t) => ({ value: t, label: TOPIC_LABEL[t] })), rows: usedPersonas.map((p) => ({ persona: p, label: PERSONA_LABEL[p], cells: usedTopics.map((t) => cell.get(`${p}|${t}`) || null) })), min_n: SETTINGS.MIN_EVIDENCE_N };
  // price history per variant
  const price = vs.map((v) => {
    const h = db.prepare(`SELECT price_inr, timestamp FROM price_history x WHERE x.variant_id = ? AND ${isShowable('x')} ORDER BY timestamp`).all(v.variant_id);
    return { variant_id: v.variant_id, label: `${v.ram_gb} GB, ${fmtStorage(v.storage_gb)}`, points: [...h.map((p) => ({ t: p.timestamp.slice(0, 10), v: p.price_inr })), { t: v.price_as_of, v: v.price_inr }].filter((p, i, a) => i === 0 || p.t !== a[i - 1].t || p.v !== a[i - 1].v) };
  });
  // checks per week, last 8 weeks
  const weeks = [];
  for (let w = 7; w >= 0; w--) {
    const a = day((w + 1) * 7).toISOString(), b = day(w * 7).toISOString();
    weeks.push({ label: w === 0 ? 'This week' : `${w}w ago`, n: db.prepare('SELECT COUNT(*) c FROM view_events WHERE laptop_id = ? AND ts >= ? AND ts < ?').get(laptopId, a, b).c });
  }
  const trend = computeTrending(SETTINGS.TREND_WINDOW_DAYS, 50);
  const rating = ratingFor(laptopId);
  const allRatings = allModels().map((x) => ratingFor(x.id)).filter((r) => r.enough);
  return {
    laptop: { id: m.id, name: `${m.brand} ${m.line}`, year: m.year, weight_kg: m.weight_kg, hinge_type: m.hinge_type },
    variants: vs.map((v) => ({ variant_id: v.variant_id, label: `${v.ram_gb} GB, ${fmtStorage(v.storage_gb)}`, price_inr: v.price_inr, price_text: fmtInr(v.price_inr), as_of: v.price_as_of })),
    rating, catalog_rated: allRatings.length, matrix, price, weeks,
    rising: trend.rising.filter((r) => r.laptop_id === laptopId), drops: trend.drops.filter((d) => d.laptop_id === laptopId),
    topics: queryEvidence({ laptop_id: laptopId }).flatMap((r) => r.topics),
  };
}

const MILESTONES = [1, 6, 12];
export function garageSummary(items) {
  const out = [];
  for (const it of (Array.isArray(items) ? items : []).slice(0, 10)) {
    const v = getVariant(String(it.variant_id));
    const bought = new Date(String(it.bought_on));
    if (!v || isNaN(bought) || bought > new Date()) continue;
    const paid = Number(it.paid_inr) > 0 && Number(it.paid_inr) < 1e7 ? Math.round(Number(it.paid_inr)) : null;
    const months = Math.max(0, Math.floor((Date.now() - bought) / (30.44 * 86400000)));
    const end = new Date(bought); end.setFullYear(end.getFullYear() + (v.warranty_years || 0));
    const daysLeft = Math.ceil((end - Date.now()) / 86400000);
    const band = SETTINGS.USED_PRICE_BAND;
    const trend = computeTrending(SETTINGS.TREND_WINDOW_DAYS, 50);
    out.push({
      variant_id: v.variant_id, laptop_id: v.model_id, name: `${v.brand} ${v.line}`, variant_label: `${v.ram_gb} GB RAM, ${fmtStorage(v.storage_gb)}`,
      bought_on: String(it.bought_on).slice(0, 10), months_owned: months, paid_inr: paid, paid_text: paid ? fmtInr(paid) : null,
      price_now: v.price_inr, price_now_text: fmtInr(v.price_inr), price_as_of: v.price_as_of,
      price_gap: paid ? paid - v.price_inr : null, price_gap_text: paid ? fmtInr(Math.abs(paid - v.price_inr)) : null,
      warranty: v.warranty, warranty_ends: end.toISOString().slice(0, 10), warranty_days_left: daysLeft,
      resale_low: Math.round(v.price_inr * band.low / 100) * 100, resale_high: Math.round(v.price_inr * band.high / 100) * 100,
      rating: ratingFor(v.model_id), report_due: months >= MILESTONES[0],
      issues: trend.rising.filter((r) => r.laptop_id === v.model_id),
    });
  }
  return out;
}
