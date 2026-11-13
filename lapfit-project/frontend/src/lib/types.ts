// The reply shape of the LapFit `query` endpoint. Blocks are loose on purpose: the backend adds block types over time,
// and unknown types are shown as plain text instead of breaking the page.
export interface Block { type: string; [k: string]: any }
export interface Reply {
  ok: true; request_id: string; flow: string | null; language: string; router_mode: string | null; router_error?: string;
  notice: string; footer: string; data_mode: string; blocks: Block[]; ignored_instructions: string[]; timings?: Record<string, number>;
}
export interface RawCriterion { attribute: string; operator?: string; value: unknown; source_text?: string; label?: string; supported?: boolean }
export interface Needs { budget_max_inr: number | null; budget_min_inr: number | null; musts: RawCriterion[]; shoulds: RawCriterion[]; nices: RawCriterion[]; use_cases: string[] }
export interface CatalogRow { variant_id: string; model_id: number; name: string; brand: string; price_inr: number | null; ram_gb: number | null; storage_gb: number | null; recommendable: boolean }

export type ApiError =
  | { kind: 'rate_limited'; message: string; retryAfter: number }
  | { kind: 'too_large' | 'auth' | 'network' | 'timeout' | 'server' | 'bad_request'; message: string }
  | { kind: 'aborted'; message: string };
export type ApiResult = { ok: true; reply: Reply } | { ok: false; error: ApiError };
