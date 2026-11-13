// LapFit browser code. It only shows what the server sends. No keys, no model calls, no facts of its own.
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (['checked', 'disabled', 'open', 'hidden', 'selected'].includes(k)) el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const j = (url, opt) => fetch(url, opt).then((r) => r.json());
const storeGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const storeSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let config = { settings: { MIN_EVIDENCE_N: 20, COMPARE_MIN: 2, COMPARE_MAX: 4 }, banner: 'SAMPLE DATA, not real laptops' };
const configReady = j('/api/config').then((c) => { config = c; }).catch(() => {});
const BANNER = () => h('div', { class: 'banner', role: 'note' }, config.banner);
const COLOUR_CSS = { black: '#1d1d1f', silver: '#c9ccd1', grey: '#8b9096', gray: '#8b9096', blue: '#3b6fd4', navy: '#1c2b55', red: '#c43b3b', green: '#3c9a62', white: '#f4f4f2', pink: '#e58fb0', gold: '#c9a54a', purple: '#7a55b8', orange: '#e08a3c', teal: '#2b8f8b' };
const LAPTOP_SVG = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="11" width="30" height="21" rx="2.5"/><path d="M4 38h40"/></svg>';
const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  find: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  check: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  owners: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  market: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  sell: '<path d="M7 4h10M7 9h10M10 4c5 0 7 2 7 5s-3 5-8 5l7 6"/>',
  mine: '<rect x="5" y="6" width="14" height="10" rx="1.5"/><path d="M2 19h20"/>',
};
const icon = (n) => h('span', { html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>` }).firstChild;

/* ---------- shared pieces: run a request into a container ---------- */
let image = null; // photo for the next typed request
function photoButton(onChange) {
  const input = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const prev = h('span', { class: 'hint' });
  input.addEventListener('change', async () => {
    const f = input.files[0]; input.value = ''; if (!f) return;
    try {
      const bmp = await createImageBitmap(f); const sc = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.82); image = { media_type: 'image/jpeg', data: url.split(',')[1] };
      prev.textContent = 'Photo added'; onChange?.();
    } catch { prev.textContent = 'I could not open that photo.'; }
  });
  return h('span', {}, h('button', { class: 'btn ghost small-btn', type: 'button', onclick: () => input.click() }, '＋ Photo'), input, ' ', prev);
}

function makeCtx(target, opts = {}) {
  const ctx = { target, thread: [], skip: new Set(opts.skip || []), onNeeds: opts.onNeeds };
  ctx.run = (body) => run(body, ctx);
  ctx.ask = (text, { fresh = true, forceFlow = null } = {}) => {
    if (fresh) ctx.thread = [];
    const body = { text, history: [...ctx.thread], image, forceFlow }; image = null;
    ctx.thread.push(text); return run(body, ctx, text);
  };
  ctx.forceFlow = (flow) => run({ text: ctx.thread.join('\n'), history: [], forceFlow: flow }, ctx);
  return ctx;
}
async function run(body, ctx, label) {
  const t = ctx.target; await configReady;
  t.replaceChildren(h('div', { class: 'loading' }, 'Working on it...'));
  let data; const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 25000);
  try { data = await j('/api/query', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }); }
  catch { data = { banner: config.banner, blocks: [{ type: 'form', notice: 'That took too long, so here is the simple form. It runs the same filter.' }], footer: 'Links may earn LapFit a commission; it never changes the order.' }; }
  clearTimeout(timer);
  t.replaceChildren();
  if (label) t.append(h('div', { class: 'you' }, label));
  t.append(BANNER());
  for (const b of data.blocks) { if (ctx.skip.has(b.type)) continue; const el = block(b, ctx); if (el) t.append(el); }
  t.append(h('p', { class: 'foot' }, data.footer));
  ctx.lastAwaiting = data.blocks.some((b) => b.type === 'choices');
  return data;
}

/* ---------- block renderers ---------- */
function block(b, ctx) {
  switch (b.type) {
    case 'text': return h('p', { class: 'msg' }, b.text);
    case 'notice': return h('p', { class: 'notice' }, b.text);
    case 'choices': return choices(b, ctx);
    case 'offer': return offer(b, ctx);
    case 'understood': return understood(b, ctx);
    case 'cards': return cards(b);
    case 'evidence': return evidence(b);
    case 'claims': return claims(b);
    case 'used': return used(b);
    case 'team': return team(b);
    case 'owner_voice': return ownerVoice(b, ctx);
    case 'trending': return trending(b, ctx);
    case 'sell_plan': return sellPlan(b, ctx);
    case 'sell_tips': return h('div', { class: 'block card' }, h('h2', {}, 'Prepare it to sell'), h('ul', { class: 'reasons' }, b.tips.map((x) => h('li', {}, x))));
    case 'form': return rulesForm(b, ctx);
  }
  return null;
}
function choices(b, ctx) {
  return h('div', { class: 'block' }, h('h2', {}, b.question),
    h('div', { class: 'choices' }, b.choices.map((c) => h('button', { class: 'btn', type: 'button', onclick: () => (c.send == null ? location.assign('#/home') : ctx.ask(c.send, { fresh: false })) }, c.label))));
}
function offer(b, ctx) {
  return h('div', { class: 'block' }, h('button', { class: 'btn primary', type: 'button', onclick: () => {
    if (b.sellForm != null) { sessionStorage.setItem('lapfit.sell', JSON.stringify(b.sellForm)); if (location.hash === '#/sell') route(); else location.hash = '#/sell'; }
    else if (b.ownerFilters) ctx.run({ ownerFilters: b.ownerFilters });
    else if (b.needs) (ctx.onNeeds ? (ctx.onNeeds(b.needs), null) : ctx.run({ needs: b.needs }));
    else if (b.flow) ctx.forceFlow(b.flow);
    else if (b.prefill != null) { location.hash = '#/home'; setTimeout(() => { const q = $('#askq'); if (q) { q.value = b.prefill; q.focus(); } }, 50); }
  } }, b.label));
}
function parseMoney(s) {
  const t = String(s).toLowerCase().replace(/[₹,\s]|rs\.?/g, ''); const m = t.match(/^(\d+(?:\.\d+)?)(k|lakh|lac|l)?$/); if (!m) return null;
  const n = parseFloat(m[1]); return Math.round(m[2] === 'k' ? n * 1000 : m[2] ? n * 100000 : n);
}
function understood(b, ctx) {
  const needs = JSON.parse(JSON.stringify(b.needs));
  const tiers = ['musts', 'shoulds', 'nices']; const names = { musts: 'Musts', shoulds: 'Shoulds', nices: 'Nice to have' };
  const box = h('div', { class: 'block card' });
  const draw = () => {
    box.replaceChildren(h('h2', {}, 'What I understood'), h('p', { class: 'hint' }, 'Tap a chip to move it between Must, Should and Nice. Tap × to remove. Then update.'));
    box.append(h('div', { class: 'group' }, h('h3', {}, 'Budget (up to)'), h('input', { type: 'text', value: needs.budget_max_inr ? inr(needs.budget_max_inr) : '', placeholder: 'e.g. 60k', 'aria-label': 'Maximum budget', onchange: (e) => { needs.budget_max_inr = parseMoney(e.target.value); } })));
    for (const tier of tiers) {
      const list = needs[tier], next = tiers[(tiers.indexOf(tier) + 1) % 3];
      box.append(h('div', { class: 'group' }, h('h3', {}, names[tier]), list.length ? list.map((c, i) => h('span', { class: 'pill' + (c.supported === false ? ' na' : '') },
        h('button', { type: 'button', 'aria-label': `${c.label}. Move to ${names[next]}`, onclick: () => { list.splice(i, 1); needs[next].push(c); draw(); } }, c.label + (c.supported === false ? ' (cannot check yet)' : '')),
        h('button', { class: 'x', type: 'button', 'aria-label': `Remove ${c.label}`, onclick: () => { list.splice(i, 1); draw(); } }, '×'))) : h('span', { class: 'hint' }, 'None')));
    }
    if (needs.use_cases?.length) box.append(h('div', { class: 'group' }, h('h3', {}, 'Use'), needs.use_cases.map((u) => h('span', { class: 'pill' }, h('span', { style: 'padding-right:10px' }, u)))));
    box.append(h('button', { class: 'btn primary', type: 'button', onclick: () => ctx.run({ needs }) }, 'Update results'));
  };
  draw(); return box;
}

/* cards + compare */
const compare = new Map();
function swatch(c) { return h('span', { class: 'sw', style: `background:${COLOUR_CSS[c.toLowerCase()] || '#bbb'}`, title: c, role: 'img', 'aria-label': c }); }
function ratingLine(r) {
  if (!r.enough) return h('div', { class: 'rating' }, h('span', { class: 'muted' }, `Owner ratings: not enough evidence (n = ${r.n}, we need at least ${config.settings.MIN_EVIDENCE_N}).`));
  return h('div', { class: 'rating' }, `Owner rating: ${r.value} out of 5 `, h('span', { class: 'muted' }, `(n = ${r.n} reports)`));
}
function cards(b) {
  const wrap = h('div', { class: 'block' }, b.title ? h('h2', {}, b.title) : null);
  for (const c of b.cards) wrap.append(card(c, b)); return wrap;
}
function card(c, b) {
  const ticks = c.musts.length ? h('details', { open: !!b.showMusts }, h('summary', {}, b.showMusts ? 'Your Musts' : 'Your Musts, checked'),
    h('ul', { class: 'ticks' }, c.musts.map((m) => h('li', {}, h('span', { class: 'mark ' + (m.ok === true ? 'ok' : m.ok === false ? 'no' : 'na') }, m.ok === true ? '✓ Met' : m.ok === false ? '✗ Not met' : '? Unknown'),
      h('span', {}, `${m.label}. `, h('span', { class: 'hint' }, m.ok === null ? m.actual : `This one: ${m.actual}`)))))) : null;
  return h('article', { class: 'card' },
    h('div', { class: 'card-top' }, h('div', { class: 'photo', role: 'img', 'aria-label': 'Photo placeholder', html: LAPTOP_SVG }),
      h('div', {}, h('h3', {}, c.name), h('div', { class: 'variant' }, c.variant_label), h('div', { class: 'swatches' }, c.colours.map(swatch), h('span', {}, c.colours.join(', '))))),
    h('div', { class: 'price' }, c.price_text, ' ', h('span', { class: 'asof' }, `as of ${c.as_of_text}`)),
    c.reasons.length ? h('ul', { class: 'reasons' }, c.reasons.map((r) => h('li', {}, r))) : null, ratingLine(c.rating), ticks,
    h('details', {}, h('summary', {}, 'Specs'), h('ul', { class: 'specs' }, c.spec_lines.map((s) => h('li', {}, s)))),
    h('label', { class: 'cmp' }, h('input', { type: 'checkbox', checked: compare.has(c.variant_id), onchange: (e) => toggleCompare(c, e.target) }), 'Add to compare'));
}
function toggleCompare(c, input) {
  if (input.checked) { if (compare.size >= config.settings.COMPARE_MAX) { input.checked = false; return; } compare.set(c.variant_id, c); } else compare.delete(c.variant_id);
  updateBar();
}
function updateBar() {
  const n = compare.size, min = config.settings.COMPARE_MIN; $('#compareBar').hidden = n === 0;
  $('#compareCount').textContent = n < min ? `${n} picked. Pick ${min - n} more to compare.` : `${n} picked`; $('#openCompare').disabled = n < min;
}
$('#clearCompare').addEventListener('click', () => { compare.clear(); document.querySelectorAll('.cmp input').forEach((i) => (i.checked = false)); updateBar(); });
$('#openCompare').addEventListener('click', () => {
  const list = [...compare.values()];
  const rows = [['Price', (c) => `${c.price_text} (as of ${c.as_of_text})`], ['RAM', (c) => `${c.specs.ram_gb} GB`], ['Storage', (c) => (c.specs.storage_gb >= 1024 ? `${c.specs.storage_gb / 1024} TB` : `${c.specs.storage_gb} GB`)],
    ['Screen', (c) => `${c.specs.display_size} inch`], ['Weight', (c) => `${c.specs.weight_kg} kg`], ['Type', (c) => ({ clamshell: 'Regular laptop', convertible_360: '360° convertible', detachable: 'Detachable keyboard' })[c.specs.hinge_type]],
    ['Processor', (c) => c.specs.processor], ['Graphics', (c) => c.specs.gpu], ['Memory', (c) => c.specs.memory_note], ['Warranty', (c) => c.specs.warranty], ['Colours', (c) => c.colours.join(', ')],
    ['Owner rating', (c) => (c.rating.enough ? `${c.rating.value} out of 5 (n = ${c.rating.n})` : `Not enough evidence (n = ${c.rating.n})`)]];
  $('#drawerBody').replaceChildren(h('div', { class: 'scroll' }, h('table', {}, h('tr', {}, h('th', {}, ''), list.map((c) => h('th', {}, c.name.replace('SampleBrand ', ''), h('div', { class: 'hint' }, c.variant_label)))), rows.map(([l, fn]) => h('tr', {}, h('th', {}, l), list.map((c) => h('td', {}, fn(c))))))));
  $('#drawer').hidden = false; $('#closeDrawer').focus();
});
const closeDrawer = () => { $('#drawer').hidden = true; };
$('#closeDrawer').addEventListener('click', closeDrawer);
$('#drawer').addEventListener('click', (e) => { if (e.target.id === 'drawer') closeDrawer(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

function evidence(b) {
  const box = h('div', { class: 'block card' }, h('h2', {}, 'What owners report'));
  if (!b.topics.length) { box.append(h('p', {}, 'No owner reports are on file for this laptop yet.')); return box; }
  for (const t of b.topics) box.append(h('div', { class: 'evrow' },
    h('div', {}, h('strong', {}, t.label), ' ', h('span', { class: 'badge ' + (t.enough ? 'ok' : 'na') }, t.enough ? `n = ${t.n} reports` : `Not enough evidence (n = ${t.n})`)),
    h('div', { class: 'hint' }, `Sources: ${t.sources.join(', ') || 'none listed'}.` + (t.enough && t.rating != null ? ` Average rating ${t.rating} out of 5.` : '')),
    t.enough ? h('ul', { class: 'reasons' }, t.excerpts.map((e) => h('li', {}, e.text, ' ', h('span', { class: 'hint' }, `(${e.source}, ${e.months} months of use)`)))) : h('p', { class: 'hint' }, `We need at least ${b.min_n} reports before showing a summary.`)));
  return box;
}
const BADGE = { supported: ['ok', 'Matches the catalog'], contradicts: ['bad', 'Does not match the specs'], not_in_catalog: ['na', 'Not in catalog'], verdict: ['person', 'Checked by a person'], not_checked: ['na', 'Not checked yet'], cant_check: ['na', "Can't be checked"] };
function claims(b) {
  const box = h('div', { class: 'block' }, h('h2', {}, b.laptop ? `What was claimed about ${b.laptop}` : 'What was claimed'));
  for (const r of b.rows) {
    const [cls, label] = BADGE[r.status] || ['na', r.label];
    const ev = r.evidence ? h('p', { class: 'hint' }, `Owner reports on ${r.evidence.topic.toLowerCase()}: n = ${r.evidence.n}${r.evidence.enough ? '' : ' (not enough evidence)'}. Sources: ${r.evidence.sources.join(', ')}.`, r.evidence.texts.length ? h('span', {}, ' ', r.evidence.texts.join(' ')) : null) : null;
    box.append(h('div', { class: 'claim' }, h('q', {}, r.claim_text), h('span', { class: 'badge ' + cls }, label), h('p', { style: 'margin:6px 0 0' }, r.detail),
      r.status === 'verdict' ? h('p', { class: 'hint' }, `Based on n = ${r.sample_size} reports. Approved by ${r.approver}${r.date ? ' on ' + fmtDay(r.date) : ''}.`) : null, ev));
  }
  return box;
}
function used(b) {
  const lab = { ok: ['ok', '✓ Fine'], warn: ['warn', '▲ Check'], info: ['na', 'i Note'] };
  const box = h('div', { class: 'block card' }, h('h2', {}, b.laptop ? `Used listing: ${b.laptop}` : 'Used listing'));
  b.flags.forEach((f) => box.append(h('div', { class: 'flag' }, h('span', { class: 'mark ' + lab[f.level][0] }, lab[f.level][1]), h('span', {}, f.text))));
  box.append(h('h3', { style: 'margin-top:14px' }, 'Check in person'), h('ul', { class: 'checklist' }, b.checklist.map((t) => h('li', {}, h('label', {}, h('input', { type: 'checkbox' }), t)))));
  box.append(h('h3', {}, 'Cannot be judged from a photo or a listing'), h('ul', { class: 'reasons' }, b.cannot_judge.map((t) => h('li', {}, t))));
  return box;
}
function team(b) {
  const box = h('div', { class: 'block card' }, h('h2', {}, 'One recommendation per role'));
  box.append(h('div', { class: 'scroll' }, h('table', {}, h('tr', {}, ['Role', 'People', 'Laptop', 'Each', 'Subtotal'].map((t) => h('th', {}, t))),
    b.rows.map((r) => h('tr', {}, h('td', {}, r.role, h('div', { class: 'hint' }, r.use)), h('td', {}, r.count), h('td', {}, r.card ? [r.card.name.replace('SampleBrand ', ''), h('div', { class: 'hint' }, r.card.variant_label)] : 'Nothing fits this budget'), h('td', {}, r.card ? r.card.price_text : ''), h('td', {}, r.subtotal != null ? inr(r.subtotal) : ''))))));
  box.append(h('p', {}, h('strong', {}, `Total ${inr(b.total_cost)}`), b.total_budget ? ` against a budget of ${inr(b.total_budget)}. ${b.total_cost <= b.total_budget ? `That is ${inr(b.total_budget - b.total_cost)} under.` : `That is ${inr(b.total_cost - b.total_budget)} over.`}` : '. No total budget was given.'));
  if (b.missing) box.append(h('p', { class: 'notice' }, `${b.missing} role${b.missing > 1 ? 's' : ''} had no laptop that fits the budget, so the total leaves them out.`));
  return box;
}
function sel(name, label, opts, value) { return h('label', {}, label, h('select', { name }, opts.map(([v, t]) => h('option', { value: v, selected: String(v) === String(value ?? '') }, t)))); }
function rulesForm(b, ctx) {
  const out = h('output', {}, '₹60,000');
  const f = h('form', { class: 'form' },
    h('label', {}, h('span', {}, 'Budget: ', out), h('input', { type: 'range', name: 'budget', min: 20000, max: 150000, step: 5000, value: 60000, oninput: (e) => (out.textContent = inr(e.target.value)) })),
    sel('use', 'What will you use it for?', [['any', 'Anything'], ['study', 'Study'], ['office', 'Office work'], ['coding', 'Coding'], ['editing', 'Photo or video editing'], ['gaming', 'Gaming'], ['travel', 'Travel'], ['notes', 'Notes and drawing']]),
    sel('weight', 'Weight (a Must)', [['0', 'Any'], ['1.0', 'Up to 1.0 kg'], ['1.3', 'Up to 1.3 kg'], ['1.5', 'Up to 1.5 kg'], ['1.8', 'Up to 1.8 kg']]),
    sel('hinge', 'Hinge type (a Must)', [['any', 'Any'], ['clamshell', 'Regular laptop'], ['convertible_360', '360° convertible'], ['detachable', 'Detachable keyboard']]),
    sel('colour', 'Colour (nice to have)', [['any', 'Any'], ['black', 'Black'], ['silver', 'Silver'], ['grey', 'Grey'], ['blue', 'Blue'], ['white', 'White'], ['green', 'Green'], ['red', 'Red']]),
    h('button', { class: 'btn primary', type: 'submit' }, 'Show laptops'));
  f.addEventListener('submit', (e) => { e.preventDefault(); ctx.run({ rulesForm: Object.fromEntries(new FormData(f)) }); });
  return h('div', { class: 'block' }, h('p', { class: 'notice' }, b.notice), f);
}

/* owner voice: filters that apply as you change them */
function pick(name, label, options, value, any = 'Any') {
  return h('label', {}, label, h('select', { name }, h('option', { value: '' }, any), options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value ?? '') }, o.label))));
}
function ownerVoice(b, ctx) {
  const f = b.filters, o = b.options;
  const form = h('form', { class: 'grid2 filterbar panel' },
    pick('persona', 'Who said it', o.personas, f.persona), pick('topic', 'About', o.topics, f.topic),
    pick('min_months', 'Owned for', o.months.map((m) => ({ value: m, label: `${m}+ months` })), f.min_months),
    pick('days', 'Written in the', o.windows.map((d) => ({ value: d, label: `last ${d} days` })), f.days),
    pick('laptop_id', 'Laptop', o.laptops, f.laptop_id, 'All laptops'));
  form.addEventListener('change', () => ctx.run({ ownerFilters: Object.fromEntries(new FormData(form)) }));
  const box = h('div', { class: 'block' }, h('h2', {}, 'What owners report'), h('p', { class: 'hint' }, 'A lens on owner reports, not a ranking of laptops. Every count shows how many reports are behind it.'), form);
  if (b.rows.length) box.append(h('p', { class: 'hint' }, `${b.total_n} reports across ${b.rows.length} laptop${b.rows.length > 1 ? 's' : ''}. Sorted by rating, then by number of reports.`));
  for (const r of b.rows) box.append(h('article', { class: 'card' }, h('h3', {}, r.name),
    h('div', {}, h('span', { class: 'badge ' + (r.enough ? 'ok' : 'na') }, r.enough ? `n = ${r.n} reports` : `Not enough evidence (n = ${r.n})`), ' ', r.enough && r.rating != null ? h('span', {}, `Average rating ${r.rating} out of 5`) : null),
    h('p', { class: 'hint' }, `Topics: ${r.topics.map((t) => `${t.label} (${t.n})`).join(', ')}. Sources: ${r.sources.join(', ') || 'none listed'}.`),
    r.enough ? h('ul', { class: 'reasons' }, r.excerpts.map((e) => h('li', {}, e.text, ' ', h('span', { class: 'hint' }, `(${e.persona || 'owner'}, ${e.months} months, ${e.date})`)))) : h('p', { class: 'hint' }, `We need at least ${b.min_n} reports before showing what they say.`),
    h('button', { class: 'btn ghost small-btn', type: 'button', onclick: () => ctx.run({ ownerFilters: { ...f, laptop_id: r.laptop_id } }) }, 'Only this laptop')));
  return box;
}

/* trending */
function trending(b, ctx) {
  const box = h('div', { class: 'block' }, h('h2', {}, `Trending in the last ${b.days} days`),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Time window' }, b.windows.map((d) => h('button', { type: 'button', 'aria-pressed': d === b.days, onclick: () => ctx.run({ trending: { days: d } }) }, `${d} days`))),
    h('p', { class: 'hint' }, 'Worked out from checks, owner reports and recorded prices. In this prototype the activity is sample data.'));
  const see = (id) => h('button', { class: 'btn ghost small-btn', type: 'button', onclick: () => { sessionStorage.setItem('lapfit.owners', JSON.stringify({ laptop_id: id })); location.hash = '#/owners'; } }, 'See owner reports');
  const section = (title, hint, items, row) => h('div', { class: 'card' }, h('h3', {}, title), h('p', { class: 'hint' }, hint), items.length ? items.map((it, i) => h('div', { class: 'evrow' }, row(it, i))) : h('p', {}, 'Nothing meets the minimum for this window.'));
  box.append(
    section('Most checked', 'Laptops people looked at most, against the window before.', b.most_checked, (x, i) => [h('strong', {}, `${i + 1}. ${x.name}`), h('div', {}, `${x.recent} checks`, h('span', { class: 'hint' }, ` (${x.prior} in the window before)`)), see(x.laptop_id)]),
    section('Rising complaints', `Low-rated owner reports: at least ${b.min_reports} in the window and more than the window before.`, b.rising, (x) => [h('strong', {}, `${x.name}: ${x.topic_label.toLowerCase()}`), h('div', {}, `n = ${x.recent} low-rated reports`, h('span', { class: 'hint' }, ` (${x.prior} in the window before)`)), see(x.laptop_id)]),
    section('Price drops', `Current price against the price at the start of the window. Falls under ${b.min_drop_pct}% are left out.`, b.drops, (x) => [h('strong', {}, `${x.name}, ${x.variant_label}`), h('div', {}, `${inr(x.now)} now (as of ${x.now_date}), down ${inr(x.drop)} (${x.pct}%) from ${inr(x.was)} on ${x.was_date}`), see(x.laptop_id)]));
  return box;
}

/* sell plan */
function sellPlan(b, ctx) {
  const box = h('div', { class: 'block' }, h('h2', {}, `Selling: ${b.laptop.name}`), h('p', { class: 'hint' }, `${b.laptop.variant_label}. New price today ${b.laptop.new_price_text} (as of ${b.laptop.as_of_text}).`));
  const tile = (small, big, sub) => h('div', { class: 'stat' }, h('small', {}, small), h('b', {}, big), h('span', {}, sub));
  const wf = b.with_fixes;
  box.append(h('div', { class: 'pulse' },
    tile('What it may fetch today', b.today.text, `middle ${inr(b.today.mid)}, a ${b.spread_pct}% either side`),
    wf ? tile('After the worthwhile fixes', wf.text, `fixes cost ${wf.cost_text}`) : tile('After fixes', 'No change', 'No fix is worth its cost'),
    wf ? tile(wf.net_positive ? 'You come out ahead by' : 'You come out behind by', wf.net_text, 'after repair costs') : tile('Extra to gain', inr(0), 'sell as it is')),
    h('p', { class: 'hint' }, 'An estimate, not a promise. Built from sample assumptions, see "How this is worked out" below.'));
  box.append(h('h2', { class: 'sec' }, 'What to do, in order'));
  if (!b.actions.length) box.append(h('p', {}, 'Nothing on this list applies to your laptop. Go to pricing below.'));
  for (const a of b.actions) box.append(h('article', { class: 'act' + (a.verdict === 'skip' ? ' skip' : '') },
    h('h3', {}, h('span', { class: 'badge ' + (a.verdict === 'do' ? 'ok' : 'na') }, a.verdict === 'do' ? 'Do this' : 'Skip this'), a.title), h('p', { style: 'margin:4px 0' }, a.summary), h('p', { class: 'hint', style: 'margin:0' }, a.why),
    h('details', {}, h('summary', {}, 'How'), h('ul', { class: 'specs' }, a.steps.map((x) => h('li', {}, x))), h('p', { class: 'hint' }, a.cost_note))));
  box.append(h('h2', { class: 'sec' }, 'Price it'), h('div', { class: 'cols2' },
    h('div', { class: 'opt' + (b.listing.focus === 'quick' ? ' focus' : '') }, h('b', {}, 'Quick sale'), h('div', {}, b.listing.quick.text)),
    h('div', { class: 'opt' + (b.listing.focus === 'best' ? ' focus' : '') }, h('b', {}, 'Best price, may take longer'), h('div', {}, b.listing.best.text))),
    h('ul', { class: 'reasons' }, b.listing.tips.map((x) => h('li', {}, x))));
  box.append(h('h2', { class: 'sec' }, 'Timing'), h('ul', { class: 'reasons' }, b.timing.map((x) => h('li', {}, x))));
  if (b.reason_note || b.disclosures.length) box.append(h('h2', { class: 'sec' }, 'Be upfront'), b.reason_note ? h('p', {}, b.reason_note) : null, b.disclosures.length ? h('ul', { class: 'reasons' }, b.disclosures.map((x) => h('li', {}, x))) : null);
  if (b.unknown.length) box.append(h('div', { class: 'unmet' }, h('strong', {}, 'Tell me these for a tighter range'), h('ul', { class: 'reasons' }, b.unknown.map((x) => h('li', {}, x)))));
  box.append(h('details', { class: 'panel' }, h('summary', {}, 'How this is worked out'),
    h('p', { class: 'hint' }, `Middle value = today's new price x each factor below. The range is ${b.spread_pct}% either side, wider when details are missing. These factors are sample assumptions, not real sales data.`),
    h('div', { class: 'scroll' }, h('table', {}, h('tr', {}, ['Factor', 'Used', 'Why'].map((x) => h('th', {}, x))), b.factors.map((f) => h('tr', {}, h('td', {}, f.label), h('td', {}, f.value), h('td', {}, f.note))))),
    h('p', { class: 'hint' }, 'Repair costs come from sample estimates. Get real quotes before paying for any fix.'),
    h('h3', {}, 'Cannot be judged here'), h('ul', { class: 'reasons' }, b.cannot_judge.map((x) => h('li', {}, x)))));
  return box;
}

