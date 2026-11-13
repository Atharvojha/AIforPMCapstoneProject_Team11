// SELL FLOW. "What should I do to get more for my laptop?"
// The model only reads the user's words into seller_info. Every rupee figure below is worked out here, in code,
// from the catalog price, the settings in settings.js (SAMPLE assumptions) and repair costs in the resale_action table.
import { SETTINGS } from '../settings.js';
import { db, isShowable } from './db.js';
import { getVariant, variantsOfModel, computeTrending } from './engine.js';
import { resolveVariant } from './flows.js';
import { fmtInr, fmtDate, fmtStorage } from './util.js';

const R = SETTINGS.RESALE;
const r100 = (n) => Math.round(n / 100) * 100;
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
const bool = (v) => (v === true || v === 'true' || v === 'yes' ? true : v === false || v === 'false' || v === 'no' ? false : null);

/** One normaliser for the form and for the model's seller_info. Anything not understood becomes null (unknown), never a guess. */
export function normSeller(raw = {}) {
  const t = (k) => String(raw[k] ?? '').toLowerCase();
  let months = num(raw.months_owned) ?? num(raw.age_months);
  if (months == null && num(raw.age_years) != null) months = Math.round(num(raw.age_years) * 12);
  const body = ['like_new', 'good', 'scratched', 'damaged'].includes(t('body')) ? t('body') : (() => {
    const s = t('body_condition') || t('body'); if (!s) return null;
    if (/like.?new|mint|excellent|no scratch/.test(s)) return 'like_new';
    if (/broken|crack|damage|dent|bent/.test(s)) return 'damaged';
    if (/scratch|scuff|worn|marks?/.test(s)) return 'scratched';
    if (/good|fine|minor|light|ok/.test(s)) return 'good'; return null;
  })();
  const screen = ['perfect', 'marks', 'cracked'].includes(t('screen')) ? t('screen') : (() => {
    const s = t('screen_condition') || t('screen'); if (!s) return null;
    if (/crack|line|dead|broken|flicker|spot/.test(s)) return 'cracked';
    if (/mark|scratch|minor|smudge/.test(s)) return 'marks';
    if (/perfect|fine|good|clean|flawless/.test(s)) return 'perfect'; return null;
  })();
  let battery = num(raw.battery_pct) ?? num(raw.battery_health_pct); if (battery != null) battery = Math.max(0, Math.min(100, Math.round(battery)));
  let docs = ['bill_box', 'bill', 'none'].includes(t('docs')) ? t('docs') : null;
  if (!docs && (bool(raw.has_bill) != null || bool(raw.has_box) != null)) { const b = bool(raw.has_bill), x = bool(raw.has_box); docs = b && x ? 'bill_box' : b ? 'bill' : b === false && x === false ? 'none' : b === false ? 'none' : null; }
  const os = ['fresh', 'cluttered'].includes(t('os')) ? t('os') : /fresh|clean|reset/.test(t('os_state')) ? 'fresh' : /cluttered|files|old|used|messy/.test(t('os_state')) ? 'cluttered' : null;
  const rs = (t('reason') || t('reason_for_selling')).replace(/_/g, ' ');
  const reason = !rs ? null : /upgrad|new laptop|bought (a )?new|switch/.test(rs) ? 'upgrade' : /money|cash|urgent|emergency|fund/.test(rs) ? 'need_money' : /not using|unused|extra|spare|don.?t use|no longer/.test(rs) ? 'not_using' : /problem|issue|fault|drain|heat|slow|hang|battery|broken|repair|noise/.test(rs) ? 'issue' : /gift/.test(rs) ? 'gift' : 'other';
  const urgency = /quick|urgent|asap|fast|week|immediately/.test(t('urgency')) ? 'quick' : /best|price|wait|no hurry|patient/.test(t('urgency')) ? 'best_price' : null;
  return {
    variant_id: raw.variant_id ? String(raw.variant_id) : null, months_owned: months != null && months >= 0 ? Math.round(months) : null,
    body, screen, battery_pct: battery, keyboard_ok: bool(raw.keyboard_ok), docs, warranty_months: num(raw.warranty_months) ?? num(raw.warranty_months_left),
    os, reason, urgency, cleaned: false,
  };
}

