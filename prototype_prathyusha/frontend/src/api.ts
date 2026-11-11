import type { ListingResponse, NeedsSheet, Overrides, Opinions, AdviceResponse, FreeClaim, TrustResponse, ResearchStatus, ClaimResponse, CompareResponse, FitResponse, LaptopListItem, Meta, Methodology, Profile, ReviewEvidence, SearchResponse } from './types'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId?: string) { super(message) }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try { res = await fetch(`/api/v1${path}`, init) } catch { throw new ApiError(0, 'network', 'Cannot reach the LapFit server. Is the backend running?') }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const e = body?.error
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? `Request failed (${res.status})`, e?.request_id)
  }
  return body as T
}

export const api = {
  laptops: () => req<{ items: LaptopListItem[] } & Meta>('/laptops'),
  search: (q: string) => req<SearchResponse>(`/search?q=${encodeURIComponent(q)}`),
  fit: (variant_id: string, profile: Profile) =>
    req<FitResponse>('/fit-analysis', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ variant_id, profile }) }),
  compare: (variant_ids: string[], profile: Profile) =>
    req<CompareResponse>('/compare', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ variant_ids, profile }) }),
  researchStart: (query: string) => req<{ job_id: string; reused: boolean } & Meta>('/research', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }) }),
  researchStatus: (id: string) => req<ResearchStatus>(`/research/${encodeURIComponent(id)}`),
  claim: (variant_id: string, claim_text: string) =>
    req<ClaimResponse>('/claim-checks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ variant_id, claim_text }) }),
  review: (id: string) => req<ReviewEvidence>(`/evidence/review/${encodeURIComponent(id)}`),
  advice: (text: string, overrides?: Overrides) => req<AdviceResponse>('/advice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, overrides }) }),
  needs: (text: string, overrides?: Overrides) => req<NeedsSheet>('/needs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, overrides }) }),
  listing: (text: string) => req<ListingResponse>('/listing-check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) }),
  claimFree: (claim_text: string) => req<FreeClaim>('/claim-checks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claim_text }) }),
  ratings: (id: string) => req<{ variant_id: string; categories: import('./types').Category[] } & Meta>(`/laptops/${encodeURIComponent(id)}/ratings`),
  opinions: (id: string, topic: string) => req<Opinions>(`/laptops/${encodeURIComponent(id)}/opinions?topic=${encodeURIComponent(topic)}`),
  trust: () => req<TrustResponse>('/trust'),
  methodology: () => req<Methodology & Meta>('/methodology'),
}