/* ---------- views ---------- */
const TABS = [['home', 'Home', 'home'], ['find', 'Find', 'find'], ['check', 'Check', 'check'], ['owners', 'Owners', 'owners'], ['sell', 'Sell', 'sell'], ['mine', 'Mine', 'mine']];
const tabs = $('#tabs');
for (const [id, label, ic] of TABS) tabs.append(h('a', { href: `#/${id}`, 'data-id': id }, icon(ic), label));
const head = (t, s) => h('div', { class: 'view-head' }, h('h1', {}, t), s ? h('p', { class: 'sub' }, s) : null);
const view = $('#view');

const VIEWS = {
  async home(el) {
    const answer = h('div', { class: 'answer' }); const ctx = makeCtx(answer);
    const q = h('input', { type: 'text', id: 'askq', placeholder: 'Ask, or paste a seller message or listing', 'aria-label': 'Ask LapFit' });
    const go = () => { const t = q.value.trim(); if (t || image) { ctx.ask(t, { fresh: !ctx.lastAwaiting }); q.value = ''; } };
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    const ex = [['Laptop under 60k for coding, 16GB RAM must, light', 'I need a laptop under 60k for coding. 16GB RAM compulsory, light, blue colour.'], ['Seller says 32GB RAM and a full-day battery', 'The seller told me about Sample Laptop B: it has 32GB RAM, the battery lasts a full day, and it is overpriced.'], ['What do gamers say about heat after 6 months?', 'What do gamers say about heat and noise after 6 months?']];
    el.append(h('section', { class: 'hero' }, h('h1', {}, 'Know a laptop before you buy it, and while you own it.'),
      h('p', { class: 'sub', style: 'margin:0' }, 'Verified specs, owner reports and price history in one place.'),
      h('div', { class: 'askbar' }, q, h('button', { class: 'btn primary', type: 'button', onclick: go }, 'Ask')),
      h('div', { class: 'mini' }, ex.map(([l, t]) => h('button', { type: 'button', onclick: () => ctx.ask(t, { fresh: true }) }, l)), photoButton()), answer));
    el.append(h('h2', { class: 'sec' }, 'Your laptop journey'), h('div', { class: 'journey' },
      [['1', 'Choose', 'Filter by what you need', 'find'], ['2', 'Check', 'Test a seller pitch or used listing', 'check'], ['3', 'Know', 'What owners like you report', 'owners'], ['4', 'Time it', 'Trends and price drops', 'market'], ['5', 'Own', 'Warranty, value and your notes', 'mine'], ['6', 'Sell', 'Get the most for your laptop', 'sell']]
        .map(([n, t, s, r]) => h('a', { class: 'step', href: `#/${r}` }, h('span', { class: 'num' }, n), h('b', {}, t), h('span', {}, s)))));
    const pulse = h('div', { class: 'pulse' }); el.append(h('h2', { class: 'sec' }, 'This month'), pulse);
    j('/api/home').then((s) => {
      pulse.append(
        h('a', { class: 'stat', href: '#/market' }, h('small', {}, 'Most checked'), h('b', {}, s.most_checked ? s.most_checked.name.replace('SampleBrand ', '') : 'No data'), h('span', {}, s.most_checked ? `${s.most_checked.recent} checks, ${s.most_checked.prior} the month before` : '')),
        h('a', { class: 'stat', href: '#/market' }, h('small', {}, 'Rising complaint'), h('b', {}, s.rising ? `${s.rising.name.replace('SampleBrand ', '')}` : 'None'), h('span', {}, s.rising ? `${s.rising.topic_label.toLowerCase()}, n = ${s.rising.recent} low-rated reports` : '')),
        h('a', { class: 'stat', href: '#/market' }, h('small', {}, 'Biggest price drop'), h('b', {}, s.drop ? `${s.drop.pct}% off` : 'None'), h('span', {}, s.drop ? `${s.drop.name.replace('SampleBrand ', '')}, ${inr(s.drop.drop)} lower` : '')),
        h('a', { class: 'stat', href: '#/insights' }, h('small', {}, 'Searches with no match'), h('b', {}, `${s.unmet_share}%`), h('span', {}, 'What buyers want and nobody sells')));
      el.append(h('p', { class: 'facts' }, `Sample catalog: ${s.models} laptops, ${s.variants} versions, ${s.reports} owner reports. Prototype data only.`));
    }).catch(() => {});
    el.append(h('h2', { class: 'sec' }, 'More from the same data'), h('div', { class: 'journey' },
      h('a', { class: 'step', href: '#/insights' }, h('b', {}, 'For brands and sellers'), h('span', {}, 'Complaints by user type, price position and unmet demand')),
      h('a', { class: 'step', href: '#/vision' }, h('b', {}, 'How LapFit works'), h('span', {}, 'The data we collect and how it earns'))));
  },

  async find(el) {
    const st = { budget: 60000, uses: new Set(['coding']), ram: 0, storage: 0, weight: 0, hinge: '', colour: '' };
    const results = h('div', {}); const ctx = makeCtx(results, { skip: ['understood'], onNeeds: (n) => { applyNeeds(n); go(); } });
    const out = h('output', {}, inr(st.budget));
    const range = h('input', { type: 'range', min: 20000, max: 150000, step: 5000, value: st.budget, 'aria-label': 'Budget', oninput: (e) => { st.budget = Number(e.target.value); out.textContent = inr(st.budget); }, onchange: () => go() });
    const uses = [['study', 'Study'], ['office', 'Office'], ['coding', 'Coding'], ['editing', 'Editing'], ['gaming', 'Gaming'], ['travel', 'Travel'], ['notes', 'Notes']];
    const pills = h('div', { class: 'pills' }, uses.map(([v, l]) => h('button', { class: 'tog', type: 'button', 'aria-pressed': st.uses.has(v), onclick: (e) => { st.uses.has(v) ? st.uses.delete(v) : st.uses.add(v); e.target.setAttribute('aria-pressed', st.uses.has(v)); go(); } }, l)));
    const mk = (key, label, opts) => { const s = h('select', { onchange: (e) => { st[key] = key === 'hinge' || key === 'colour' ? e.target.value : Number(e.target.value); go(); } }, opts.map(([v, t]) => h('option', { value: v }, t))); return h('label', {}, label, s); };
    const ramSel = mk('ram', 'RAM (Must)', [[0, 'Any'], [8, '8 GB or more'], [16, '16 GB or more'], [32, '32 GB or more']]);
    const stoSel = mk('storage', 'Storage (Must)', [[0, 'Any'], [256, '256 GB or more'], [512, '512 GB or more'], [1024, '1 TB or more']]);
    const wSel = mk('weight', 'Weight (Must)', [[0, 'Any'], [1.0, 'Up to 1.0 kg'], [1.3, 'Up to 1.3 kg'], [1.5, 'Up to 1.5 kg'], [1.8, 'Up to 1.8 kg']]);
    const hSel = mk('hinge', 'Type (Must)', [['', 'Any'], ['clamshell', 'Regular laptop'], ['convertible_360', '360° convertible'], ['detachable', 'Detachable keyboard']]);
    const cSel = mk('colour', 'Colour (nice to have)', [['', 'Any'], ['black', 'Black'], ['silver', 'Silver'], ['grey', 'Grey'], ['blue', 'Blue'], ['white', 'White'], ['green', 'Green'], ['red', 'Red']]);
    const selects = [ramSel, stoSel, wSel, hSel, cSel].map((l) => l.querySelector('select'));
    const keys = ['ram', 'storage', 'weight', 'hinge', 'colour'];
    function applyNeeds(n) {
      st.budget = n.budget_max_inr || st.budget; range.value = st.budget; out.textContent = inr(st.budget);
      st.ram = st.storage = st.weight = 0; st.hinge = ''; st.colour = '';
      for (const m of n.musts || []) { const a = m.attribute; if (/ram/.test(a)) st.ram = Number(m.value); if (/storage/.test(a)) st.storage = Number(m.value); if (/weight/.test(a)) st.weight = Number(m.value); if (/hinge/.test(a)) st.hinge = [].concat(m.value)[0]; if (/colo/.test(a)) st.colour = [].concat(m.value)[0]; }
      selects.forEach((s, i) => (s.value = String(st[keys[i]])));
    }
    const needs = () => {
      const n = { budget_max_inr: st.budget, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [...st.uses] };
      if (st.ram) n.musts.push({ attribute: 'ram_gb', operator: '>=', value: st.ram, source_text: 'filter' });
      if (st.storage) n.musts.push({ attribute: 'storage_gb', operator: '>=', value: st.storage, source_text: 'filter' });
      if (st.weight) n.musts.push({ attribute: 'weight_kg', operator: '<=', value: st.weight, source_text: 'filter' });
      if (st.hinge) n.musts.push({ attribute: 'hinge_type', operator: 'in', value: [st.hinge], source_text: 'filter' });
      if (st.colour) n.nices.push({ attribute: 'colour', operator: 'in', value: [st.colour], source_text: 'filter' });
      return n;
    };
    let t; const go = () => { clearTimeout(t); t = setTimeout(() => ctx.run({ needs: needs() }), 250); };
    el.append(head('Find a laptop', 'Move the controls. Results update as you go. Every Must is checked in code.'),
      h('div', { class: 'split' }, h('div', { class: 'panel' },
        h('label', {}, h('span', { style: 'font-weight:600' }, 'Budget up to ', out), range), h('h3', { style: 'margin:12px 0 6px' }, 'Use'), pills,
        h('div', { class: 'grid2', style: 'margin-top:12px' }, ramSel, stoSel, wSel, hSel, cSel),
        h('p', { class: 'hint' }, 'Colour is a nice-to-have. Everything else you choose is a Must, so a laptop that misses it never appears.')),
        results));
    go();
  },

  async check(el) {
    let mode = 'check_pitch'; const result = h('div', { class: 'answer' }); const ctx = makeCtx(result);
    const ta = h('textarea', { class: 'paste', maxlength: 4000 });
    const modes = { check_pitch: ['Seller pitch', 'Paste what a seller, salesperson, listing or video claimed. I split it into separate claims and check each one.', 'The seller told me about Sample Laptop B: it has 32GB RAM, the battery lasts a full day, and it is overpriced. It never gets hot.'],
      used_check: ['Used listing', 'Paste a used or refurbished listing. I flag what does not add up and give you a checklist. I do not say buy or do not buy.', 'Used Sample Laptop H 8GB RAM 512GB for ₹25,000. Windows 10. Selling because I upgraded.'] };
    const segBtns = {}; const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'What to check' }, Object.entries(modes).map(([k, [l]]) => (segBtns[k] = h('button', { type: 'button', 'aria-pressed': k === mode, onclick: () => { mode = k; paint(); } }, l))));
    const hint = h('p', { class: 'sub' }); const example = h('button', { class: 'btn ghost small-btn', type: 'button', onclick: () => { ta.value = modes[mode][2]; } }, 'Use an example');
    const paint = () => { for (const k in segBtns) segBtns[k].setAttribute('aria-pressed', k === mode); hint.textContent = modes[mode][1]; ta.placeholder = modes[mode][2]; result.replaceChildren(); };
    el.append(head('Check before you pay', 'Neutral wording. "Does not match the specs", never "lying".'), seg, hint, ta,
      h('div', { class: 'row' }, h('span', {}, example, ' ', photoButton()), h('button', { class: 'btn primary', type: 'button', onclick: () => { if (ta.value.trim() || image) ctx.ask(ta.value.trim(), { fresh: true, forceFlow: mode }); } }, 'Check it')), result);
    paint();
  },

  async owners(el) {
    const results = h('div', {}); const ctx = makeCtx(results);
    let start = {}; try { start = JSON.parse(sessionStorage.getItem('lapfit.owners') || '{}'); sessionStorage.removeItem('lapfit.owners'); } catch {}
    el.append(head('What owners say', 'Filter by who they are, how long they have owned it and what it is about.'),
      h('div', { class: 'row', style: 'justify-content:flex-start' }, h('button', { class: 'btn ghost small-btn', type: 'button', onclick: () => submitPanel(sub) }, 'Add my experience')), results);
    const sub = h('div', {}); el.insertBefore(sub, results);
    ctx.run({ ownerFilters: start });
  },

  async sell(el) {
    let pre = {}; try { pre = JSON.parse(sessionStorage.getItem('lapfit.sell') || '{}'); sessionStorage.removeItem('lapfit.sell'); } catch {}
    const cat = await j('/api/catalog'); const results = h('div', {}); const ctx = makeCtx(results);
    const unk = (rest) => [['', 'Not sure'], ...rest];
    const f = h('form', { class: 'sellform panel' },
      h('div', { class: 'full' }, sel('variant_id', 'Which laptop?', cat.variants.map((v) => [v.id, v.label]), pre.variant_id)),
      h('label', {}, 'How old is it (months)?', h('input', { type: 'number', name: 'months_owned', min: 0, max: 240, placeholder: 'e.g. 18', value: pre.months_owned ?? '' })),
      sel('body', 'Body condition', unk([['like_new', 'Like new'], ['good', 'Good, light wear'], ['scratched', 'Scratched or dented'], ['damaged', 'Damaged']]), pre.body),
      sel('screen', 'Screen', unk([['perfect', 'Perfect'], ['marks', 'Minor marks'], ['cracked', 'Cracked or lines']]), pre.screen),
      h('label', {}, 'Battery health % (if you know)', h('input', { type: 'number', name: 'battery_pct', min: 0, max: 100, placeholder: 'e.g. 82', value: pre.battery_pct ?? '' })),
      sel('keyboard_ok', 'Keyboard', unk([['true', 'All keys work'], ['false', 'Some keys do not work']]), pre.keyboard_ok == null ? '' : String(pre.keyboard_ok)),
      sel('docs', 'Bill and box', unk([['bill_box', 'I have both'], ['bill', 'Bill only'], ['none', 'Neither']]), pre.docs),
      h('label', {}, 'Warranty left (months)', h('input', { type: 'number', name: 'warranty_months', min: 0, max: 60, placeholder: 'e.g. 4', value: pre.warranty_months ?? '' })),
      sel('os', 'Software', unk([['fresh', 'Freshly reset'], ['cluttered', 'Full of my files and apps']]), pre.os),
      sel('reason', 'Why are you selling?', unk([['upgrade', 'Upgrading'], ['need_money', 'Need money'], ['not_using', 'Not using it'], ['issue', 'It has a problem'], ['gift', 'It was a gift'], ['other', 'Other']]), pre.reason),
      sel('urgency', 'How soon?', unk([['quick', 'As soon as possible'], ['best_price', 'I can wait for a better price']]), pre.urgency),
      h('div', { class: 'full' }, h('button', { class: 'btn primary', type: 'submit' }, 'What should I do?')));
    f.addEventListener('submit', (e) => { e.preventDefault(); const o = {}; for (const [k, v] of new FormData(f)) if (v !== '') o[k] = v; ctx.run({ sellerForm: o }); });
    const ta = h('textarea', { rows: 3, maxlength: 2000, placeholder: 'Or describe it: "Selling my Sample Laptop B 16GB RAM 512GB storage, 2 years old, scratched, battery 70%, upgrading."', 'aria-label': 'Describe your laptop' });
    el.append(head('Sell your laptop', 'Tell me its condition and why you are selling. I show what it may fetch today and which fixes are actually worth the money.'), f,
      h('div', { style: 'margin:12px 0' }, ta, h('div', { class: 'row' }, h('span', { class: 'hint' }, 'Same answer, in your own words.'), h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (ta.value.trim()) ctx.ask(ta.value.trim(), { fresh: true, forceFlow: 'sell_laptop' }); } }, 'Use my words'))), results);
    if (pre.variant_id && (pre.months_owned != null || pre.body)) f.requestSubmit();
  },

  async market(el) {
    const results = h('div', {}); const ctx = makeCtx(results);
    el.append(head('Market pulse', 'What is moving this month. Counted from checks, owner reports and recorded prices.'), results);
    ctx.run({ trending: { days: 30 } });
  },

  async mine(el) {
    el.append(head('My laptops', 'Warranty, price and what owners report about the laptops you own. Saved on this device only.'));
    const cat = await j('/api/catalog'); const list = h('div', {}); const today = new Date().toISOString().slice(0, 10);
    const form = h('form', { class: 'form' }, h('h2', {}, 'Add a laptop'),
      sel('variant_id', 'Which one?', cat.variants.map((v) => [v.id, v.label])),
      h('label', {}, 'Bought on', h('input', { type: 'date', name: 'bought_on', max: today, value: today, required: true })),
      h('label', {}, 'Price paid (optional)', h('input', { type: 'number', name: 'paid_inr', min: 0, placeholder: 'e.g. 62990', inputmode: 'numeric' })),
      h('button', { class: 'btn primary', type: 'submit' }, 'Add'));
    form.addEventListener('submit', (e) => { e.preventDefault(); const items = storeGet('lapfit.garage', []); items.push(Object.fromEntries(new FormData(form))); storeSet('lapfit.garage', items); draw(); });
    el.append(list, h('div', { style: 'margin-top:14px' }, form));
    async function draw() {
      const items = storeGet('lapfit.garage', []);
      if (!items.length) { list.replaceChildren(h('div', { class: 'empty' }, 'No laptops yet. Add one to see its warranty, price now and what owners report.')); return; }
      const res = await j('/api/garage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }) });
      list.replaceChildren(BANNER(), ...res.items.map((g) => {
        const idx = items.findIndex((x) => x.variant_id === g.variant_id && String(x.bought_on).slice(0, 10) === g.bought_on);
        const wl = g.warranty_days_left, w = g.warranty;
        return h('article', { class: 'gcard' }, h('h3', {}, g.name), h('div', { class: 'variant' }, `${g.variant_label}. Owned ${g.months_owned} month${g.months_owned === 1 ? '' : 's'}.`),
          h('p', {}, h('strong', {}, wl > 0 ? `Warranty: ${wl} days left` : 'Warranty ended'), h('span', { class: 'hint' }, ` (${w}, ends ${fmtDay(g.warranty_ends)})`)),
          h('p', {}, `Price now ${g.price_now_text} `, h('span', { class: 'hint' }, `as of ${fmtDay(g.price_as_of)}`), g.paid_inr ? h('span', {}, `. You paid ${g.paid_text}${g.price_gap > 0 ? `, so the price is ${g.price_gap_text} lower now.` : g.price_gap < 0 ? `, so the price is ${g.price_gap_text} higher now.` : ', the same as now.'}`) : null),
          h('p', { class: 'hint' }, `Rough resale range from a sample band: ${inr(g.resale_low)} to ${inr(g.resale_high)}. A real range needs real used prices.`),
          ratingLine(g.rating),
          g.issues.length ? h('p', { class: 'unmet' }, `Rising complaints this month: ${g.issues.map((i) => `${i.topic_label.toLowerCase()} (n = ${i.recent})`).join(', ')}.`) : null,
          h('div', { class: 'row', style: 'justify-content:flex-start' },
            h('button', { class: 'btn ghost small-btn', type: 'button', onclick: () => { sessionStorage.setItem('lapfit.owners', JSON.stringify({ laptop_id: g.laptop_id })); location.hash = '#/owners'; } }, 'What owners say'),
            h('button', { class: 'btn ghost small-btn', type: 'button', onclick: () => { sessionStorage.setItem('lapfit.sell', JSON.stringify({ variant_id: g.variant_id, months_owned: g.months_owned })); location.hash = '#/sell'; } }, 'Sell this laptop'),
            g.report_due ? h('button', { class: 'btn primary small-btn', type: 'button', onclick: () => { sessionStorage.setItem('lapfit.submit', g.laptop_id); location.hash = '#/owners'; } }, 'Share my experience') : null,
            h('button', { class: 'btn ghost small-btn', type: 'button', onclick: () => { items.splice(idx, 1); storeSet('lapfit.garage', items); draw(); } }, 'Remove')));
      }));
    }
    draw();
  },

  async insights(el) {
    el.append(head('For brands and sellers', 'What a maker or retailer would see from the same data. Prototype view on sample data.'), BANNER());
    const cat = await j('/api/catalog'); const body = h('div', {}); const demand = h('div', {});
    const s = h('select', { 'aria-label': 'Laptop', onchange: () => load(s.value) }, cat.laptops.map((l) => h('option', { value: l.id, selected: l.id === 'F' }, l.name)));
    el.append(h('label', { style: 'display:grid;gap:4px;font-weight:600;margin:10px 0' }, 'Laptop', s), body, demand);
    async function load(id) {
      const d = await j(`/api/insights?laptop=${id}`); const min = d.matrix.min_n;
      const wk = Math.max(1, ...d.weeks.map((w) => w.n));
      const cls = (c) => (!c ? 'e' : c.rating >= 4 ? 'g' : c.rating > 3 ? 'm' : 'b');
      const heat = d.matrix.rows.length ? h('div', { class: 'scroll' }, h('table', { class: 'heat' }, h('tr', {}, h('th', {}, ''), d.matrix.topics.map((t) => h('th', {}, t.label))),
        d.matrix.rows.map((r) => h('tr', {}, h('th', {}, r.label), r.cells.map((c) => h('td', { class: cls(c) + (c && c.n < min ? ' low' : '') }, c ? [h('b', {}, c.rating), h('small', {}, `n = ${c.n}`)] : '–'))))))
        : h('p', {}, 'No owner reports by user type yet.');
      const all = d.price.flatMap((p) => p.points.map((x) => x.v)); const lo = Math.min(...all), hi = Math.max(...all);
      const dates = d.price.flatMap((p) => p.points.map((x) => +new Date(x.t))); const t0 = Math.min(...dates), t1 = Math.max(...dates) || t0 + 1;
      const W = 320, H = 130, pad = 8; const X = (t) => pad + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * pad); const Y = (v) => H - pad - ((v - lo) / Math.max(1, hi - lo)) * (H - 2 * pad);
      const colors = ['var(--accent)', '#b5651d', '#6a5acd'];
      const svg = `<svg class="line" viewBox="0 0 ${W} ${H}" role="img" aria-label="Price history">${d.price.map((p, i) => `<polyline fill="none" stroke="${colors[i % 3]}" stroke-width="2.5" points="${p.points.map((x) => `${X(+new Date(x.t)).toFixed(1)},${Y(x.v).toFixed(1)}`).join(' ')}"/>`).join('')}</svg>`;
      body.replaceChildren(
        h('div', { class: 'pulse' }, h('div', { class: 'stat' }, h('small', {}, 'Owner rating'), h('b', {}, d.rating.value ? `${d.rating.value} / 5` : 'None'), h('span', {}, `n = ${d.rating.n} reports`)),
          h('div', { class: 'stat' }, h('small', {}, 'Checks this week'), h('b', {}, d.weeks.at(-1).n), h('span', {}, `${d.weeks.at(-5).n} four weeks ago`)),
          h('div', { class: 'stat' }, h('small', {}, 'Rising complaints'), h('b', {}, d.rising.length), h('span', {}, d.rising.map((r) => r.topic_label.toLowerCase()).join(', ') || 'none this month')),
          h('div', { class: 'stat' }, h('small', {}, 'Price falls'), h('b', {}, d.drops.length ? `${d.drops[0].pct}%` : 'None'), h('span', {}, d.drops.length ? `${d.drops[0].variant_label}` : 'in the last 30 days'))),
        h('h2', { class: 'sec' }, 'How each type of owner rates each topic'), h('p', { class: 'hint' }, `Average rating out of 5. Dashed cells have fewer than ${min} reports, so read them as early signals.`), heat,
        h('h2', { class: 'sec' }, 'Price history'), h('div', { class: 'panel' }, h('div', { html: svg }), h('div', { class: 'legend' }, d.price.map((p, i) => h('span', {}, h('i', { style: `display:inline-block;width:12px;height:3px;background:${colors[i % 3]};margin-right:4px;vertical-align:middle` }), `${p.label}: ${inr(p.points.at(-1).v)}`)), h('span', {}, `Range ${inr(lo)} to ${inr(hi)}`))),
        h('h2', { class: 'sec' }, 'Checks per week'), h('div', { class: 'panel' }, h('div', { class: 'week' }, d.weeks.map((w) => h('div', { style: `height:${Math.round((w.n / wk) * 100)}%`, title: `${w.label}: ${w.n}` }))), h('div', { class: 'weeklabels' }, d.weeks.map((w) => h('span', {}, w.n)))));
    }
    const dm = await j('/api/demand');
    const bar = (items, max) => h('div', { class: 'bars' }, items.map((x) => h('div', { class: 'barrow' }, h('span', {}, x.label), h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: `width:${Math.round((x.n / max) * 100)}%` })), h('span', {}, x.n))));
    demand.append(h('h2', { class: 'sec' }, 'What buyers ask for'), h('p', { class: 'hint' }, `${dm.total} searches in the last ${dm.days} days. We keep the budget band, use and Musts, never the typed words.`),
      h('div', { class: 'split' }, h('div', { class: 'panel' }, h('h3', {}, 'Budget'), bar(dm.bands, dm.bands[0]?.n || 1)), h('div', { class: 'panel' }, h('h3', {}, 'Most asked Musts'), bar(dm.musts, dm.musts[0]?.n || 1))),
      h('h2', { class: 'sec' }, `Unmet demand: ${dm.unmet_share}% of searches found no laptop`), h('p', { class: 'hint' }, 'Combinations buyers asked for that nothing in the catalog satisfies. A gap like this is a product brief for a maker and a catalog priority for us.'),
      dm.unmet.map((u) => h('div', { class: 'unmet' }, h('strong', {}, `${u.n} searches`), `: ${u.budget}, ${u.musts.join(', ').toLowerCase()}.`)));
    load(s.value);
  },

  async vision(el) {
    const st = (k, t) => h('span', { class: 'status ' + k }, t);
    el.append(head('How LapFit works', 'One verified database serving six jobs, from choosing a laptop to selling it, and the ways it earns.'), BANNER());
    const tbl = (head_, rows) => h('div', { class: 'scroll' }, h('table', { class: 'tbl' }, h('tr', {}, head_.map((x) => h('th', {}, x))), rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, c))))));
    el.append(
      h('h2', { class: 'sec' }, 'The idea'), h('p', {}, 'A chatbot guesses. LapFit keeps verified facts, owner evidence and price history, and lets people, sellers and brands query them. The more it is used, the better the data gets, and that data is slow for anyone else to build.'),
      h('h2', { class: 'sec' }, 'Data we collect, and what it does'),
      tbl(['Data', 'Where it comes from', 'What it powers'], [
        ['Verified catalog', 'Manual checks and CSV import', 'Every filter, tick and claim check'],
        ['Price history', 'Retailer prices over time', 'Price drops, buy-timing, resale ranges'],
        ['Owner reports', 'Owners, approved by a person', 'Owner voice, durability, brand insights'],
        ['Claim ledger', 'Reviewers, with named approval', 'Seller pitch checks'],
        ['Buyer demand', 'Budget band, use and Musts from searches. No free text', 'Unmet-demand map, catalog priorities, trending'],
        ['Checks and compares', 'App activity', 'Most checked, what people weigh up together'],
        ['My laptops', 'Owners, on their own device in this prototype', 'Warranty reminders, resale, prompts to report'],
        ['Used listing checks', 'Pasted listings', 'Fair used-price bands, common red flags'],
        ['Seller conditions and reasons', 'Owners filling in the Sell form (no names; optional)', 'Real used-price evidence, what condition issues cost, listing advice'],
        ['Unhandled requests', 'Questions we could not answer', 'The product roadmap']]),
      h('h2', { class: 'sec' }, 'Ways it earns'),
      tbl(['Stream', 'How it works', 'Status'], [
        ['Affiliate links', 'Commission when someone buys through a link. Never changes the order.', [st('proto', 'Line shown, no real links yet')]],
        ['Insights for brands and retailers', 'Complaints by user type, price position and unmet demand, as a subscription.', [st('proto', 'Prototype view on sample data')]],
        ['Verified used marketplace', 'Seller lists a laptop; LapFit runs its used-listing checks and adds a badge. Fee or commission per sale.', [st('concept', 'Concept, not built')]],
        ['Rental and subscription partners', 'Right-size the laptop to the need, with partners paying per lead. Resale ranges set the rent.', [st('concept', 'Concept, not built')]],
        ['Sell plan and trade-in', 'Owners get a value range and a list of fixes worth paying for, then are sent to a buyer or refurbisher. Commission or lead fee.', [st('proto', 'Sell plan built on sample assumptions; no buyers connected')]],
        ['Warranty and insurance referrals', 'Offered near the end of a warranty, when My laptops knows the date.', [st('concept', 'Concept, not built')]],
        ['Data for lenders and EMI partners', 'Resale value curves to price risk on laptop loans.', [st('concept', 'Concept, not built')]]]),
      h('p', { class: 'hint' }, 'Rule for every stream: payment never changes what is verified, shown, or ranked.'),
      h('h2', { class: 'sec' }, 'Why it is hard to copy'),
      h('ul', { class: 'reasons' }, [h('li', {}, 'Owner reports with user type and months owned take years to collect.'), h('li', {}, 'Every approved claim and report has a named person behind it.'), h('li', {}, 'Buyer demand shows what people want and cannot find, which nobody else sees.'), h('li', {}, 'Each report improves the filters, and better filters bring more reports.')]),
      h('h2', { class: 'sec' }, 'What is real here'), h('p', {}, 'All laptops, prices, reports and activity are sample data. Rows marked Concept are not built. Real data arrives by CSV import and approved owner reports.'));
  },
};