const ageFactor = (m) => { const months = m ?? R.AGE_UNKNOWN_MONTHS; return R.AGE_CURVE.find(([lim]) => months <= lim)[1]; };
function factorsOf(s) {
  const f = []; const add = (label, value, note) => f.push({ label, value, note });
  add('Age', ageFactor(s.months_owned), s.months_owned == null ? 'Age unknown, so a middle value is used' : `${s.months_owned} months owned`);
  add('Body', s.body ? R.BODY[s.body] : R.BODY_UNKNOWN, s.body ? { like_new: 'Like new', good: 'Good', scratched: 'Scratched or dented', damaged: 'Damaged' }[s.body] : 'Condition not given');
  add('Screen', s.screen ? R.SCREEN[s.screen] : R.SCREEN_UNKNOWN, s.screen ? { perfect: 'Perfect', marks: 'Minor marks', cracked: 'Cracked or lines' }[s.screen] : 'Condition not given');
  const bat = s.battery_pct == null ? R.BATTERY_UNKNOWN : R.BATTERY.find(([min]) => s.battery_pct >= min)[1];
  add('Battery', bat, s.battery_pct == null ? 'Battery health not given' : `${s.battery_pct}% health`);
  add('Keyboard', s.keyboard_ok == null ? R.KEYBOARD_UNKNOWN : s.keyboard_ok ? R.KEYBOARD_OK : R.KEYBOARD_BAD, s.keyboard_ok == null ? 'Not given' : s.keyboard_ok ? 'All keys work' : 'Some keys do not work');
  add('Bill and box', s.docs ? R.DOCS[s.docs] : R.DOCS_UNKNOWN, s.docs ? { bill_box: 'Bill and box', bill: 'Bill only', none: 'No bill' }[s.docs] : 'Not given');
  const w = s.warranty_months; add('Warranty left', w >= 6 ? R.WARRANTY_6_PLUS : w >= 1 ? R.WARRANTY_1_PLUS : 1, w == null ? 'Not given' : `${w} months left`);
  add('Software', s.os ? R.OS[s.os] : R.OS_UNKNOWN, s.os ? { fresh: 'Freshly reset', cluttered: 'Full of old files and apps' }[s.os] : 'Not given');
  if (s.cleaned) add('Deep clean', R.CLEANED, 'Cleaned before photos');
  return f;
}
const unknownCount = (s) => ['months_owned', 'body', 'screen', 'battery_pct', 'keyboard_ok', 'docs', 'os'].filter((k) => s[k] == null).length;

function value(s) {
  const v = getVariant(s.variant_id); const f = factorsOf(s);
  const mid = r100(v.price_inr * f.reduce((a, x) => a * x.value, 1));
  const spread = Math.min(R.SPREAD_MAX, R.SPREAD + R.SPREAD_PER_UNKNOWN * unknownCount(s));
  return { v, f, mid, low: r100(mid * (1 - spread)), high: r100(mid * (1 + spread)), spread };
}
const range = (x) => ({ low: x.low, mid: x.mid, high: x.high, text: `${fmtInr(x.low)} to ${fmtInr(x.high)}` });

const costRow = (id) => db.prepare(`SELECT * FROM resale_action a WHERE a.id = ? AND ${isShowable('a')}`).get(id);
const freeSlot = (v) => /free/i.test(v.ram_slots_or_soldered);
const higherRam = (v) => variantsOfModel(v.model_id).filter((x) => x.ram_gb > v.ram_gb && x.storage_gb === v.storage_gb).sort((a, b) => a.price_inr - b.price_inr)[0] || null;

