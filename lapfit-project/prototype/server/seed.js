// SAMPLE data only. Made-up brand, made-up laptops, made-up numbers.
// Dates are relative to the day the database is seeded, so "last 30 days" always has data to show.
// Real data arrives later by CSV import (scripts/import-csv.js).
const DAY = 86400000;
const isoDay = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);
const isoTs = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();

const MODELS = [
  ['A', 'Sample Laptop A', 2024, 'SampleChip S3', 'Integrated', 14.0, 1.20, 'clamshell', 'One slot free', '1 year', 1],
  ['B', 'Sample Laptop B', 2024, 'SampleChip S5', 'Integrated', 14.0, 1.40, 'convertible_360', 'Soldered', '1 year', 1],
  ['C', 'Sample Laptop C', 2023, 'SampleChip S5', 'Integrated', 15.6, 1.80, 'clamshell', 'Two slots, one free', '2 years', 2],
  ['D', 'Sample Laptop D', 2025, 'SampleChip S3', 'Integrated', 12.0, 0.90, 'detachable', 'Soldered', '1 year', 1],
  ['E', 'Sample Laptop E', 2025, 'SampleChip S7', 'Integrated', 14.0, 1.30, 'convertible_360', 'Soldered', '2 years', 2],
  ['F', 'Sample Laptop F', 2025, 'SampleChip S9', 'SampleGraphics G4', 16.0, 2.10, 'clamshell', 'Two slots, both used', '2 years', 2],
  ['G', 'Sample Laptop G', 2025, 'SampleChip S7', 'Integrated', 13.3, 1.10, 'clamshell', 'Soldered', '3 years', 3],
  ['H', 'Sample Laptop H', 2023, 'SampleChip S3', 'Integrated', 15.6, 1.60, 'convertible_360', 'One slot free', '1 year', 1],
];
// model, ram, storage, colours, price, availability, earlier-price premium (a price fall over the last two months)
const VARIANTS = [
  ['A', 8, 256, ['Silver', 'Grey'], 38990, 'in_stock', 0],
  ['A', 16, 512, ['Silver', 'Grey'], 46990, 'in_stock', 0],
  ['B', 16, 512, ['Blue', 'Black'], 62990, 'in_stock', 0.10],
  ['B', 8, 256, ['Blue', 'Black'], 52990, 'limited', 0],
  ['C', 16, 512, ['Black'], 55990, 'in_stock', 0],
  ['D', 8, 256, ['Grey', 'Navy'], 45990, 'in_stock', 0],
  ['E', 16, 1024, ['Silver', 'Green'], 78990, 'in_stock', 0.07],
  ['E', 16, 512, ['Silver', 'Green'], 71990, 'in_stock', 0],
  ['F', 32, 1024, ['Black'], 105000, 'limited', 0],
  ['G', 16, 512, ['White', 'Silver'], 71990, 'in_stock', 0.05],
  ['H', 8, 512, ['Blue', 'Red'], 49990, 'in_stock', 0.04],
  ['H', 8, 256, ['Blue', 'Red'], 44990, 'in_stock', 0],
  ['A', 16, 256, ['Silver', 'Grey'], 43990, 'in_stock', 0],
];
// laptop, topic, text, source, n_reports, months owned, rating, reviewer type, persona, days ago
const O = 'SampleOwners Forum', R = 'SampleReviews Blog';
const EVIDENCE = [
  ['A', 'battery', 'Most owners get a working day of light use on one charge.', O, 14, 6, 4.0, 'owner', 'student', 40],
  ['A', 'keyboard', 'Keys feel firm. A few owners find them shallow.', O, 9, 5, 3.8, 'owner', 'student', 35],
  ['B', 'battery', 'Owners report about seven to eight hours of mixed use.', O, 26, 8, 3.9, 'owner', 'office', 25],
  ['B', 'battery', 'Battery drops faster when the screen is folded into tablet mode for long.', R, 11, 10, 3.5, 'reviewer', 'creator', 20],
  ['B', 'hinge', 'The 360 hinge stays firm for most owners after months of use.', O, 22, 9, 4.2, 'owner', 'student', 15],
  ['C', 'performance', 'Handles spreadsheets and many browser tabs without slowing down.', O, 31, 12, 4.3, 'owner', 'office', 33],
  ['C', 'heat_noise', 'Fan gets audible under heavy load, quiet otherwise.', R, 18, 7, 3.6, 'reviewer', 'gamer', 12],
  ['D', 'hinge', 'The kickstand and detachable keyboard feel flimsy for some owners.', O, 8, 4, 2.9, 'owner', 'student', 8],
  ['E', 'display', 'Owners like the bright, sharp screen.', O, 24, 5, 4.5, 'owner', 'creator', 28],
  ['F', 'heat_noise', 'Gets hot and loud when gaming.', R, 27, 6, 3.2, 'reviewer', 'gamer', 18],
  ['G', 'keyboard', 'Quiet keys with good travel. Owners type on it all day.', O, 12, 3, 4.4, 'owner', 'developer', 22],
  ['H', 'performance', 'Fine for study and office work. Slows with many apps open.', O, 6, 11, 3.3, 'owner', 'student', 45],
  ['F', 'heat_noise', 'Fans ramp up within minutes of gaming. The area above the keys gets warm.', O, 11, 9, 2.6, 'owner', 'gamer', 6],
  ['F', 'heat_noise', 'Noise was fine in the first weeks.', O, 4, 2, 3.6, 'owner', 'gamer', 42],
  ['F', 'performance', 'Runs current games at high settings for most owners.', O, 19, 3, 4.4, 'owner', 'gamer', 10],
  ['F', 'performance', 'Frame rates hold up after months of use.', O, 9, 8, 4.3, 'owner', 'gamer', 24],
  ['F', 'battery', 'Battery lasts about two hours while gaming.', O, 17, 5, 2.7, 'owner', 'gamer', 9],
  ['C', 'heat_noise', 'Gets warm in long gaming sessions but stays playable.', O, 9, 6, 3.4, 'owner', 'gamer', 14],
  ['C', 'performance', 'Fine for light games. Struggles with new heavy titles.', O, 7, 4, 3.1, 'owner', 'gamer', 5],
  ['B', 'heat_noise', 'Quiet and cool in everyday use.', O, 13, 7, 4.1, 'owner', 'office', 11],
  ['A', 'battery', 'Lasts through a full college day for most students.', O, 17, 6, 4.1, 'owner', 'student', 7],
  ['H', 'keyboard', 'Keys wear shiny after a year. Typing stays comfortable.', O, 8, 14, 3.5, 'owner', 'student', 16],
  ['D', 'hinge', 'The kickstand loosened after a few months for some students.', O, 10, 5, 2.5, 'owner', 'student', 4],
  ['G', 'performance', 'Compiles code and runs containers smoothly with 16 GB.', O, 15, 4, 4.3, 'owner', 'developer', 13],
  ['E', 'performance', 'Handles large projects. The fan stays quiet.', O, 12, 3, 4.4, 'owner', 'developer', 19],
  ['G', 'battery', 'Around seven hours of coding on one charge.', O, 10, 3, 4.0, 'owner', 'developer', 21],
  ['E', 'display', 'Colours look accurate for photo editing.', O, 14, 4, 4.5, 'owner', 'creator', 9],
  ['E', 'heat_noise', 'Warm during video exports, with no slowdown.', O, 9, 5, 3.8, 'owner', 'creator', 27],
  ['A', 'display', 'Text is easy to read for parents at the default size.', O, 8, 5, 4.2, 'owner', 'parent', 20],
  ['A', 'service', 'The service centre visit took six days.', O, 6, 6, 2.8, 'owner', 'parent', 11],
  ['G', 'service', 'The service centre replaced the part in three days.', O, 5, 5, 4.3, 'owner', 'parent', 30],
  ['B', 'hinge', 'After a year the hinge still feels firm.', O, 8, 14, 4.4, 'owner', 'student', 26],
  ['C', 'battery', 'Battery health drops noticeably after one year.', O, 12, 13, 2.9, 'owner', 'office', 3],
  ['C', 'battery', 'Battery was fine in the first months.', O, 9, 3, 4.2, 'owner', 'office', 38],
  ['C', 'battery', 'Battery drains faster after about a year.', O, 5, 12, 2.8, 'owner', 'office', 40],
];
// id, claim, scope, match terms, verdict, sample size, evidence ids, approver (null means not approved)
const LEDGER = [
  ['L1', 'Battery lasts a full day', 'Sample Laptop B', 'battery,full day,all day', 'Partly supported: most owners report 7 to 8 hours of mixed use, not a full day.', 37, ['E3', 'E4'], 'Sample Reviewer 1'],
  ['L2', 'Runs heavy software without slowing down', 'Sample Laptop C', 'heavy,software,without slowing,smooth,lag', 'Supported for office and spreadsheet work. Not tested for video editing.', 31, ['E6'], 'Sample Reviewer 2'],
  ['L3', 'Never gets hot', 'general', 'never gets hot,does not heat,no heating,stays cool', null, null, [], null],
];
// Repair and prep costs for the sell flow. SAMPLE estimates, not quotes.
const RESALE_ACTIONS = [
  ['os_clean', 'Reset and reinstall the operating system', 0, 0, 'Free. Back up first.'],
  ['gather_docs', 'Find the original bill and box', 0, 0, 'Free.'],
  ['clean_cosmetic', 'Deep clean the body, screen and keyboard', 0, 0, 'Free if you do it yourself. A shop may charge a few hundred rupees.'],
  ['replace_battery', 'Replace the battery', 2500, 4000, 'Sample estimate. Get a real quote.'],
  ['fix_keyboard', 'Repair or replace the keyboard', 1500, 3000, 'Sample estimate. Get a real quote.'],
  ['replace_screen', 'Replace the screen', 8000, 12000, 'Sample estimate. Get a real quote.'],
  ['ram_upgrade', 'Add more RAM', 2000, 3500, 'Sample estimate. Needs a free memory slot.'],
];
// "Most checked" sample activity: [laptop, views in the last 30 days, views in the 30 days before]
const ACTIVITY = [['F', 41, 20], ['B', 36, 30], ['C', 26, 28], ['E', 23, 12], ['G', 15, 9], ['A', 12, 14], ['D', 6, 8], ['H', 5, 7]];

