// Code decides everything shown: which laptops qualify, ranking, prices, spec values.
// The model never touches this file's output.
import { db, isShowable } from './db.js';
import { SETTINGS } from '../settings.js';
import { fmtInr, fmtDate, fmtStorage, parseInrAmounts } from './util.js';

/* ---------- attributes, operators, values ---------- */
export const ATTRS = {
  ram_gb:         { col: 'v.ram_gb',        kind: 'num', defOp: '>=' },
  storage_gb:     { col: 'v.storage_gb',    kind: 'num', defOp: '>=' },
  weight_kg:      { col: 'm.weight_kg',     kind: 'num', defOp: '<=' },
  price_inr:      { col: 'v.price_inr',     kind: 'num', defOp: '<=' },
  display_size:   { col: 'm.display_size',  kind: 'num', defOp: '>=' },
  warranty_years: { col: 'm.warranty_years',kind: 'num', defOp: '>=' },
  year:           { col: 'm.year',          kind: 'num', defOp: '>=' },
  hinge_type:     { col: 'm.hinge_type',    kind: 'enum', defOp: 'in' },
  colour:         { col: null,              kind: 'colour', defOp: 'in' },
};
const ALIAS = {
  ram: 'ram_gb', memory: 'ram_gb', ram_gb: 'ram_gb',
  storage: 'storage_gb', ssd: 'storage_gb', storage_gb: 'storage_gb', disk: 'storage_gb',
  weight: 'weight_kg', weight_kg: 'weight_kg', kg: 'weight_kg',
  price: 'price_inr', budget: 'price_inr', price_inr: 'price_inr', cost: 'price_inr',
  screen: 'display_size', screen_size: 'display_size', display: 'display_size', display_size: 'display_size', size: 'display_size',
  warranty: 'warranty_years', warranty_years: 'warranty_years',
  year: 'year', model_year: 'year',
  hinge: 'hinge_type', hinge_type: 'hinge_type', form_factor: 'hinge_type', type: 'hinge_type',
  colour: 'colour', color: 'colour', colours: 'colour', colors: 'colour',
};
export const normAttr = (a) => ALIAS[String(a).toLowerCase().trim().replace(/[\s-]+/g, '_')] ?? null;

const OPS = {
  '>=': '>=', '≥': '>=', gte: '>=', min: '>=', at_least: '>=', 'at least': '>=', minimum: '>=',
  '<=': '<=', '≤': '<=', lte: '<=', max: '<=', at_most: '<=', 'at most': '<=', maximum: '<=', under: '<=', below: '<=',
  '=': '=', '==': '=', is: '=', eq: '=', equals: '=',
  '>': '>', gt: '>', more_than: '>', '<': '<', lt: '<', less_than: '<',
  in: 'in', one_of: 'in',
};

const HINGE_LABEL = { clamshell: 'Regular laptop (clamshell)', convertible_360: '360° convertible', detachable: 'Detachable keyboard' };
const hingeOf = (s) => {
  const t = String(s).toLowerCase();
  if (/convert|360|flip|yoga|2[\s-]?in[\s-]?1|fold|touch/.test(t)) return 'convertible_360';
  if (/detach|tablet/.test(t)) return 'detachable';
  if (/clam|regular|normal|laptop|standard/.test(t)) return 'clamshell';
  return null;
};

