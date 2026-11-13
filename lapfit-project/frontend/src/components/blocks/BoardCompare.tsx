import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Block } from '../../lib/types';
import { ScaleScreens } from '../viz/ScaleScreens';
import { BottomSheet } from '../BottomSheet';
import { LaptopImage } from '../LaptopImage';
import { MultiRadar } from '../viz/MultiRadar';
import { useCtx } from '../ctx';
import { getSession, setSession } from '../../lib/storage';
import { AddMyLaptop } from './CustomLaptopForm';
import type { CustomLaptop } from './BoardLogic';

/** The number inside a display string like "₹46,999 (as of …)", "8 GB", "1 TB" or "1.65 kg", only to size a radar. The text shown is the backend's. */
const numIn = (s: string): number | null => { const m = s.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(tb|gb|kg|wh|inch|in|year|years)?/i); if (!m) return null; let n = parseFloat(m[1]); if (/tb/i.test(m[2] ?? '')) n *= 1024; return n; };
const RADAR_ROWS: [string, string, boolean][] = [['Price', 'Lower price', false], ['RAM', 'RAM', true], ['Storage', 'Storage', true], ['Weight', 'Lightness', false], ['Screen', 'Screen', true], ['Battery', 'Battery', true]];
const COLORS = ['#6b46ff', '#ff5d8f', '#00b8a3', '#ffb84d'];
const MATTERS: Record<string, string> = { Price: 'price', Weight: 'weight', RAM: 'memory', Storage: 'storage', Battery: 'battery life' };
const short = (n: string) => n.split(' · ')[0];

