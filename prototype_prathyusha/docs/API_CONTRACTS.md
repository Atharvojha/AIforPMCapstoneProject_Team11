# API_CONTRACTS — v1 (Stage 3 proposal)

Conventions: base `/api/v1`; JSON; every response includes `request_id`, `data_version`, `generated_at`; errors use one envelope; list endpoints paginate (`limit`, `cursor`); LLM-derived fields carry `model`, `prompt_version`; any evidence object carries `id`, `source`, `variant_match`, `validation_status`.

**Error envelope** `{ "error": { "code": "not_found|validation_error|upstream_unavailable|budget_exhausted|policy_blocked|internal", "message": "...", "request_id": "...", "details": {} } }`

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/health`, `/ready` | liveness; readiness (db, llm, embeddings, search key present) |
| GET | `/search?q=` | **universal search**: classify intent (laptop / claim / out-of-scope), return catalogue matches, `research_offer`, or scope message |
| GET | `/laptops`, `/laptops/{variant_id}` | catalogue; variant identity + spec facts (with sources) + evidence summary |
| POST | `/profiles/parse` | free-text note → structured profile card (LLM, schema-validated) |
| POST | `/profiles` | save profile (optional; default client-side) |
| POST | `/fit-analysis` | one laptop × profile → gate, ratings, coverage, dealbreakers, watch-outs, disagreements, gaps, summary |
| POST | `/compare` | 2–4 variants × profile → aligned rows, differences, coverage |
| POST | `/claim-checks` | create claim check (sync for catalogue laptops, job for live) |
| GET | `/claim-checks/{id}` | result with sub-claims, lanes, conditions, verdicts |
| POST | `/research` | start live research for a laptop (query → job id) |
| GET | `/research/{id}` | job status + per-step results; supports `?stream=1` (SSE) |
| GET | `/evidence/{id}` | evidence detail (quote, offsets, source, conditions) |
| GET | `/sources/{id}` | source metadata, permission, freshness |
| GET | `/laptops/{id}/excluded?profile_hash=` | set-aside reviews with reasons |
| POST | `/feedback` | correction → eval candidate queue |
| GET | `/methodology` | rules, weights, thresholds, versions, source register (powers How it works / Trust) |
| admin (local token) | `/admin/ingest`, `/admin/reindex`, `/admin/eval/run`, `/admin/eval/{run}` | ingestion, embeddings, evaluation |

## Key schemas (abridged examples)
**GET /search** → `{ "intent":"laptop|claim|out_of_scope|ambiguous", "matches":[{variant_id,display_name,variant_confidence,catalogue_set,coverage}], "research_offer":{ "available":true,"reason":"not in catalogue","estimated_credits":3 } | null, "message": "..." }`

**POST /fit-analysis** request `{ variant_id, profile:{workloads[],conditions{},hard_requirements{ram_gb_min,budget_inr_max,weight_kg_max,battery_h_min},priorities[],weights{} } }` → response
```json
{ "variant": {...,"variant_confidence":"exact_listing"},
  "gate":[{"requirement":"ram_gb>=16","laptop_value":8,"status":"spec_mismatch","source_id":"..."}],
  "dealbreakers":[{"category":"battery","basis":"reviews","distinct_reports":3,"evidence_ids":["ec_.."],"rule":"≥2 independent clear applicable"}],
  "watchouts":[...], "disagreements":[{"category":"battery","side_a":[...],"side_b":[...],"explained_by":"usage|config|duration|null"}],
  "fit_by_use":[{"workload":"programming","label":"weak","driven_by":["memory"]}],
  "ratings":[{"category":"memory","label":"weak","coverage":1.0,"inputs":{"spec":1,"lab":0,"owner":0},"score":null,"score_visible":false,"computed_from":"spec"}],
  "coverage":0.30, "gaps":["battery_under_coding"],
  "summary":{"text":"...","evidence_ids":["..."],"drafted_by":"model@prompt_version"},
  "set_aside":{"count":4,"by_reason":{"different_variant":2,"duplicate":2}},
  "status":"complete|partial|fallback_raw_evidence", "warnings":[] }
