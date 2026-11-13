// Builds the result item for one laptop. Every value comes from a stored row; nothing here is model output.
import { evalCriterion, actualText, HINGE_LABEL, type Criterion } from './normalise.ts';
import { fmtInr, fmtDate, fmtStorage } from './util.ts';
import type { Row } from './types.ts';

export interface EvidenceTotal { n: number; positive: number; negative: number }
export interface Card {
  variant_id: string; model_id: number; name: string; brand: string; price_inr: number; price_text: string; as_of: string; as_of_text: string;
  specs: Record<string, any>; spec_lines: string[]; data_status: string; unknown_fields: string[];
  musts: { label: string; ok: boolean | null; actual: string }[];
  evidence: { n: number; positive: number; negative: number; enough: boolean; text: string };
  fact_lines: string[]; reasons: string[];
  _gate?: { musts: Criterion[]; requireAll: boolean };
}

export function dataStatus(r: Row): string { return r.verified ? 'Verified' : r.is_sample ? 'Sample data' : 'Imported listing data, not human-verified'; }

export function specLines(r: Row): { lines: string[]; unknown: string[] } {
  const lines: string[] = []; const unknown: string[] = [];
  if (r.display_size != null || r.weight_kg != null) lines.push([r.display_size != null ? `${r.display_size} inch screen` : null, r.weight_kg != null ? `${r.weight_kg} kg` : null].filter(Boolean).join(', '));
  if (r.weight_kg == null) unknown.push('weight');
  if (r.ram_gb != null || r.storage_gb != null) lines.push([r.ram_gb != null ? `${r.ram_gb} GB RAM` : null, r.storage_gb != null ? `${fmtStorage(r.storage_gb)} storage` : null].filter(Boolean).join(', '));
  if (r.cpu_text) lines.push(`${r.cpu_text}${r.gpu_text ? ', ' + r.gpu_text : ', no separate graphics listed'}`);
  if (r.hinge_type) lines.push(HINGE_LABEL[r.hinge_type] + (r.curation_verified ? '' : ' (not yet verified)')); else unknown.push('hinge type');
  if (r.warranty_years != null) lines.push(`Warranty: ${r.warranty_years} year${r.warranty_years === 1 ? '' : 's'} (standard; keep the invoice)`); else unknown.push('warranty');
  if (r.battery_wh != null) lines.push(`Battery: ${r.battery_wh} Wh`);
  return { lines, unknown };
}

export function evidenceView(total: EvidenceTotal, minN: number) {
  const enough = total.n >= minN;
  return { n: total.n, positive: total.positive, negative: total.negative, enough,
    text: enough ? `${total.positive} of ${total.n} owner opinions are positive (machine-read, not human-verified).` : `Not enough owner evidence yet (n = ${total.n}; we need at least ${minN}).` };
}

export function buildCard(row: Row, o: { musts: Criterion[]; requireAll: boolean; evidence: EvidenceTotal; minN: number; factLines?: string[] }): Card {
  const { lines, unknown } = specLines(row);
  const supported = o.musts.filter((c) => c.supported);
  return {
    variant_id: row.variant_id, model_id: row.model_id, name: row.display_name, brand: row.brand,
    price_inr: row.price_inr as number, price_text: fmtInr(row.price_inr as number), as_of: row.price_as_of as string, as_of_text: fmtDate(row.price_as_of),
    specs: { ram_gb: row.ram_gb, storage_gb: row.storage_gb, display_size: row.display_size, weight_kg: row.weight_kg, cpu: row.cpu_text, gpu: row.gpu_text, hinge_type: row.hinge_type, warranty_years: row.warranty_years, colours: row.colours },
    spec_lines: lines, unknown_fields: unknown, data_status: dataStatus(row),
    musts: [...supported.map((c) => ({ label: c.label, ok: evalCriterion(c, row), actual: actualText(c, row) })), ...o.musts.filter((c) => !c.supported).map((c) => ({ label: c.label, ok: null, actual: 'Cannot be checked yet' }))],
    evidence: evidenceView(o.evidence, o.minN), fact_lines: o.factLines ?? [], reasons: [],
    _gate: { musts: supported, requireAll: o.requireAll },
  };
}
export const publicCard = (c: Card) => { const { _gate, ...rest } = c; return rest; };
