export type ReqStatus = 'met' | 'not_met' | 'unknown' | 'spec_mismatch'
export type Label = 'strong' | 'good_with_tradeoffs' | 'weak' | 'not_enough_evidence'
export type Profile = {
  workloads: Record<string, string>
  hard_requirements: Record<string, number>
  priorities: string[]
  weights?: Record<string, number> | null
}
export type Meta = { request_id: string; data_version: string; generated_at: string }
export type LaptopListItem = {
  id: string; display_name: string; catalogue_set: string; review_count: number; specs: Record<string, string>
  lab_records: number; owner_analysis: 'complete' | 'partial' | 'not_run' | 'not_available'; variant_confidence: string
}
export type SearchMatch = { variant_id: string; display_name: string; catalogue_set: string; review_count: number; variant_confidence: string }
export type SearchResponse = {
  query: string; intent: 'laptop' | 'ambiguous' | 'claim' | 'out_of_scope'; matches: SearchMatch[]; message: string | null
  research_offer: { available: boolean; reason: string; unavailable_reason: string | null } | null
} & Meta
export type EvidenceItem = { claim_id: number; review_id: string; quote: string; quote_start: number; quote_end: number; rating: number | null; polarity: string; strength: string; duplicates: number }
export type GateRow = { requirement: string; label: string; have: string; laptop_value: number | null; status: ReqStatus; note: string; source_id: string | null; variant_match: string | null }
export type Finding = { category: string; basis: string; distinct_reports: number; review_ids: string[]; rule: string; evidence: EvidenceItem[] }
export type CatRating = { provisional?: boolean; label: Label; score: number | null; basis: string | null; n: number; weight: number; detail?: string; evidence: { spec: number; lab_exact: number; lab_sibling: number; owner: number } }
export type Bench = {
  id: string; category: string; test_name: string; value_text: string; unit: string; conditions: string; methodology: string; variant_match: string
  validation_status: string; source_url: string; published_at: string | null
}
export type FitResponse = {
  variant: { id: string; display_name: string; listing_title: string; catalogue_set: string; variant_confidence: string; review_count: number }
  profile_echo: { workloads: Record<string, string>; hard_requirements: Record<string, number>; priorities: string[]; weights: Record<string, number> }
  gate: GateRow[]; dealbreakers: Finding[]; watchouts: Finding[]
  disagreements: { category: string; side_positive: EvidenceItem[]; side_negative: EvidenceItem[] }[]
  fit_by_use: { provisional?: boolean; workload: string; label: Label; coverage: number; driven_by_weak: string[] }[]
  ratings: { categories: Record<string, CatRating>; coverage: number; score: number | null; score_visible: boolean; provisional?: boolean }
  gaps: { category: string; label?: string; reason: string }[]
  owner_analysis: { state: 'complete' | 'partial' | 'not_run' | 'not_available'; representatives: number; processed: number; by_status: Record<string, number> }
  independent_tests_and_specs: { lanes: { lab_exact: Bench[]; manufacturer_claims: Bench[]; lab_sibling: Bench[] }; curated_spec_facts: { attribute: string; value_text: string; unit: string | null; source_id: string; variant_match: string; validation_status: string; quote?: string | null; source: { url?: string; publisher?: string; source_class?: string; attribution_text?: string; retrieved_at?: string } | null }[] }
  set_aside: { total_reviews: number; by_reason: Record<string, number> }
  summary: { lines: { text: string; basis: string; review_ids?: string[] }[]; drafted_by: string }
  versions: Record<string, unknown>; status: 'complete' | 'partial'; warnings: string[]
} & Meta
export type ReviewEvidence = {
  review: { id: string; variant_id: string; rating: number | null; title: string | null; original_text: string; word_count: number; flag: string | null; config_mismatch_hint: string | null }
  source: { id: string; url: string; publisher: string; source_class: string; licence_status: string } | null
  claims: { id: number; category: string; claim_text: string; polarity: string; strength: string; quote: string; quote_start: number; quote_end: number; quote_valid: boolean }[]
  duplicates: number
}
export type Methodology = { categories: string[]; workload_weights: Record<string, Record<string, number>>; thresholds: Record<string, unknown>; rules: string[]; versions: Record<string, string> }

export type Verdict = 'supported' | 'contradicted' | 'mixed' | 'insufficient'
export type LaneItem = { kind: 'spec' | 'lab' | 'owner' | 'claim'; text: string; source: { id: string; url?: string; publisher?: string; source_class?: string } | null; variant_match?: string; validation?: string; url?: string; review_id?: string; published?: string | null }
export type SubClaim = { text: string; type: string; verdict: Verdict; key?: string; note?: string | null; reason?: string | null; doesnt_prove?: string | null
  lanes: { for: LaneItem[]; against: LaneItem[]; not_applicable: LaneItem[] }; counter: { ran: boolean; found: number } }
export type ClaimResponse = {
  id: string; variant: { id: string; display_name: string }; claim_text: string; claim_understood_as: string; claim_type: string; supported: boolean; verdict: Verdict | null
  subclaims: SubClaim[]; clarifier?: string | null; message?: string; instruction_ignored: boolean; counter_evidence: { ran: boolean; found: number }; what_we_could_check?: string
  provenance: { live_search_performed: boolean; corpus?: string }
} & Meta