// "What buyers asked for" in sample searches: [budget band, use cases, musts, matched variants, how many searches]
const DEMAND = [
  ['₹40,000 to ₹60,000', ['coding'], ['RAM 16 GB or more'], 3, 34], ['₹40,000 to ₹60,000', ['study'], ['Weight up to 1.5 kg'], 5, 29],
  ['Under ₹40,000', ['study'], ['RAM 8 GB or more'], 1, 22], ['₹60,000 to ₹80,000', ['editing'], ['RAM 16 GB or more', 'Storage 1 TB or more'], 1, 18],
  ['₹80,000 and above', ['gaming'], ['RAM 32 GB or more'], 1, 16], ['₹40,000 to ₹60,000', ['notes'], ['Hinge: 360° convertible'], 2, 14],
  ['Under ₹40,000', ['coding'], ['RAM 16 GB or more', 'Weight up to 1.2 kg'], 0, 21], ['₹40,000 to ₹60,000', ['travel'], ['Storage 1 TB or more', 'Hinge: 360° convertible'], 0, 15],
  ['Under ₹40,000', ['travel', 'study'], ['Screen 14 inch or more', 'Weight up to 1 kg'], 0, 12], ['₹80,000 and above', ['gaming', 'travel'], ['Weight up to 1.5 kg', 'RAM 32 GB or more'], 0, 9],
  ['₹60,000 to ₹80,000', ['office'], ['Warranty 3 years or more'], 1, 11], ['No budget given', ['study'], ['Weight up to 1.3 kg'], 4, 8],
];