```
**POST /claim-checks** `{ variant_id | research_query, claim_text, context?:{workload,brightness_nits}, source_url?, allow_live_research?:bool }` → `{ id, status, claim_type, subclaims:[{text,type,verdict,conditions_table,lanes:{for[],against[],not_applicable[]},doesnt_prove,would_change}], verdict, confidence_text, coverage, counter_evidence:{ran:true,found:1}, checklist[], provenance:{corpus_version,live_sources:[...],live_performed:bool} }`
**POST /research** `{ query, max_credits?:int }` → `{ job_id }`; job steps `[{name:"identify|search|policy|extract|build", status, detail, counts}]`; final `{ variant_id, fetched:n, link_only:n, rejected:[{url,reason}], credits_used }`.

## Behaviour contracts
- Search-key missing → `/research` returns `upstream_unavailable` with message; catalogue endpoints unaffected.
- Policy-blocked URL → listed under `link_only` or `rejected` with reason; never silently dropped.
- Quote validation failure on any evidence → evidence omitted + `warnings` entry; if the summary depends on it, status becomes `partial`.
- Idempotency: `POST /research` for the same normalised query within 24 h returns the cached job unless `force=true` (budget-guarded).
- Rate limits: 30 req/min/IP general; 6/min on `/research`, `/claim-checks`, `/profiles/parse`.

## Added 2026-11-11 (pivot)
| Method | Path | Body → response |
|---|---|---|
| POST | `/advice` | `{text}` → `{needs{uses,priorities,budget,hard,brands_like,brands_avoid,understood[]}, recommended[{key,label,text,why,you_asked}], laptops[ranked: id,name,brand,price_inr,verdict,tone,score,coverage,checks[{label,need,have,status,hard}],categories[10×{topic,label,rating,tone,happy_pct,n,weight}]], profile, reading{reviews_read,reviews_left,complete}}` |
| POST | `/claim-checks` | `{claim_text, variant_id?}`. With `variant_id` → per-laptop result as before. Without → `{mode: laptop|brand|line|generic|numeric|unsupported, verdict|null, headline, groups[], models[], best[], worst[], suggestions[], examples{happy,unhappy}, brands[], limits[]}` |

| GET | `/laptops/{id}/ratings` | `{categories[10×{topic,label,rating,tone,happy_pct,n,lb,happy,unhappy}]}` |
| GET | `/laptops/{id}/opinions?topic=` | `{counts{positive,negative,mixed}, examples{positive[],negative[],mixed[]}}` each `{review_id, quote}` |
`/claim-checks` modes now: `laptop`, `brand`, `line` (model line or spec group), `generic`, `numeric`, `compare` (with `compare_ids`), `unsupported`; optional `word_hits{word, reviews, examples[]}`.

## Added 2026-11-11
| POST | `/advice` | now also accepts `overrides:{uses?,importance?{topic:0-3},hard?{budget_inr_max,ram_gb_min,storage_gb_min,weight_kg_max,battery_h_min: number\|null},brands_avoid?[],needs_gpu?}`; recommended[] items now include `kind` ("rule of thumb" or "checked against vendor pages") and `sources[{label,url}]` |
| POST | `/needs` | same body as `/advice` → `{needs, categories[12×{key,label,means,level,level_name,why,owner_rated,number?{spec,text,minimum,ideal,yours,why,kind,sources,scale{steps,unit,label,lower_is_better}}}], recommended[], budget_inr_max, uses[{key,label,on}], brands[{key,label,avoid}], note}` |
| POST | `/listing-check` | `{text}` (≤6000 chars) → `{title, claims[{id,text,kind: battery\|spec\|fit\|experience\|marketing, verdict: supported\|contradicted\|mixed\|insufficient, headline, details[], source, source_label, quotes[{review_id,quote,side}], links[], ask}], summary{text,counts}, questions[], ignored_instructions, ai{by:"language model"\|"rules",model,seconds,note}, lookup{query,why,available}\|null, matched{id,name,market}\|null, evidence_note, limits[]}` |