/* add my experience (shown inside the Owners view) */
async function submitPanel(box, laptopId) {
  if (box.childElementCount) { box.replaceChildren(); return; }
  const cat = await j('/api/catalog'); const msg = h('p', { class: 'msg' });
  const text = h('textarea', { name: 'text', rows: 4, maxlength: cat.max_chars, required: true, placeholder: 'What has it been like to live with? No links, emails or phone numbers.' });
  const f = h('form', { class: 'form' }, h('h2', {}, 'Add my experience'), h('p', { class: 'hint' }, 'A person reviews every report before it shows up. We do not ask for your name or contact details.'),
    sel('laptop_id', 'Which laptop do you own?', cat.laptops.map((l) => [l.id, l.name]), laptopId), sel('persona', 'How do you mostly use it?', cat.personas.map((p) => [p.value, p.label])),
    h('label', {}, 'How many months have you had it?', h('input', { type: 'number', name: 'ownership_months', min: 0, max: 120, value: 6, required: true })),
    sel('topic', 'What is your note about?', cat.topics.map((t) => [t.value, t.label])), sel('rating', 'How happy are you with this, 1 to 5?', [5, 4, 3, 2, 1].map((n) => [String(n), String(n)])),
    h('label', {}, 'Your note', text), h('button', { class: 'btn primary', type: 'submit' }, 'Send for review'), msg);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const r = await j('/api/submit-report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(f))) });
    if (r.ok) f.replaceChildren(h('h2', {}, 'Thank you'), h('p', {}, 'Your note is in the review queue. It shows up in owner reports only after a person approves it.')); else msg.textContent = r.error;
  });
  box.append(f); f.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------- router ---------- */
async function route() {
  const id = (location.hash.replace(/^#\//, '') || 'home').split('?')[0];
  const name = VIEWS[id] ? id : 'home';
  tabs.querySelectorAll('a').forEach((a) => (a.getAttribute('data-id') === name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  view.replaceChildren(); window.scrollTo(0, 0);
  await configReady; await VIEWS[name](view);
  const pending = sessionStorage.getItem('lapfit.submit');
  if (name === 'owners' && pending) { sessionStorage.removeItem('lapfit.submit'); const box = view.children[2]; if (box) submitPanel(box, pending); }
}
window.addEventListener('hashchange', route);
route();