export function seed(db) {
  const f = () => [1, 'sample-seed', isoDay(0), 1];
  const insModel = db.prepare(`INSERT INTO laptop_model VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insVar = db.prepare(`INSERT INTO variant VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insHist = db.prepare(`INSERT INTO price_history (variant_id, seller, price_inr, timestamp, verified, verified_by, verified_at, is_sample) VALUES (?,?,?,?,?,?,?,?)`);
  const insEv = db.prepare(`INSERT INTO evidence_excerpt (id, laptop_id, topic, text, source_name, source_url, date, reviewer_type, ownership_months, n_reports, rating, persona, verified, verified_by, verified_at, is_sample) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insLed = db.prepare(`INSERT INTO claim_ledger VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insAct = db.prepare('INSERT INTO resale_action (id, label, cost_low, cost_high, note, verified, verified_by, verified_at, is_sample) VALUES (?,?,?,?,?,?,?,?,?)');
  const insView = db.prepare(`INSERT INTO view_events (ts, laptop_id, kind, is_sample) VALUES (?,?,?,1)`);
  const r10 = (n) => Math.round(n / 10) * 10;
  db.transaction(() => {
    for (const m of MODELS) insModel.run(m[0], 'SampleBrand', m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], ...f());
    VARIANTS.forEach((v, i) => {
      const id = `${v[0]}${i + 1}`, cur = v[4], up = v[6];
      insVar.run(id, v[0], v[1], v[2], JSON.stringify(v[3]), cur, isoDay(0), v[5], ...f());
      const hist = [[100, 'SampleStore One', 1 + up], [50, 'SampleStore Two', 1 + up], [20, 'SampleStore One', 1 + up * 0.5], [3, 'SampleStore One', 1]];
      for (const [d, seller, k] of hist) insHist.run(id, seller, r10(cur * k), isoTs(d), ...f());
    });
    EVIDENCE.forEach((e, i) => insEv.run(`E${i + 1}`, e[0], e[1], e[2], e[3], `https://example.com/sample/${i + 1}`, isoDay(e[9]), e[7], e[5], e[4], e[6], e[8], ...f()));
    for (const l of LEDGER) insLed.run(l[0], l[1], l[2], l[3], l[4], l[5], JSON.stringify(l[6]), l[7], l[7] ? isoDay(0) : null, ...f());
    for (const a of RESALE_ACTIONS) insAct.run(...a, ...f());
    const insDem = db.prepare('INSERT INTO demand_signal (ts, budget_band, use_cases, musts, matched, is_sample) VALUES (?,?,?,?,?,1)');
    let dn = 11; const dr = () => ((dn = (dn * 9301 + 49297) % 233280) / 233280);
    for (const [band, uc, musts, matched, times] of DEMAND) for (let i = 0; i < times; i++) insDem.run(isoTs(dr() * 85), band, JSON.stringify(uc), JSON.stringify(musts), matched);
    let seedN = 7;
    const rnd = () => ((seedN = (seedN * 9301 + 49297) % 233280) / 233280);
    for (const [id, recent, prior] of ACTIVITY) {
      for (let i = 0; i < recent; i++) insView.run(isoTs(rnd() * 29.5), id, 'view');
      for (let i = 0; i < prior; i++) insView.run(isoTs(30.5 + rnd() * 29), id, 'view');
    }
  })();
}