const ACTIONS = [
  { id: 'os_clean', applies: (s) => s.os === 'cluttered', after: (s) => ({ ...s, os: 'fresh' }), why: 'A laptop that boots clean looks cared for, and buyers do not want your files.',
    steps: ['Back up photos and files you want to keep.', 'Sign out of your accounts and turn off device tracking and locks.', 'Use the reset option in settings to remove everything and reinstall the system.'] },
  { id: 'gather_docs', applies: (s) => s.docs === 'bill', after: (s) => ({ ...s, docs: 'bill_box' }), why: 'The original box and charger make buyers trust it is genuine.',
    steps: ['Look for the original box, charger and any accessories.', 'Keep the bill ready to show.'] },
  { id: 'clean_cosmetic', applies: (s) => !s.cleaned && s.body !== 'damaged', after: (s) => ({ ...s, cleaned: true }), why: 'Clean, bright photos are the first thing a buyer sees.',
    steps: ['Wipe the body with a slightly damp soft cloth.', 'Clean the screen with a microfibre cloth and the keyboard with a soft brush.', 'Clean the vents and ports gently.'] },
  { id: 'replace_battery', applies: (s) => s.battery_pct != null && s.battery_pct < 80, after: (s) => ({ ...s, battery_pct: 100 }), why: 'Weak battery life is the most common reason buyers walk away or push the price down.',
    steps: ['Get a written quote from the maker\'s service centre or a trusted shop.', 'Ask for a genuine battery and a receipt.', 'Mention the new battery and show the receipt in your listing.'] },
  { id: 'fix_keyboard', applies: (s) => s.keyboard_ok === false, after: (s) => ({ ...s, keyboard_ok: true }), why: 'Keys that do not work are an instant negotiation point.',
    steps: ['Get a quote from a service centre.', 'Keep the receipt to show the repair.'] },
  { id: 'replace_screen', applies: (s) => s.screen === 'cracked', after: (s) => ({ ...s, screen: 'perfect' }), why: 'A cracked screen puts many buyers off.',
    steps: ['Get a quote before deciding.', 'If it is not worth it, sell as-is and say so clearly.'] },
  { id: 'ram_upgrade', applies: (s, v) => freeSlot(v) && !!higherRam(v), after: (s, v) => ({ ...s, variant_id: higherRam(v).variant_id }), why: 'More memory moves your laptop into a higher catalog version.',
    steps: ['Check the exact memory type your model takes before buying.', 'Fit it yourself only if the manual shows how; otherwise ask a shop.', 'Keep the receipt.'] },
];

