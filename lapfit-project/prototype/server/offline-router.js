// Offline demo reader. Only used when LAPFIT_OFFLINE_ROUTER=1 and no model key is set.
// It is a rough rules-based stand-in for the model so the app can be tried without a key.
import { parseInrAmounts } from './util.js';

const LAPTOP = /laptop|notebook|macbook|chromebook|ultrabook|\bssd\b|\bram\b|keyboard|windows|hinge|2[- ]?in[- ]?1/i;
const COLOURS = ['black', 'blue', 'red', 'green', 'white', 'silver', 'grey', 'gray', 'navy', 'pink', 'gold', 'purple', 'orange'];
const MUSTWORD = /compulsory|\bmust\b|has to|have to|required|mandatory|\bneed(?:s)?\b/i;
const USES = [['study', /study|student|college|school|class/], ['office', /office|work|account|admin|sales/], ['coding', /cod(e|ing)|program|develop/],
  ['editing', /edit|video|photo|design|render/], ['gaming', /gam(e|ing)/], ['travel', /travel|light|portable|carry|commut/], ['notes', /notes|draw|sketch|pen|handwrit/]];

function language(t) {
  if (/[ఀ-౿]/.test(t)) return 'Telugu-English';
  if (/[஀-௿]/.test(t)) return 'Tamil-English';
  if (/[ऀ-ॿ]/.test(t) || /\b(chahiye|mujhe|nahi|kya|accha|achha|lena|wala|paise|kharidna|ke liye)\b/i.test(t)) return 'Hinglish';
  if (/\b(kavali|ledu|undi|cheppu|baagundi|konali)\b/i.test(t)) return 'Telugu-English';
  if (/\b(venum|illa|irukku|sollu|enna|nalla|vaanga)\b/i.test(t)) return 'Tamil-English';
  return 'English';
}

function mentionsOf(t) {
  const out = [];
  const re = /sample\s*laptop\s*([a-h])\b/gi; let m;
  while ((m = re.exec(t))) out.push({ brand: 'SampleBrand', line: `Sample Laptop ${m[1].toUpperCase()}`, source_text: m[0] });
  if (!out.length) {
    const r2 = /\b(dell|hp|lenovo|asus|acer|apple|macbook|msi|samsung|xiaomi|redmi|realme|infinix|thinkpad|ideapad|inspiron|vivobook|zenbook|surface)\b\s*([\w-]+)?/gi;
    while ((m = r2.exec(t))) out.push({ brand: m[1], line: [m[1], m[2]].filter(Boolean).join(' '), source_text: m[0] });
  }
  const ram = t.match(/(\d{1,2})\s*gb\s*(?:ram|memory)|ram\s*(\d{1,2})\s*gb/i);
  const sto = t.match(/(\d+)\s*(gb|tb)\s*(?:ssd|storage|hdd|nvme)|(?:ssd|storage)\s*(\d+)\s*(gb|tb)/i);
  const amounts = parseInrAmounts(t);
  for (const x of out) {
    if (ram) x.ram_gb = Number(ram[1] || ram[2]);
    if (sto) { const n = Number(sto[1] || sto[3]); x.storage_gb = /tb/i.test(sto[2] || sto[4]) ? n * 1024 : n; }
    if (amounts.length) x.price_inr = amounts[0].value;
  }
  return out;
}

