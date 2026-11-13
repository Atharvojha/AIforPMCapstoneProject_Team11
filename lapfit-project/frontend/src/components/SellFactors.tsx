import { useState } from 'react';

export const FLAG_GROUPS: { title: string; items: [string, string][] }[] = [
  { title: 'Screen, keyboard, hinge', items: [['cracked_screen', 'Cracked screen'], ['dead_pixels', 'Dead pixels'], ['keys_missing', 'Keys missing or worn'], ['hinge_loose', 'Loose hinge']] },
  { title: 'Battery', items: [['battery_replaced', 'Battery replaced'], ['battery_swollen', 'Battery swollen']] },
  { title: 'Damage', items: [['water_damage', 'Water damage'], ['scratches_dents', 'Scratches or dents'], ['repaired', 'Opened or repaired before']] },
  { title: 'What comes with it', items: [['has_box', 'Original box'], ['has_bill', 'Original bill'], ['no_charger', 'No charger'], ['warranty_left', 'Warranty left']] },
  { title: 'Upgrades', items: [['ssd_upgraded', 'Storage upgraded'], ['ram_upgraded', 'RAM upgraded']] },
  { title: 'How you want to sell', items: [['need_fast', 'Need to sell fast']] },
];

/** Grouped chips you can search ("screen", "box"...). Tap to switch on, tap again to switch off. */
export function SellFactors({ value, onChange }: { value: string[]; onChange(v: string[]): void }) {
  const [q, setQ] = useState(''); const needle = q.trim().toLowerCase();
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  const groups = FLAG_GROUPS.map((g) => ({ ...g, items: g.items.filter(([, l]) => !needle || l.toLowerCase().includes(needle) || g.title.toLowerCase().includes(needle)) })).filter((g) => g.items.length);
  return (
    <div className="factors">
      <label htmlFor="sf-search" className="field-label">Anything about it? <span className="muted small">(tap all that apply)</span></label>
      <input id="sf-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: screen, battery, box…" autoComplete="off" />
      {value.length > 0 && <p className="muted small" aria-live="polite">{value.length} chosen</p>}
      {groups.length === 0 && <p className="muted small">Nothing matches “{q}”. You can type it in the box below instead.</p>}
      {groups.map((g) => <fieldset key={g.title} className="chip-group"><legend>{g.title}</legend><div className="chips">{g.items.map(([k, l]) => <button type="button" key={k} className={`chip ${value.includes(k) ? 'on' : ''}`} aria-pressed={value.includes(k)} onClick={() => toggle(k)}>{l}</button>)}</div></fieldset>)}
    </div>
  );
}