export function computeSellPlan(input) {
  const s = { ...normSeller(input), variant_id: String(input.variant_id) }; // already-normalised input stays the same
  const v = getVariant(s.variant_id); if (!v) return null;
  const base = value(s);
  const unknown = [];
  if (s.months_owned == null) unknown.push('How old it is. Age is the biggest driver of price.');
  if (s.battery_pct == null) unknown.push('Battery health. Open the battery report; below 80% lowers the price and a new battery may be worth it.');
  if (s.body == null) unknown.push('Body condition: like new, good, scratched or damaged.');
  if (s.screen == null) unknown.push('Screen condition.');
  if (s.keyboard_ok == null) unknown.push('Whether every key works.');
  if (s.docs == null) unknown.push('Whether you have the bill and the box.');
  if (s.os == null) unknown.push('Whether the laptop is freshly reset or full of old files.');

  const evaluated = [];
  for (const a of ACTIONS) {
    if (!a.applies(s, v)) continue;
    const row = costRow(a.id); if (!row) continue;
    const after = value({ ...a.after(s, v) });
    const gain = after.mid - base.mid, cost = (row.cost_low + row.cost_high) / 2, net = gain - cost;
    const free = row.cost_high === 0;
    const verdict = net >= R.MIN_NET_INR || (free && gain >= 0 && net >= 0) ? 'do' : 'skip';
    const costText = free ? 'Free' : row.cost_low === 0 ? `Free to ${fmtInr(row.cost_high)}` : `${fmtInr(row.cost_low)} to ${fmtInr(row.cost_high)}`;
    evaluated.push({
      id: a.id, title: row.label, verdict, why: a.why, steps: a.steps, cost_text: costText, cost_note: row.note,
      gain, gain_text: `${gain >= 0 ? 'adds about' : 'changes the value by'} ${fmtInr(Math.abs(gain))}`, net, net_text: net >= 0 ? `about ${fmtInr(net)} better off` : `about ${fmtInr(-net)} worse off`,
      summary: verdict === 'do'
        ? `Costs ${costText} and adds about ${fmtInr(gain)} to the middle price, so you are about ${fmtInr(Math.max(0, net))} better off.`
        : `Costs ${costText} and adds about ${fmtInr(Math.max(0, gain))}, so you would be about ${fmtInr(Math.max(0, -net))} worse off. Sell as it is and say so in the listing.`,
      _cost: cost,
    });
  }
  evaluated.sort((a, b) => (b.verdict === 'do') - (a.verdict === 'do') || b.net - a.net || a.id.localeCompare(b.id));
  // all worthwhile fixes together
  let chain = { ...s }; let costTotal = 0; const applied = [];
  for (const e of evaluated.filter((x) => x.verdict === 'do')) { const a = ACTIONS.find((x) => x.id === e.id); const vv = getVariant(chain.variant_id); if (a.applies(chain, vv)) { chain = a.after(chain, vv); costTotal += e._cost; applied.push(e.id); } }
  const fixed = value(chain);
  const gainTotal = fixed.mid - base.mid;
  const basis = applied.length ? fixed : base;
  const quick = { list: r100(basis.mid), floor: basis.low }, best = { list: basis.high, floor: basis.mid };
  const focus = s.urgency === 'quick' ? 'quick' : s.urgency === 'best_price' ? 'best' : null;

  // timing: from the new-price history in the catalog
  const drop = computeTrending(SETTINGS.TREND_WINDOW_DAYS, 50).drops.find((d) => d.variant_id === v.variant_id) || computeTrending(SETTINGS.TREND_WINDOW_DAYS, 50).drops.find((d) => d.laptop_id === v.model_id);
  const timing = [drop ? `The new price of this model fell ${drop.pct}% in the last ${SETTINGS.TREND_WINDOW_DAYS} days (${fmtInr(drop.was)} to ${fmtInr(drop.now)}, as of ${fmtDate(drop.now_date)}). Buyers compare with new prices, so waiting may cost you.` : `The new price of this model has not fallen in the last ${SETTINGS.TREND_WINDOW_DAYS} days, so there is no price reason to rush.`];
  if (s.warranty_months != null && s.warranty_months > 0 && s.warranty_months < 3) timing.push(`Your warranty has ${s.warranty_months} month${s.warranty_months > 1 ? 's' : ''} left. Selling before it ends keeps it as a selling point.`);

  const disclosures = [];
  if (s.battery_pct != null && s.battery_pct < 85) disclosures.push(`Battery health is ${s.battery_pct}%. Say the number.`);
  if (s.keyboard_ok === false) disclosures.push('Some keys do not work. Say which ones.');
  if (s.screen === 'cracked') disclosures.push('The screen is cracked or has lines. Show a clear photo of it.');
  if (s.screen === 'marks') disclosures.push('The screen has minor marks. Show them in a photo.');
  if (s.body === 'scratched' || s.body === 'damaged') disclosures.push('Show the scratches or damage in photos.');
  const reasonNote = { upgrade: 'You are upgrading. Say so: it tells buyers the laptop was looked after.', need_money: 'Do not mention that you need money fast in the listing. Buyers use it to push the price down. Decide your lowest price privately.',
    not_using: 'It is barely used. Say so, and give the months owned and the hours of use if you know them.', issue: 'You are selling because of a fault. Describe the fault plainly and price for it. Hiding it leads to returns and arguments.',
    gift: 'Say it is a gift and give the purchase date. Keep the box if you have it.', other: 'Give a short, honest reason. A clear reason makes buyers trust you.' }[s.reason] || null;

  return {
    laptop: { id: v.model_id, name: `${v.brand} ${v.line}`, variant_id: v.variant_id, variant_label: `${v.ram_gb} GB RAM, ${fmtStorage(v.storage_gb)}`, new_price: v.price_inr, new_price_text: fmtInr(v.price_inr), as_of_text: fmtDate(v.price_as_of) },
    input: s, today: range(base), spread_pct: Math.round(base.spread * 100),
    factors: base.f.map((x) => ({ label: x.label, value: x.value, note: x.note })), unknown,
    actions: evaluated.map(({ _cost, ...rest }) => rest),
    with_fixes: applied.length ? { ...range(fixed), applied, cost_text: costTotal ? fmtInr(Math.round(costTotal)) : 'Free', gain_text: fmtInr(Math.max(0, gainTotal)), net_text: fmtInr(Math.round(Math.abs(gainTotal - costTotal))), net_positive: gainTotal - costTotal >= 0 } : null,
    listing: { quick: { list: quick.list, floor: quick.floor, text: `List at ${fmtInr(quick.list)}. Accept down to ${fmtInr(quick.floor)}.` }, best: { list: best.list, floor: best.floor, text: `List at ${fmtInr(best.list)}. Accept down to ${fmtInr(best.floor)}.` }, focus,
      tips: ['Take photos in daylight: front, screen on, keyboard, ports, both sides and any damage.', 'Show the battery report and the model sticker or settings page.', 'Write the exact model, memory, storage, age and what is in the box.', 'Meet in a public place and let the buyer test everything before paying.', 'Take payment only once the buyer is satisfied, and remove your accounts before you hand it over.'] },
    timing, reason_note: reasonNote, disclosures,
    cannot_judge: ['What buyers near you will actually pay this week.', 'Faults you have not noticed.', 'The multipliers here are sample assumptions, not real sales data.'],
  };
}