function criteria(t) {
  const musts = [], shoulds = [], nices = [];
  for (const clause of t.split(/[.;\n,]|\band\b|\bbut\b/i)) {
    const c = clause.trim(); if (!c) continue;
    const must = MUSTWORD.test(c);
    const soft = /prefer|ideally|if possible|would be nice|nice to have/i.test(c);
    const push = (item, explicitLimit = false) => (must || (explicitLimit && !soft) ? musts : soft ? nices : shoulds).push({ ...item, source_text: c });
    let m;
    if ((m = c.match(/(\d{1,2})\s*gb\s*(?:ram|memory)/i))) push({ attribute: 'ram_gb', operator: '>=', value: Number(m[1]) }, /at least|min|\+/i.test(c));
    if ((m = c.match(/(\d+)\s*(gb|tb)\s*(?:ssd|storage)/i))) push({ attribute: 'storage_gb', operator: '>=', value: Number(m[1]) * (/tb/i.test(m[2]) ? 1024 : 1) }, /at least|min/i.test(c));
    if ((m = c.match(/(?:under|below|less than|max|upto|up to|within)\s*(\d(?:\.\d)?)\s*kg|(\d(?:\.\d)?)\s*kg\s*(?:or less|max)/i))) push({ attribute: 'weight_kg', operator: '<=', value: Number(m[1] || m[2]) }, true);
    if (/360|convertible|2[- ]?in[- ]?1|flip|foldable/i.test(c)) push({ attribute: 'hinge_type', operator: 'in', value: ['convertible_360'] });
    if (/detachable/i.test(c)) push({ attribute: 'hinge_type', operator: 'in', value: ['detachable'] });
    if ((m = c.match(/(\d)\s*year\s*warranty/i))) push({ attribute: 'warranty_years', operator: '>=', value: Number(m[1]) });
    for (const col of COLOURS) if (new RegExp(`\\b${col}\\b`, 'i').test(c)) (must ? musts : nices).push({ attribute: 'colour', operator: 'in', value: [col], source_text: c });
    if (/touch ?screen|backlit|fingerprint|hdmi|numpad/i.test(c)) push({ attribute: c.match(/touch ?screen|backlit|fingerprint|hdmi|numpad/i)[0].toLowerCase().replace(/\s+/g, '_'), operator: '=', value: 'yes' });
  }
  return { musts, shoulds, nices };
}

function claimsOf(t) {
  const body = t.replace(/^[^:]*:/, (m) => (m.length < 60 ? '' : m));
  const parts = body.split(/[.;\n]|\bbut\b|(?<=\w),\s+(?=\w)|\band also\b/i).map((s) => s.trim().replace(/^and\s+/i, '')).filter((s) => s.length > 6);
  const type = (c) => {
    if (/overpriced|worth it|expensive|cheap|good deal|best laptop|great|amazing|waste/i.test(c)) return 'opinion';
    if (/never|always|no one|zero|100\s*%|nothing/i.test(c)) return 'absolute';
    if (/better than|faster than|lighter than|than (any|all|other)/i.test(c)) return 'comparative';
    if (/\d+\s*(gb|tb|kg|inch)|\bram\b|\bssd\b|360|convertible|detachable|\d\s*years?\s*warranty/i.test(c)) return 'spec';
    if (/battery|fast|smooth|lag|hours|gaming|heavy|hot|heat|slow|speed/i.test(c)) return 'performance';
    if (/₹|rs\.?|price|discount|offer|lakh|\bk\b/i.test(c)) return 'price';
    if (/warranty|service|replace|return|support/i.test(c)) return 'service';
    return 'performance';
  };
  return parts.map((c) => ({ claim_text: c, type: type(c), scope: '' }));
}