function numberOf(attr, v) {
  if (typeof v === 'number') return v;
  const s = String(v).toLowerCase().replace(/,/g, '');
  if (attr === 'price_inr') { const a = parseInrAmounts(s); if (a.length) return a[0].value; }
  const m = s.match(/(\d+(?:\.\d+)?)\s*(tb|gb|kg|g|inch|in|"|years?|yrs?)?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2] === 'tb') n *= 1024;
  if (attr === 'weight_kg' && m[2] === 'g') n /= 1000;
  return n;
}

export function normCriterion(c) {
  const base = { source_text: c.source_text || '', raw: c };
  const attribute = normAttr(c.attribute);
  if (!attribute) return { ...base, supported: false, label: `${c.attribute} ${c.value}`.trim() };
  const { kind, defOp } = ATTRS[attribute];
  let operator = OPS[String(c.operator || '').toLowerCase().trim()] ?? defOp;
  let value;
  const vals = Array.isArray(c.value) ? c.value : [c.value];
  if (kind === 'num') {
    const nums = vals.map((v) => numberOf(attribute, v)).filter((n) => n != null);
    value = nums[0];
    if (operator === 'in') operator = defOp === 'in' ? '=' : defOp;
  } else if (kind === 'enum') {
    value = [...new Set(vals.map(hingeOf).filter(Boolean))];
    operator = 'in';
  } else {
    value = [...new Set(vals.map((v) => String(v).toLowerCase().trim()).filter(Boolean))];
    operator = 'in';
  }
  if (value == null || (Array.isArray(value) && !value.length)) return { ...base, supported: false, label: `${c.attribute} ${vals.join(', ')}` };
  const crit = { ...base, supported: true, attribute, operator, value };
  crit.label = describe(crit);
  return crit;
}

export function describe(c) {
  const { attribute: a, operator: o, value: v } = c;
  const cmp = { '>=': 'or more', '<=': 'or less', '=': '', '>': 'more than', '<': 'less than' };
  const up = (u) => (o === '<=' ? `up to ${u}` : o === '>=' ? `${u} or more` : o === '<' ? `under ${u}` : o === '>' ? `over ${u}` : u);
  switch (a) {
    case 'ram_gb': return `RAM ${up(v + ' GB')}`;
    case 'storage_gb': return `Storage ${up(fmtStorage(v))}`;
    case 'weight_kg': return `Weight ${up(v + ' kg')}`;
    case 'price_inr': return `Price ${up(fmtInr(v))}`;
    case 'display_size': return `Screen ${up(v + ' inch')}`;
    case 'warranty_years': return `Warranty ${up(v + (v === 1 ? ' year' : ' years'))}`;
    case 'year': return `Model year ${up(v)}`;
    case 'hinge_type': return `Hinge: ${v.map((x) => HINGE_LABEL[x]).join(' or ')}`;
    case 'colour': return `Colour: ${v.map((x) => x[0].toUpperCase() + x.slice(1)).join(' or ')}`;
  }
  return `${a} ${o} ${v}`;
}

/* ---------- code-side evaluation (the source of every tick and cross) ---------- */
export function evalCriterion(c, row) {
  if (!c.supported) return null; // unknown: cannot be checked
  if (c.attribute === 'colour') return row.colours.some((x) => c.value.includes(x.toLowerCase()));
  if (c.attribute === 'hinge_type') return c.value.includes(row.hinge_type);
  const x = row[c.attribute];
  switch (c.operator) {
    case '>=': return x >= c.value;
    case '<=': return x <= c.value;
    case '>': return x > c.value;
    case '<': return x < c.value;
    default: return x === c.value;
  }
}
export function actualText(c, row) {
  switch (c.attribute) {
    case 'ram_gb': return `${row.ram_gb} GB`;
    case 'storage_gb': return fmtStorage(row.storage_gb);
    case 'weight_kg': return `${row.weight_kg} kg`;
    case 'price_inr': return fmtInr(row.price_inr);
    case 'display_size': return `${row.display_size} inch`;
    case 'warranty_years': return row.warranty;
    case 'year': return String(row.year);
    case 'hinge_type': return HINGE_LABEL[row.hinge_type];
    case 'colour': return row.colours.join(', ');
  }
  return '';
}

/* ---------- SQL filter: every Must becomes a WHERE clause ---------- */
const SELECT = `
SELECT v.id AS variant_id, v.model_id, v.ram_gb, v.storage_gb, v.colours, v.price_inr, v.price_as_of, v.availability,
  m.brand, m.line, m.year, m.processor, m.gpu, m.display_size, m.weight_kg, m.hinge_type,
  m.ram_slots_or_soldered, m.warranty, m.warranty_years
FROM variant v JOIN laptop_model m ON m.id = v.model_id
WHERE ${isShowable('v')} AND ${isShowable('m')}`;

const hydrate = (r) => ({ ...r, colours: JSON.parse(r.colours) });

export function whereFor(c) {
  if (c.attribute === 'colour') {
    return { sql: `EXISTS (SELECT 1 FROM json_each(v.colours) j WHERE lower(j.value) IN (${c.value.map(() => '?').join(',')}))`, params: c.value };
  }
  const col = ATTRS[c.attribute].col;
  if (c.operator === 'in') return { sql: `${col} IN (${c.value.map(() => '?').join(',')})`, params: c.value };
  const op = { '>=': '>=', '<=': '<=', '>': '>', '<': '<', '=': '=' }[c.operator];
  return { sql: `${col} ${op} ?`, params: [c.value] };
}

export function queryVariants(criteria) {
  let sql = SELECT; const params = [];
  for (const c of criteria.filter((x) => x.supported)) { const w = whereFor(c); sql += ` AND ${w.sql}`; params.push(...w.params); }
  sql += ' ORDER BY v.price_inr, v.id';
  return db.prepare(sql).all(...params).map(hydrate);
}
export const getVariant = (id) => {
  const r = db.prepare(`${SELECT} AND v.id = ?`).get(id);
  return r ? hydrate(r) : null;
};
export const variantsOfModel = (modelId) => db.prepare(`${SELECT} AND v.model_id = ? ORDER BY v.price_inr`).all(modelId).map(hydrate);
export const allModels = () => db.prepare(`SELECT * FROM laptop_model m WHERE ${isShowable('m')} ORDER BY m.line`).all();

/* ---------- needs -> criteria ---------- */
export function criteriaFromNeeds(needs) {
  const musts = (needs.musts || []).map(normCriterion);
  if (needs.budget_max_inr) {
    const c = normCriterion({ attribute: 'price_inr', operator: '<=', value: needs.budget_max_inr, source_text: 'budget' });
    c.label = `Within your budget of ${fmtInr(needs.budget_max_inr)}`; c.implicit = true; musts.unshift(c);
  }
  if (needs.budget_min_inr) {
    const c = normCriterion({ attribute: 'price_inr', operator: '>=', value: needs.budget_min_inr, source_text: 'budget' });
    c.label = `Price ${fmtInr(needs.budget_min_inr)} or more`; c.implicit = true; musts.push(c);
  }
  return {
    musts,
    shoulds: (needs.shoulds || []).map(normCriterion),
    nices: (needs.nices || []).map(normCriterion),
  };
}

/* ---------- ranking (in code) ---------- */
const USE_RULES = [
  [/light|travel|portab|commut|carry/, (r) => (2.2 - r.weight_kg) * 2],
  [/cod|program|develop|engineer|software/, (r) => r.ram_gb / 8 + r.storage_gb / 512 + (r.ram_gb >= 16 ? 1 : 0)],
  [/edit|video|design|photo|render|creat/, (r) => (r.ram_gb / 8) * 1.5 + r.storage_gb / 512 + (r.gpu !== 'Integrated' ? 1 : 0)],
  [/gam/, (r) => (r.gpu !== 'Integrated' ? 4 : 0) + r.ram_gb / 16],
  [/study|student|college|school|office|work|browsing|account|admin|sales|basic|class/, (r) => (r.ram_gb >= 8 ? 1 : 0) + (r.display_size >= 14 ? 0.5 : 0) - r.price_inr / 200000],
  [/note|draw|sketch|tablet|pen|handwrit|present/, (r) => (r.hinge_type !== 'clamshell' ? 2 : 0)],
];
export function useScore(row, useCases) {
  let s = 0;
  for (const u of useCases || []) for (const [re, fn] of USE_RULES) if (re.test(String(u).toLowerCase())) s += fn(row);
  return s;
}

export function ratingFor(modelId) {
  const rows = db.prepare(`SELECT n_reports, rating FROM evidence_excerpt e WHERE e.laptop_id = ? AND ${isShowable('e')} AND rating IS NOT NULL`).all(modelId);
  const n = rows.reduce((a, r) => a + r.n_reports, 0);
  const value = n ? rows.reduce((a, r) => a + r.rating * r.n_reports, 0) / n : null;
  return { value: value == null ? null : Math.round(value * 10) / 10, n, enough: n >= SETTINGS.MIN_EVIDENCE_N };
}

export function rank(rows, needs, crit) {
  const out = rows.map((row) => {
    const metShoulds = crit.shoulds.filter((c) => evalCriterion(c, row) === true);
    const metNices = crit.nices.filter((c) => evalCriterion(c, row) === true);
    const rating = ratingFor(row.model_id);
    let score = metShoulds.length * 3 + metNices.length + useScore(row, needs.use_cases);
    if (needs.budget_max_inr) score += 0.5 * (1 - row.price_inr / needs.budget_max_inr);
    if (rating.enough) score += (rating.value - 3) * 0.5;
    return { row, score, metShoulds, metNices };
  });
  out.sort((a, b) => b.score - a.score || a.row.price_inr - b.row.price_inr || a.row.variant_id.localeCompare(b.row.variant_id));
  return out;
}

/* ---------- if nothing matches: which Must to relax ---------- */
export function relaxOptions(crit) {
  const supported = crit.musts.filter((c) => c.supported);
  const options = [];
  for (const c of supported) {
    const rest = supported.filter((x) => x !== c);
    const rows = queryVariants(rest);
    if (!rows.length) continue;
    let relaxed = null, label, adds = rows.length;
    if (ATTRS[c.attribute].kind === 'num') {
      const dir = c.operator === '<=' || c.operator === '<' ? 1 : -1;
      const sorted = rows.map((r) => r[c.attribute]).sort((a, b) => (a - b) * dir);
      relaxed = sorted[0];
      adds = rows.filter((r) => (dir === 1 ? r[c.attribute] <= relaxed : r[c.attribute] >= relaxed)).length;
      const nc = { ...c, value: relaxed };
      label = `Change "${c.label}" to "${describe(nc)}"`;
      options.push({ must: c, label, adds, relaxedValue: relaxed, kind: 'change' });
    } else {
      options.push({ must: c, label: `Drop "${c.label}"`, adds, kind: 'drop' });
    }
  }
  return options.sort((a, b) => a.adds - b.adds === 0 ? 0 : b.adds - a.adds).slice(0, 2);
}

/* ---------- colours ---------- */
const NEAR = {
  blue: ['navy', 'teal', 'grey'], navy: ['blue', 'black', 'grey'], red: ['maroon', 'pink', 'orange'], green: ['teal', 'blue', 'grey'],
  white: ['silver', 'grey'], silver: ['grey', 'white'], grey: ['silver', 'black'], gray: ['silver', 'black'], black: ['grey', 'navy'],
  pink: ['red', 'white'], gold: ['silver', 'white'], purple: ['blue', 'navy'], orange: ['red', 'gold'],
};
const DARK = ['black', 'navy', 'grey'];
export function nearestColour(wanted, available) {
  const have = [...new Set(available.map((x) => x.toLowerCase()))];
  const w = wanted.toLowerCase();
  if (have.includes(w)) return { kind: 'exact', colour: w };
  for (const n of NEAR[w] || []) if (have.includes(n)) return { kind: 'nearest', colour: n };
  for (const d of DARK) if (have.includes(d)) return { kind: 'dark', colour: d };
  return null;
}

/* ---------- evidence ---------- */
export function evidenceFor(modelId) {
  const rows = db.prepare(`SELECT * FROM evidence_excerpt e WHERE e.laptop_id = ? AND ${isShowable('e')} ORDER BY e.topic, e.date DESC`).all(modelId);
  const byTopic = new Map();
  for (const r of rows) {
    if (!byTopic.has(r.topic)) byTopic.set(r.topic, []);
    byTopic.get(r.topic).push(r);
  }
  return [...byTopic.entries()].map(([topic, list]) => {
    const n = list.reduce((a, r) => a + r.n_reports, 0);
    const rated = list.filter((r) => r.rating != null);
    const rn = rated.reduce((a, r) => a + r.n_reports, 0);
    return {
      topic, n, enough: n >= SETTINGS.MIN_EVIDENCE_N,
      sources: [...new Set(list.map((r) => r.source_name).filter(Boolean))],
      rating: rn ? Math.round((rated.reduce((a, r) => a + r.rating * r.n_reports, 0) / rn) * 10) / 10 : null,
      excerpts: list.map((r) => ({ id: r.id, text: r.text, source: r.source_name, url: r.source_url, date: r.date, reviewer_type: r.reviewer_type, months: r.ownership_months })),
    };
  });
}
export const TOPIC_LABEL = { battery: 'Battery', keyboard: 'Keyboard', hinge: 'Hinge', display: 'Screen', performance: 'Speed', heat_noise: 'Heat and noise', service: 'Service and support' };

/* ---------- cards ---------- */
export const hingeLabel = (h) => HINGE_LABEL[h];
export function buildCard(row, { musts = [], requireAll = false, factLines = [] } = {}) {
  const rating = ratingFor(row.model_id);
  const ticks = musts.filter((c) => c.supported).map((c) => ({ label: c.label, ok: evalCriterion(c, row), actual: actualText(c, row) }));
  const unknown = musts.filter((c) => !c.supported).map((c) => ({ label: c.label, ok: null, actual: 'Cannot be checked yet' }));
  return {
    laptop_id: row.model_id, variant_id: row.variant_id,
    name: `${row.brand} ${row.line}`, variant_label: `${row.ram_gb} GB RAM, ${fmtStorage(row.storage_gb)} storage`,
    colours: row.colours, availability: row.availability,
    price_inr: row.price_inr, price_text: fmtInr(row.price_inr), as_of: row.price_as_of, as_of_text: fmtDate(row.price_as_of),
    specs: {
      year: row.year, processor: row.processor, gpu: row.gpu, display_size: row.display_size, weight_kg: row.weight_kg,
      hinge_type: row.hinge_type, ram_gb: row.ram_gb, storage_gb: row.storage_gb, memory_note: row.ram_slots_or_soldered, warranty: row.warranty,
    },
    spec_lines: [
      `${row.display_size} inch screen, ${row.weight_kg} kg`, HINGE_LABEL[row.hinge_type],
      `${row.processor}, ${row.gpu === 'Integrated' ? 'no separate graphics' : row.gpu}`,
      `Memory: ${row.ram_slots_or_soldered}`, `Warranty: ${row.warranty}`,
    ],
    rating, musts: [...ticks, ...unknown],
    fact_lines: factLines, reasons: [],
    _gate: { musts: musts.filter((c) => c.supported), requireAll },
  };
}

/* ---------- shortlist, shared by the form, chips and the buy flows ---------- */
export function runShortlist(needs, { limit = SETTINGS.MAX_SHORTLIST } = {}) {
  const crit = criteriaFromNeeds(needs);
  const rows = queryVariants(crit.musts);
  const unsupported = [...crit.musts, ...crit.shoulds, ...crit.nices].filter((c) => !c.supported);
  const seenModels = new Set();
  const ranked = rank(rows, needs, crit).filter((s) => (seenModels.has(s.row.model_id) ? false : seenModels.add(s.row.model_id)));
  const top = ranked.slice(0, limit);
  const cards = top.map((s) => buildCard(s.row, { musts: crit.musts, requireAll: true, factLines: factLinesFor(s, needs, crit) }));
  // colour handling
  const colourWish = [...crit.nices, ...crit.shoulds].filter((c) => c.supported && c.attribute === 'colour');
  const colourNotes = [];
  for (const cw of colourWish) {
    for (const wanted of cw.value) {
      const avail = top.flatMap((s) => s.row.colours);
      const m = nearestColour(wanted, avail);
      if (m && m.kind !== 'exact') {
        const holder = top.find((s) => s.row.colours.map((x) => x.toLowerCase()).includes(m.colour));
        colourNotes.push(`None of these come in ${wanted}. ${m.kind === 'nearest' ? 'The nearest colour is' : 'A dark colour is'} ${m.colour}, on ${holder.row.line}.`);
      } else if (!m && top.length) colourNotes.push(`None of these come in ${wanted}, and no dark option is listed.`);
    }
  }
  return { crit, rows, ranked, cards, unsupported, colourNotes };
}

function factLinesFor(s, needs, crit) {
  const r = s.row; const lines = [];
  for (const c of crit.musts.filter((x) => x.supported && !x.implicit)) lines.push(`Meets your must: ${c.label}. This laptop has ${actualText(c, r)}.`);
  if (needs.budget_max_inr) lines.push(`Costs ${fmtInr(r.price_inr)}, ${fmtInr(needs.budget_max_inr - r.price_inr)} under your budget of ${fmtInr(needs.budget_max_inr)}.`);
  else lines.push(`Costs ${fmtInr(r.price_inr)} as of ${fmtDate(r.price_as_of)}.`);
  for (const c of s.metShoulds) lines.push(`Also matches: ${c.label}.`);
  for (const c of s.metNices) lines.push(`Nice to have, met: ${c.label}.`);
  for (const u of needs.use_cases || []) {
    if (/light|travel|portab/.test(u)) lines.push(`Weighs ${r.weight_kg} kg, which suits ${u}.`);
    else if (/cod|edit|design|gam|video/.test(u)) lines.push(`${r.ram_gb} GB RAM and ${fmtStorage(r.storage_gb)} storage for ${u}.`);
    else lines.push(`${r.ram_gb} GB RAM and a ${r.display_size} inch screen for ${u}.`);
  }
  const rt = ratingFor(r.model_id);
  if (rt.enough) lines.push(`Owners rate it ${rt.value} out of 5 from ${rt.n} reports.`);
  return [...new Set(lines)].slice(0, 6);
}

/* ---------- owner voice: filter owner reports by who said it, how long they owned it, when, and about what ---------- */
export const PERSONAS = ['gamer', 'student', 'developer', 'creator', 'parent', 'office'];
export const PERSONA_LABEL = { gamer: 'Gamers', student: 'Students', developer: 'Developers', creator: 'Creators', parent: 'Parents', office: 'Office users' };
export const TOPICS = ['battery', 'keyboard', 'hinge', 'display', 'performance', 'heat_noise', 'service'];

export function normPersona(v) {
  const t = String(v ?? '').toLowerCase();
  if (!t) return null;
  if (/gam/.test(t)) return 'gamer';
  if (/student|college|school|study/.test(t)) return 'student';
  if (/dev|cod|program|engineer|software/.test(t)) return 'developer';
  if (/creat|edit|design|video|photo|artist/.test(t)) return 'creator';
  if (/parent|mom|mother|dad|father|senior|elder/.test(t)) return 'parent';
  if (/office|work|professional|business|account/.test(t)) return 'office';
  return PERSONAS.includes(t) ? t : null;
}
export function normTopic(v) {
  const t = String(v ?? '').toLowerCase();
  if (!t) return null;
  if (/batter|charge|backup/.test(t)) return 'battery';
  if (/keyboard|typing|keys/.test(t)) return 'keyboard';
  if (/hinge|fold|flip|build|sturdy/.test(t)) return 'hinge';
  if (/screen|display|bright|colour|color/.test(t)) return 'display';
  if (/heat|hot|warm|noise|fan|loud|cool|thermal/.test(t)) return 'heat_noise';
  if (/service|support|repair|warranty/.test(t)) return 'service';
  if (/perform|speed|lag|fast|slow|smooth|fps|frame/.test(t)) return 'performance';
  return TOPICS.includes(t) ? t : null;
}
const isoDay = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

/** Clean up filters from the model or from the filter bar. Anything not understood is returned in `unknown`. */
export function normFilters(raw = {}) {
  const f = { persona: null, topic: null, min_months: null, days: null, laptop_id: null };
  const unknown = [];
  if (raw.persona) { f.persona = normPersona(raw.persona); if (!f.persona) unknown.push(`reviewer type "${raw.persona}"`); }
  if (raw.topic) { f.topic = normTopic(raw.topic); if (!f.topic) unknown.push(`topic "${raw.topic}"`); }
  const m = Number(raw.min_months); if (m > 0) f.min_months = Math.min(120, Math.round(m));
  const d = Number(raw.days); if (d > 0) f.days = Math.min(365, Math.round(d));
  if (raw.laptop_id) f.laptop_id = String(raw.laptop_id);
  return { filters: f, unknown };
}
export function filterLabels(f) {
  const out = [];
  if (f.persona) out.push(`From ${PERSONA_LABEL[f.persona].toLowerCase()}`);
  if (f.min_months) out.push(`Owned ${f.min_months}+ months`);
  if (f.topic) out.push(`About ${(TOPIC_LABEL[f.topic] || f.topic).toLowerCase()}`);
  if (f.days) out.push(`Last ${f.days} days`);
  if (f.laptop_id) { const m = db.prepare('SELECT line FROM laptop_model WHERE id = ?').get(f.laptop_id); if (m) out.push(m.line); }
  return out;
}

export function queryEvidence(f) {
  let sql = `SELECT e.*, m.line, m.brand FROM evidence_excerpt e JOIN laptop_model m ON m.id = e.laptop_id WHERE ${isShowable('e')} AND ${isShowable('m')}`;
  const p = [];
  if (f.persona) { sql += ' AND e.persona = ?'; p.push(f.persona); }
  if (f.topic) { sql += ' AND e.topic = ?'; p.push(f.topic); }
  if (f.min_months) { sql += ' AND e.ownership_months >= ?'; p.push(f.min_months); }
  if (f.days) { sql += ' AND e.date >= ?'; p.push(isoDay(f.days)); }
  if (f.laptop_id) { sql += ' AND e.laptop_id = ?'; p.push(f.laptop_id); }
  sql += ' ORDER BY e.laptop_id, e.date DESC, e.id';
  const by = new Map();
  for (const r of db.prepare(sql).all(...p)) { if (!by.has(r.laptop_id)) by.set(r.laptop_id, []); by.get(r.laptop_id).push(r); }
  const rows = [...by.entries()].map(([id, list]) => {
    const n = list.reduce((a, r) => a + r.n_reports, 0);
    const rated = list.filter((r) => r.rating != null); const rn = rated.reduce((a, r) => a + r.n_reports, 0);
    const topics = {}; for (const r of list) topics[r.topic] = (topics[r.topic] || 0) + r.n_reports;
    const enough = n >= SETTINGS.MIN_EVIDENCE_N;
    return {
      laptop_id: id, name: `${list[0].brand} ${list[0].line}`, n, enough,
      rating: rn ? Math.round((rated.reduce((a, r) => a + r.rating * r.n_reports, 0) / rn) * 10) / 10 : null,
      sources: [...new Set(list.map((r) => r.source_name).filter(Boolean))],
      topics: Object.entries(topics).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, c]) => ({ topic: t, label: TOPIC_LABEL[t] || t, n: c })),
      excerpts: enough ? list.map((r) => ({ id: r.id, text: r.text, source: r.source_name, months: r.ownership_months, persona: r.persona, date: r.date })) : [],
    };
  });
  rows.sort((a, b) => (b.enough - a.enough) || ((b.rating ?? 0) - (a.rating ?? 0)) || b.n - a.n || a.laptop_id.localeCompare(b.laptop_id));
  return rows;
}

