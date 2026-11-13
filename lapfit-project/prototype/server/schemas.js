import { z } from 'zod';

const scalar = z.union([z.string(), z.number()]);
const criterion = z.object({
  attribute: z.string(),
  operator: z.string().default('='),
  value: z.union([scalar, z.array(scalar)]),
  source_text: z.string().nullish().transform((v) => v ?? ''),
});

export const FLOWS = ['second_opinion', 'check_pitch', 'shortlist', 'used_check', 'buy_for_others', 'clarify', 'out_of_scope_laptop', 'not_laptop', 'owner_voice', 'trending', 'sell_laptop'];

export const RouterSchema = z.object({
  flow: z.enum(FLOWS),
  confidence: z.number().min(0).max(1),
  language: z.string().nullish().transform((v) => v || 'English'),
  needs: z.object({
    budget_max_inr: z.number().nullish().transform((v) => v ?? null),
    budget_min_inr: z.number().nullish().transform((v) => v ?? null),
    musts: z.array(criterion).nullish().transform((v) => v ?? []),
    shoulds: z.array(criterion).nullish().transform((v) => v ?? []),
    nices: z.array(criterion).nullish().transform((v) => v ?? []),
    use_cases: z.array(z.string()).nullish().transform((v) => v ?? []),
  }).nullish().transform((v) => v ?? { budget_max_inr: null, budget_min_inr: null, musts: [], shoulds: [], nices: [], use_cases: [] }),
  laptop_mentions: z.array(z.object({
    brand: z.string().nullish(), line: z.string().nullish(),
    ram_gb: z.number().nullish(), storage_gb: z.number().nullish(), price_inr: z.number().nullish(),
    source_text: z.string().nullish(),
  })).nullish().transform((v) => v ?? []),
  claims: z.array(z.object({
    claim_text: z.string(),
    type: z.enum(['spec', 'performance', 'price', 'service', 'comparative', 'absolute', 'opinion']),
    scope: z.string().nullish().transform((v) => v ?? ''),
  })).nullish().transform((v) => v ?? []),
  ignored_instructions: z.array(z.string()).nullish().transform((v) => v ?? []),
  clarifying_question: z.string().nullish().transform((v) => v ?? null),
  choices: z.array(z.string()).nullish().transform((v) => v ?? []),
  // Optional extras that help two flows. Never required.
  recipient: z.enum(['parent', 'child', 'team', 'other']).nullish(),
  tone: z.enum(['normal', 'distressed', 'abusive', 'manipulative']).nullish(),
  followup_flow: z.enum(['second_opinion', 'check_pitch', 'shortlist', 'used_check', 'buy_for_others', 'owner_voice', 'trending', 'sell_laptop']).nullish(),
  seller_info: z.object({
    age_months: z.number().nullish(), body_condition: z.string().nullish(), screen_condition: z.string().nullish(),
    battery_health_pct: z.number().nullish(), keyboard_ok: z.boolean().nullish(), has_bill: z.boolean().nullish(), has_box: z.boolean().nullish(),
    warranty_months_left: z.number().nullish(), os_state: z.string().nullish(), reason_for_selling: z.string().nullish(), urgency: z.string().nullish(),
  }).nullish(),
  owner_filters: z.object({
    persona: z.string().nullish(), topic: z.string().nullish(), laptop: z.string().nullish(),
    min_months: z.number().nullish(), days: z.number().nullish(),
  }).nullish(),
});

export const ReasonsSchema = z.object({
  cards: z.array(z.object({ id: z.string(), reasons: z.array(z.string()).min(1).max(3) })),
});
