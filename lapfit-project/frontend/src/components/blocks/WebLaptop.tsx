import type { Block } from '../../lib/types';
import { useCtx } from '../ctx';
import { WebPanel } from './Evidence';
import { storage, type CustomLaptop } from './BoardLogic';
import { rememberCustom } from './BoardCompare';

const FIELDS: { key: string; label: string; show: (v: any) => string }[] = [
  { key: 'price_inr', label: 'Price', show: (v) => `₹${Math.round(v).toLocaleString('en-IN')}` },
  { key: 'ram_gb', label: 'RAM', show: (v) => `${v} GB` }, { key: 'storage_gb', label: 'Storage', show: (v) => storage(v) },
  { key: 'display_size', label: 'Screen', show: (v) => `${v}″` }, { key: 'weight_kg', label: 'Weight', show: (v) => `${v} kg` },
  { key: 'battery_wh', label: 'Battery', show: (v) => `${v} Wh` }, { key: 'cpu', label: 'Processor', show: (v) => String(v) }, { key: 'launch_year', label: 'Launched', show: (v) => String(v) },
];
const STATUS: Record<string, string> = {
  off: 'Web search is switched off, so I cannot look this laptop up.', limit: 'Web search is paused for today to stay within its budget, so I cannot look this laptop up now.',
  error: 'The web search did not work just now. Nothing is shown, and I will not guess.', empty: 'The web search found nothing I could read about this laptop. Nothing is shown, and I will not guess.',
};

/** A laptop that is not in the catalog. Whatever specs a model read from web pages are labelled "from the web, not verified"; absent fields are not shown at all. */
export function WebLaptop({ b }: { b: Block }) {
  const ctx = useCtx(); const status = String(b.status); const f = (b.fields ?? {}) as Record<string, unknown>; const present = FIELDS.filter((x) => f[x.key] != null && f[x.key] !== '');
  const items = (b.items ?? []) as unknown[]; const picked = ctx.compare.ids.slice(0, 2);
  const compare = () => {
    const c: CustomLaptop = { name: String(b.query).slice(0, 80) };
    for (const k of ['price_inr', 'ram_gb', 'storage_gb', 'display_size', 'weight_kg', 'battery_wh'] as const) if (typeof f[k] === 'number') c[k] = f[k] as number;
    if (typeof f.cpu === 'string') c.cpu = f.cpu.slice(0, 60);
    rememberCustom(c); ctx.action({ action: 'compare', variant_ids: picked, custom: [c] }, `Compare with ${c.name}`);
  };
  return (
    <section className="web-laptop" aria-label="Laptop not in the catalog">
      <h3>This laptop is not in my catalog. Here is what the web says</h3>
      <p className="muted small">You asked about “{String(b.query)}”.{b.note ? ` ${b.note}` : ''}</p>
      {STATUS[status] && items.length === 0 && present.length === 0 && <p className="wl-status" role="status">{STATUS[status]}</p>}
      {present.length > 0 && (
        <div className="wl-fields">
          <dl className="wl-list">{present.map((x) => <div key={x.key}><dt>{x.label}</dt><dd>{x.show(f[x.key])}<span className="wl-mark">from the web, not verified</span></dd></div>)}</dl>
          <p className="muted small">{String(b.fields_note ?? 'Read from the web pages below by an AI model and checked against their text. Not verified, may be wrong.')} Anything not listed was not found, so it stays “?”.</p>
        </div>
      )}
      <WebPanel web={{ status, note: status === 'ok' || status === 'cached' ? 'Pages found for this laptop. Open them to check.' : '', items }} title="What the web says" />
      {b.can_compare === true && present.length > 0 && (
        <div className="wl-actions">
          <button type="button" className="btn small" disabled={ctx.busy || picked.length === 0} onClick={compare}>Compare with it</button>
          <span className="muted small">{picked.length === 0 ? 'Pick a catalog laptop with “+ Compare” first.' : 'Uses the specs above as you see them, marked as yours.'}</span>
        </div>
      )}
    </section>
  );
}