type Lap = { variant_id: string; name: string; data_status: string; image?: any; custom?: boolean };
const CUSTOMS = 'lapfit.customs';
/** The custom laptops typed this session (on this device only), so adding a second one keeps the first. */
export const rememberCustom = (l: CustomLaptop) => setSession(CUSTOMS, [...getSession<CustomLaptop[]>(CUSTOMS, []).filter((x) => x.name !== l.name), l].slice(-4));
const showName = (l: Lap) => (l.custom ? short(l.name).replace(/\s*\(yours.*$/i, '') : short(l.name));
type Row = { label: string; values: string[]; best: number | null; better: string | null };

/** "Pick A if weight matters, B if price matters." Built only from the backend's own best-per-row marks. */
export function pickLine(L: Lap[], rows: Row[]): string {
  const by = new Map<number, string[]>();
  for (const r of rows) if (r.best != null && L[r.best] && MATTERS[r.label]) by.set(r.best, [...(by.get(r.best) ?? []), MATTERS[r.label]]);
  const parts = [...by.entries()].slice(0, 3).map(([i, w]) => `${short(L[i].name).split(' ').slice(0, 2).join(' ')} if ${w.join(' or ')} matters`);
  return parts.length ? `Pick ${parts.join(', ')}.` : 'No clear winner on the numbers we have.';
}

/** Compare: opens as a sheet (3 columns on screen, the first column stays put), with "Hide same" and the shapes tucked behind a button. */
export function CompareBlock({ b }: { b: Block }) {
  const ctx = useCtx();
  const L = b.laptops as Lap[]; const rows = b.rows as Row[]; const ev = b.evidence as { variant_id: string; n: number; positive: number; enough: boolean; min_n?: number }[];
  const [open, setOpen] = useState(true); const [same, setSame] = useState(false); const [shapes, setShapes] = useState(false);
  const axes = RADAR_ROWS.map(([row, label, higher]) => ({ label, higher, nums: (rows.find((r) => r.label === row)?.values ?? []).map(numIn) })).filter((a) => a.nums.length === L.length && a.nums.some((n) => n != null));
  const items = L.map((l, i) => ({ name: short(l.name), color: COLORS[i % COLORS.length], values: axes.map((a) => { const n = a.nums[i]; return n == null ? null : a.higher ? n : -n; }) }));
  const isSame = (r: Row) => r.values.every((v) => v.trim().toLowerCase() === r.values[0].trim().toLowerCase());
  const mine = L.filter((l) => l.custom); const real = L.filter((l) => !l.custom).map((l) => l.variant_id);
  const addMine = (l: CustomLaptop) => {
    rememberCustom(l); const keep = getSession<CustomLaptop[]>(CUSTOMS, []).filter((c) => c.name !== l.name && mine.some((m) => showName(m).startsWith(c.name)));
    setOpen(false); ctx.action({ action: 'compare', variant_ids: real, custom: [...keep, l].slice(-2) }, `Compare with my ${l.name}`);
  };
  const addBlock = L.length >= 3 ? 'Three columns is the most. Remove one first.' : mine.length >= 2 ? 'Two of your own laptops is the most.' : null;
  const visible = same ? rows.filter((r) => !isSame(r)) : rows; const line = pickLine(L, rows);
  return (
    <section className="compare board-compare" aria-label="Comparison">
      <h3>Side by side</h3>
      <p className="b-pickline">{line}</p>
      <p className="b-compare-names muted small">{L.map(showName).join(' · ')}</p>
      <button className="btn soft small" onClick={() => setOpen(true)}>Open comparison</button>
      {open && createPortal(
        <BottomSheet open title={`Compare ${L.length} laptops`} onClose={() => setOpen(false)}>
          <div className="cmp">
            <p className="b-pickline">{line}</p>
            <ScaleScreens items={L.map((l) => ({ name: showName(l), screen: (l as any).screen_in != null ? Number((l as any).screen_in) : null }))} />
            <div className="cmp-tools">
              <label className="cmp-switch"><input type="checkbox" checked={same} onChange={(e) => setSame(e.target.checked)} /><span>Hide same</span></label>
              {axes.length >= 3 && <button className="link cmp-shapes" aria-expanded={shapes} onClick={() => setShapes((v) => !v)}>Shapes</button>}
            </div>
            {shapes && axes.length >= 3 && <div className="cmp-radar"><MultiRadar axes={axes.map((a) => a.label)} items={items} /><p className="muted small">The shapes compare these laptops with each other, using recorded values.</p></div>}
            <div className="cmp-scroll" tabIndex={0} role="region" aria-label="Comparison table, scrolls sideways">
              <table className="cmp-table" style={{ ['--cols' as any]: L.length }}>
                <thead><tr><th scope="col" className="cmp-corner"><span className="sr-only">Attribute</span></th>
                  {L.map((l) => <th scope="col" key={l.variant_id} className="tug-head">{l.custom ? <div className="cmp-own" aria-hidden="true">💻</div> : <LaptopImage pic={l.image} brand={l.name.split(' ')[0]} name={short(l.name)} caption={false} />}<strong>{showName(l)}</strong>{l.custom && <small className="cmp-own-tag">(yours, as you entered)</small>}</th>)}</tr></thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.label}><th scope="row">{r.label}</th>{r.values.map((v, i) => <td key={i} className={r.best === i ? 'best' : ''}>{v}{r.best === i && <span className="best-tag"> ✓ best</span>}</td>)}</tr>
                  ))}
                  <tr><th scope="row">Owner opinions</th>{L.map((l, i) => { const e = ev.find((x) => x.variant_id === l.variant_id) ?? (l.custom ? undefined : ev[i]); return <td key={l.variant_id ?? i}>{l.custom || !e ? 'no opinions for your own laptop' : e.enough ? `${e.positive} of ${e.n} positive` : `Only ${e.n} so far (need ${e.min_n ?? 20})`}</td>; })}</tr>
                </tbody>
              </table>
            </div>
            {same && visible.length < rows.length && <p className="muted small">{rows.length - visible.length} row{rows.length - visible.length === 1 ? ' is' : 's are'} the same for all and hidden.</p>}
            <AddMyLaptop onAdd={addMine} disabledWhy={addBlock} />
            <p className="muted small">{String(b.note)}</p>
            <p className="muted small">{L.filter((l) => !l.custom).map((l) => l.data_status).filter((v, i, a) => a.indexOf(v) === i).join('. ')}. Owner opinions are machine-read, not human-verified.</p>
          </div>
        </BottomSheet>, document.body)}
    </section>
  );
}