/** If nothing matches: how many reports each filter is hiding. */
export function loosenOptions(f) {
  const keys = ['persona', 'topic', 'min_months', 'days', 'laptop_id'].filter((k) => f[k]);
  return keys.map((k) => { const g = { ...f, [k]: null }; const n = queryEvidence(g).reduce((a, r) => a + r.n, 0); return { key: k, filters: g, n }; })
    .filter((o) => o.n > 0).sort((a, b) => b.n - a.n).slice(0, 2);
}

/* ---------- trending: counted in code from views, owner reports and price history ---------- */
export function computeTrending(days, size = SETTINGS.TREND_LIST_SIZE) {
  const since = isoDay(days), prev = isoDay(days * 2);
  const sinceTs = new Date(Date.now() - days * 86400000).toISOString(), prevTs = new Date(Date.now() - 2 * days * 86400000).toISOString();
  const models = new Map(allModels().map((m) => [m.id, m]));
  const nm = (id) => (models.get(id) ? `${models.get(id).brand} ${models.get(id).line}` : id);

  const views = db.prepare(`SELECT laptop_id, SUM(ts >= ?) AS recent, SUM(ts < ? AND ts >= ?) AS prior FROM view_events WHERE ts >= ? GROUP BY laptop_id`).all(sinceTs, sinceTs, prevTs, prevTs);
  const most_checked = views.filter((v) => models.has(v.laptop_id) && v.recent > 0)
    .sort((a, b) => b.recent - a.recent || a.laptop_id.localeCompare(b.laptop_id)).slice(0, size)
    .map((v) => ({ laptop_id: v.laptop_id, name: nm(v.laptop_id), recent: v.recent, prior: v.prior || 0 }));

  const rows = db.prepare(`SELECT e.laptop_id, e.topic, SUM(CASE WHEN e.date >= ? THEN e.n_reports ELSE 0 END) AS recent,
      SUM(CASE WHEN e.date < ? THEN e.n_reports ELSE 0 END) AS prior FROM evidence_excerpt e
    WHERE ${isShowable('e')} AND e.rating IS NOT NULL AND e.rating <= ? AND e.date >= ? GROUP BY e.laptop_id, e.topic`).all(since, since, SETTINGS.NEGATIVE_RATING_MAX, prev);
  const rising = rows.filter((r) => models.has(r.laptop_id) && r.recent >= SETTINGS.TREND_MIN_REPORTS && r.recent > r.prior)
    .sort((a, b) => (b.recent - b.prior) - (a.recent - a.prior) || a.laptop_id.localeCompare(b.laptop_id) || a.topic.localeCompare(b.topic)).slice(0, size)
    .map((r) => ({ laptop_id: r.laptop_id, name: nm(r.laptop_id), topic: r.topic, topic_label: TOPIC_LABEL[r.topic] || r.topic, recent: r.recent, prior: r.prior }));

  const drops = [];
  const vs = db.prepare(`SELECT v.id, v.model_id, v.ram_gb, v.storage_gb, v.price_inr, v.price_as_of FROM variant v JOIN laptop_model m ON m.id = v.model_id WHERE ${isShowable('v')} AND ${isShowable('m')}`).all();
  for (const v of vs) {
    const hist = db.prepare(`SELECT price_inr, timestamp FROM price_history h WHERE h.variant_id = ? AND ${isShowable('h')} ORDER BY timestamp`).all(v.id);
    const before = hist.filter((h) => h.timestamp <= sinceTs).pop() || hist.find((h) => h.timestamp > sinceTs);
    if (!before) continue;
    const drop = before.price_inr - v.price_inr, pct = (drop / before.price_inr) * 100;
    if (drop > 0 && pct >= SETTINGS.TREND_MIN_DROP_PCT) drops.push({ variant_id: v.id, laptop_id: v.model_id, name: nm(v.model_id), variant_label: `${v.ram_gb} GB RAM, ${fmtStorage(v.storage_gb)}`, was: before.price_inr, was_date: before.timestamp.slice(0, 10), now: v.price_inr, now_date: v.price_as_of, drop, pct: Math.round(pct * 10) / 10 });
  }
  drops.sort((a, b) => b.pct - a.pct || a.variant_id.localeCompare(b.variant_id));
  return { days, most_checked, rising, drops: drops.slice(0, size) };
}