export function offlineRoute({ text, hasImage }) {
  const t = String(text || '');
  const lang = language(t);
  const mentions = mentionsOf(t);
  const amounts = parseInrAmounts(t);
  const base = { language: lang, needs: { budget_max_inr: null, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [] },
    laptop_mentions: [], claims: [], ignored_instructions: [], clarifying_question: null, choices: [], recipient: null, tone: 'normal', followup_flow: null };
  const done = (flow, confidence, extra = {}) => ({ ...base, flow, confidence, ...extra });

  if (/idiot|stupid|useless|shut up|hate you|\bf+u+c+k/i.test(t)) return done('clarify', 0.9, { tone: 'abusive' });
  if (/can'?t take (it|this)|hopeless|panic|want to die|feel (so )?(low|bad|alone)/i.test(t)) return done('clarify', 0.9, { tone: 'distressed' });
  if (hasImage && !t.trim()) return done('clarify', 0.3, { clarifying_question: 'Which laptop is in the photo?', choices: ['I will type the model name'] });

  const hasLaptop = LAPTOP.test(t) || mentions.length > 0 || /\bsell(ing)?\b/i.test(t) || /gamers?|owners?\b|trending|price drops?/i.test(t);
  if (!hasLaptop && /phone|iphone|\btv\b|television|watch|headphone|earbud|camera|weather|joke|recipe|cricket|movie|fridge|\bac\b|capital of/i.test(t)) return done('not_laptop', 0.9);
  if (!hasLaptop && !/budget|under|recommend|suggest|buy|need|chahiye|kavali|venum/i.test(t)) return done('not_laptop', 0.7);
  if (/(my|mera|naa|en)\s+laptop\b.*(slow|hang|virus|not turning|won'?t (start|turn)|broken|crash|battery (died|replace|drain))|how (do i|to) (install|fix|speed)|install (office|windows|software)|fix (my|the) laptop|battery repair/i.test(t)) return done('out_of_scope_laptop', 0.9);

  if (/\b(sell|selling|resale|re-sell|sold)\b|how much (can|will) i get|get more (money )?for my|trade.?in/i.test(t) && !/who sells|seller (told|said|says)|salesperson/i.test(t)) {
    const mo = (t.match(/(\d+(?:\.\d+)?)\s*(years?|yrs?|months?)\s*(old)?/i) || null);
    const age = mo ? Math.round(Number(mo[1]) * (/y/i.test(mo[2]) ? 12 : 1)) : null;
    const bat = (t.match(/battery[^.%\d]{0,20}(\d{2,3})\s*%|(\d{2,3})\s*%\s*(?:battery|health)/i) || null);
    const war = t.match(/(\d+)\s*months?\s*(?:of\s*)?warranty|warranty[^.\d]{0,12}(\d+)\s*months?/i);
    const info = {
      age_months: age, body_condition: /like new|mint|excellent/i.test(t) ? 'like_new' : /scratch|dent|scuff/i.test(t) ? 'scratched' : /broken body|damaged/i.test(t) ? 'damaged' : /good condition|good shape/i.test(t) ? 'good' : null,
      screen_condition: /crack|lines on (the )?screen|dead pixel/i.test(t) ? 'cracked' : /screen (has )?(minor )?(marks|scratch)/i.test(t) ? 'marks' : /screen (is )?(perfect|fine|clean)/i.test(t) ? 'perfect' : null,
      battery_health_pct: bat ? Number(bat[1] || bat[2]) : null, keyboard_ok: /keys?\s+(are\s+)?(not working|broken|stuck)|keyboard (issue|problem)/i.test(t) ? false : null,
      has_bill: /\b(bill|invoice)\b/i.test(t) ? !/no (bill|invoice)|lost (the )?bill/i.test(t) : null, has_box: /\bbox\b/i.test(t) ? !/no box/i.test(t) : null,
      warranty_months_left: war ? Number(war[1] || war[2]) : null, os_state: null,
      reason_for_selling: (t.match(/(?:because|as|since|selling (?:it )?(?:because|as)?)\s+(?:i|it|my)\b[^.]*/i) || [null])[0] || (/upgrad/i.test(t) ? 'upgrading' : /need (the )?money|urgent/i.test(t) ? 'need money' : /not using|don.?t use/i.test(t) ? 'not using' : null),
      urgency: /urgent|quick|asap|this week|fast/i.test(t) ? 'quick' : /best price|no hurry|can wait/i.test(t) ? 'best_price' : null };
    return done('sell_laptop', 0.85, { laptop_mentions: mentions, seller_info: info });
  }
  const daysM = t.match(/(?:last|past)\s+(\d{1,3})\s*days?/i);
  const days = daysM ? Number(daysM[1]) : /this week|last week|past week/i.test(t) ? 7 : /this month|last month|past month/i.test(t) ? 30 : null;
  if (/trending|most (checked|viewed|popular|searched)|what.?s (hot|popular)|price drops?|prices? (dropp|fell|cut)|biggest drop|rising complaints?|new complaints?/i.test(t)) return done('trending', 0.85, { owner_filters: { days } });
  if (/what do (gamers?|students?|developers?|creators?|parents?|owners?|people)\b.*\b(say|think|report|feel)|gamers?'?\s+(reviews?|reports?|say)|owners?'? (say|report)|reviews? from (gamers?|students?|owners?)|reported by (gamers?|students?|owners?)|owner (reports?|reviews?)|after \d+ months/i.test(t) && !/under|budget/i.test(t)) {
    const per = (t.match(/gamers?|students?|developers?|creators?|parents?|office/i) || [])[0] || null;
    const mo = t.match(/(?:after|over|owned?)\s+(\d{1,2})\s*(?:\+\s*)?months?/i);
    const topic = (t.match(/batter\w*|keyboard|hinge|screen|display|heat\w*|noise|fan|performance|speed|service|support/i) || [])[0] || null;
    return done('owner_voice', 0.85, { owner_filters: { persona: per, topic, min_months: mo ? Number(mo[1]) : null, days, laptop: mentions[0]?.line || null } });
  }
  const needs = { ...base.needs, ...criteria(t) };
  const ui = []; for (const [name, re] of USES) if (re.test(t)) ui.push(name); needs.use_cases = ui;
  const budgetCue = t.match(/(?:under|below|upto|up to|within|budget|max(?:imum)?|around|about|tak|ke andar)\D{0,12}?((?:₹|rs\.?\s*)?[\d.,]+\s*(?:k|lakh|lac)?)/i);
  if (budgetCue) { const a = parseInrAmounts(budgetCue[1]); if (a.length) needs.budget_max_inr = a[0].value; }
  else if (amounts.length && mentions.length === 0) needs.budget_max_inr = amounts[0].value;

  let recipient = null;
  if (/\b(mom|mother|dad|father|parents?|mummy|papa|grandm\w+|grandf\w+)\b/i.test(t)) recipient = 'parent';
  else if (/\b(son|daughter|kid|child|children|nephew|niece)\b/i.test(t)) recipient = 'child';
  else if (/\b(team|staff|employees|roles?|department)\b/i.test(t)) recipient = 'team';

  if (/\bused\b|second[- ]?hand|refurb|pre[- ]?owned|olx|battery health/i.test(t)) return done('used_check', 0.85, { needs, laptop_mentions: mentions });
  if (recipient && /\bfor (my|a|our|the)\b|buying|gift/i.test(t)) return done('buy_for_others', 0.85, { needs, recipient, laptop_mentions: mentions });
  if (/salesperson|sales ?man|seller|shopkeeper|told me|they (said|say|claim)|claims?|advert|listing says|video (said|says)|pitch|promised|\bsays\b/i.test(t) && /["“”:]|said|says|claim|told/i.test(t)) {
    const claims = claimsOf(t); if (claims.length) {
      return done('check_pitch', 0.85, { needs, laptop_mentions: mentions, claims: claims.map((c) => ({ ...c, scope: mentions[0]?.line || '' })),
        followup_flow: /better|alternativ|other (ones|options)|show me/i.test(t) ? 'shortlist' : null });
    }
  }
  if (mentions.length && /consider|should i|thinking of|worth|second opinion|is it (good|ok)|going to buy|want to buy|planning/i.test(t)) return done('second_opinion', 0.85, { needs, laptop_mentions: mentions });
  if (mentions.length) return done('second_opinion', 0.65, { needs, laptop_mentions: mentions });
  if (/suggest|recommend|looking for|need a|want a|chahiye|kavali|venum|best|under|budget|show me|help me (choose|pick|find)/i.test(t) || needs.budget_max_inr) return done('shortlist', 0.85, { needs });
  return done('clarify', 0.4, { needs, clarifying_question: 'What would you like to do?',
    choices: ['Check a laptop I am considering', 'Check what a seller told me', 'Get a shortlist', 'Check a used listing'] });
}