const GENERIC_TIPS = ['Back up your files, sign out of every account and reset the laptop.', 'Clean the body, screen and keyboard.', 'Find the bill, box and charger.', 'Open the battery report and note the health number.', 'Take clear photos in daylight, including any damage.', 'Compare with listings for the same model before you set a price.', 'Be honest about faults and the reason you are selling.'];

/** The flow. Returns blocks. */
export function sellFlow({ router, formOverride = null }) {
  let state, blocks = [];
  if (formOverride) { state = normSeller(formOverride); if (!state.variant_id) return { blocks: [{ type: 'text', text: 'Pick which laptop you are selling.' }] }; }
  else {
    const mention = router.laptop_mentions?.[0];
    if (!mention) return { blocks: [{ type: 'text', text: 'Which laptop are you selling? Pick it in the form for the sharpest answer.' }, { type: 'offer', label: 'Open the sell form', sellForm: {} }] };
    const res = resolveVariant(mention);
    if (!res.variant) {
      if (res.notFound) return { blocks: [{ type: 'text', text: 'That laptop is not in the catalog, so I will not guess what it is worth. Here is what helps any laptop sell for more.' }, { type: 'sell_tips', tips: GENERIC_TIPS }] };
      return { blocks: res.blocks };
    }
    state = normSeller({ ...(router.seller_info || {}), variant_id: res.variant.variant_id });
  }
  const plan = computeSellPlan(state);
  if (!plan) return { blocks: [{ type: 'text', text: 'I could not find that laptop in the catalog.' }] };
  blocks.push({ type: 'sell_plan', ...plan });
  if (plan.unknown.length && !formOverride) blocks.push({ type: 'offer', label: 'Add the missing details for a sharper range', sellForm: plan.input });
  return { blocks };
}