export type CompareResponse = {
  laptops: { id: string; display_name: string; review_count: number; owner_analysis: { state: string; processed: number; representatives: number }; knowledge: number; provisional: boolean }[]
  must_haves: { requirement: string; label: string; cells: Record<string, { status: ReqStatus; have: string }> }[]
  problems: Record<string, { serious: { category: string; owners: number }[]; check: { category: string; owners: number }[] }>
  fit_by_use: { workload: string; cells: Record<string, { label: Label; provisional?: boolean } | null> }[]
  areas: { category: string; differs: boolean; cells: Record<string, { label: Label; basis: string | null; provisional: boolean }> }[]
  specs: { attribute: string; label: string; unit: string; values: Record<string, { display: string; similar_model: boolean } | null> }[]
  differences: { laptop_id: string; versus: string; lines: string[] }[]
  notes: string[]
} & Meta

export type ResearchStatus = {
  job_id: string; query: string; status: 'queued' | 'running' | 'done' | 'failed'; variant_id: string | null
  steps: { name: string; status: string; detail: string }[]
  counts: { fetched: number; link_only: number; rejected: number; failed: number; facts: number } | null
  error: string | null; credits_used: number
  links: { url: string; title: string; decision: 'fetched' | 'link_only' | 'blocked' | 'rejected' | 'failed'; tier: string; reason: string }[]
} & Meta

export type TrustResponse = { updated: string; note: string; limits: string[]
  items: { id: string; title: string; question: string; first: string; first_note: string; held_out: boolean; meaning: string; now: string | null }[]
  data: { laptops_in_catalogue: number; us_laptops_as_evidence?: number; laptops_looked_up_online: number; owner_reviews: number; laptops_with_owner_reviews_fully_read: number; lab_or_maker_records: number; source_classes: Record<string, number> } } & Meta

export type Category = { topic: string; label: string; rating: string; tone: 'ok' | 'mix' | 'bad' | 'unk'; happy_pct: number | null; n: number; weight: number; lb: number | null; happy: number; unhappy: number }
export type Opinions = { variant_id: string; topic: string; counts: { positive: number; negative: number; mixed: number }; examples: { positive: { review_id: string; quote: string }[]; negative: { review_id: string; quote: string }[]; mixed: { review_id: string; quote: string }[] } }
export type Check = { label: string; need: string; have: string; status: 'ok' | 'miss' | 'unknown'; hard: boolean }
export type AdviceLaptop = { id: string; name: string; brand: string; price_inr: number | null; reviews: number; categories: Category[]; checks: Check[]; misses: number; soft_misses: number
  score: number | null; coverage: number; warnings: string[]; why: string[]; specs: { label: string; value: string }[]; verdict: string; tone: 'ok' | 'mix' | 'bad' }
export type AdviceResponse = { needs: { uses: string[]; priorities: string[]; understood: string[]; hard: Record<string, number> }
  recommended: { key: string; label: string; text: string; why: string; you_asked: number | null; kind: string; sources: { label: string; url: string }[] }[]; laptops: AdviceLaptop[]; profile: Profile
  reading: { reviews_read: number; reviews_left: number; complete: boolean }; note: string } & Meta
export type Group = { label: string; avg_models?: number; n?: number; happy_pct?: number | null; happy?: number; unhappy?: number; mixed?: number; models?: number; value?: string }
export type ModelRow = { id: string; name: string; brand: string; n: number; happy_pct: number | null; unhappy: number; in_scope: boolean; price_inr: number | null; price_usd?: number | null; market?: 'IN' | 'US' }
export type FreeClaim = { mode: 'laptop' | 'brand' | 'line' | 'generic' | 'numeric' | 'unsupported' | 'compare'; compare_ids?: string[]; claim: string; verdict: Verdict | null; headline: string; topic_label?: string; stance?: string
  groups?: Group[]; models?: ModelRow[]; best?: ModelRow[]; worst?: ModelRow[]; brands?: Group[]; limits?: string[]; scope?: string; mode_note?: string
  examples?: { happy: { review_id: string; quote: string }[]; unhappy: { review_id: string; quote: string }[] }; suggestions_title?: string; suggestions?: ModelRow[]
  attribute?: string; word_hits?: { word: string; reviews: number; examples: { review_id: string; quote: string }[] }; numeric_models?: { id: string; name: string; value: string; in_scope: boolean }[]; laptop_id?: string; result?: ClaimResponse } & Meta

// ---- Listing check and needs sheet (D-053, D-054)
export type ListingClaim = {
  id: number; text: string; kind: 'battery' | 'spec' | 'fit' | 'experience' | 'marketing'; verdict: Verdict; headline: string; details: string[]
  source: string; source_label: string; quotes: { review_id: string; quote: string; side: 'happy' | 'unhappy' }[]; links: { label: string; url: string }[]; ask: string | null
}
export type ListingResponse = {
  title?: string; claims: ListingClaim[]; summary: { text: string; counts: Record<string, number> }; questions: string[]; ignored_instructions: boolean
  ai: { by: string; model: string | null; seconds: number; note: string | null }; lookup: { query: string; why: string; available?: boolean } | null
  matched: { id: string; name: string; market: string } | null; evidence_note?: string; limits?: string[]
}
export type Scale = { steps: number[]; unit: string; label: string; lower_is_better?: boolean }
export type SheetNumber = { spec: string; text: string; minimum: number; ideal: number; yours: number | null; why: string; kind: string; sources: { label: string; url: string }[]; scale: Scale | null }
export type SheetCategory = { key: string; label: string; means: string; level: number; level_name: string; why: string; owner_rated: boolean; number?: SheetNumber }
export type Overrides = { uses?: string[]; importance?: Record<string, number>; hard?: Record<string, number | null>; brands_avoid?: string[]; needs_gpu?: boolean }
export type NeedsSheet = {
  needs: { understood: string[]; cannot_check: string[]; hard: Record<string, number> }; categories: SheetCategory[]; budget_inr_max: number | null
  uses: { key: string; label: string; on: boolean }[]; brands: { key: string; label: string; avoid: boolean }[]; note: string
}
