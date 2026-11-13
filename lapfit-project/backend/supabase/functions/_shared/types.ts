import type { Tools } from './tools.ts';
import type { ModelClient } from './model.ts';
import type { LiveSource } from './live.ts';

/** A row of the variant_specs view as returned by the tools. */
export interface Row {
  variant_id: string; model_id: number; brand: string; marketing_name: string; display_name: string;
  catalogue_set: string; market: string; recommendable: boolean; availability: string; review_count: number;
  ram_gb: number | null; storage_gb: number | null; display_size: number | null; weight_kg: number | null;
  price_inr: number | null; price_as_of: string | null; cpu_text: string | null; gpu_text: string | null;
  battery_wh: number | null; refresh_hz: number | null; hinge_type: string | null; warranty_years: number | null;
  colours: string[]; cpu_vendor: string | null; cpu_family: string | null; cpu_generation_or_model: string | null;
  win11_status: string | null; memory_slots: string | null; os_family: string; gpu_class: string | null; image_url?: string | null; image_site?: string | null; image_page?: string | null; image_desc?: string | null; curation_verified: boolean; verified: boolean; is_sample: boolean;
}
export interface RawCriterion { attribute: string; operator?: string; value: unknown; source_text?: string | null }
export interface Needs {
  budget_max_inr: number | null; budget_min_inr: number | null;
  musts: RawCriterion[]; shoulds: RawCriterion[]; nices: RawCriterion[]; use_cases: string[];
}
export interface Settings { [k: string]: any; _version?: number }
export interface Deps { degraded?: string; tools: Tools; model: ModelClient | null; live?: LiveSource | null; settings: Settings; requestId: string; now?: () => Date; }
export type Block = { type: string; [k: string]: any };
export interface Reply {
  ok: true; request_id: string; flow: string | null; language: string; router_mode: string | null;
  notice: string; footer: string; data_mode: string; blocks: Block[]; ignored_instructions: string[];
  settings_version: number; data_version: string | null; router_error?: string; timings?: Record<string, number>;
}
