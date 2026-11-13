// Every threshold lives here. Change a value here, nowhere else.
export const SETTINGS = {
  MIN_EVIDENCE_N: 20,            // below this many owner reports: "not enough evidence"
  MODEL_TIMEOUT_MS: 8000,        // router deadline; after this we show the rules-only form
  REASONS_TIMEOUT_MS: 8000,      // reasons deadline; after this we use code-written reasons
  ROUTER_CONFIDENCE_MIN: 0.6,    // below this the flow becomes "clarify"
  ROUTER_TEMPERATURE: 0,         // reading
  REASONS_TEMPERATURE: 0.2,      // writing reasons
  ROUTER_RETRIES: 1,             // one retry after a schema failure
  MAX_REASON_WORDS: 40,
  MAX_ALTERNATIVES: 2,
  MAX_SHORTLIST: 5,
  COMPARE_MIN: 2,
  COMPARE_MAX: 4,
  MAX_CLARIFY_QUESTIONS: 1,      // one question at a time
  MAX_BUY_FOR_OTHERS_QUESTIONS: 2,
  MAX_INPUT_CHARS: 4000,
  MAX_BODY_BYTES: 8 * 1024 * 1024,
  USED_PRICE_BAND: { low: 0.30, high: 0.75 }, // usual used price as a share of today's new price
  WEIGHT_TOLERANCE_KG: 0.05,
  OS_SUPPORT: {                  // used_check: simple, dated rules
    windows_10_ended: '2025-10-14',
    windows_11_min_model_year: 2018,
  },
  // Owner voice and trending (all computed in code, never by the model)
  TREND_WINDOW_DAYS: 30,
  TREND_MIN_REPORTS: 5,          // a rising complaint needs at least this many recent reports
  TREND_MIN_DROP_PCT: 3,         // smallest price fall worth listing
  TREND_LIST_SIZE: 5,
  NEGATIVE_RATING_MAX: 3.0,      // a report at or below this counts as a complaint
  WINDOW_CHOICES: [7, 30, 90],
  MONTHS_CHOICES: [3, 6, 12],
  // Owner submissions
  SUBMIT_MAX_CHARS: 300,
  SUBMIT_MIN_CHARS: 10,
  SUBMIT_PER_HOUR: 5,
  // Selling: SAMPLE ASSUMPTIONS, not real resale data. Replace with real used-price data when it exists.
  RESALE: {
    AGE_CURVE: [[6, 0.75], [12, 0.65], [24, 0.52], [36, 0.42], [48, 0.34], [9999, 0.27]], // share of today's new price by months owned
    AGE_UNKNOWN_MONTHS: 24,
    BODY: { like_new: 1, good: 0.95, scratched: 0.88, damaged: 0.72 }, BODY_UNKNOWN: 0.95,
    SCREEN: { perfect: 1, marks: 0.97, cracked: 0.70 }, SCREEN_UNKNOWN: 0.98,
    BATTERY: [[85, 1], [70, 0.96], [0, 0.90]], BATTERY_UNKNOWN: 0.95,   // [minimum health %, factor]
    KEYBOARD_OK: 1, KEYBOARD_BAD: 0.90, KEYBOARD_UNKNOWN: 0.98,
    DOCS: { bill_box: 1.03, bill: 1, none: 0.93 }, DOCS_UNKNOWN: 0.98,
    WARRANTY_6_PLUS: 1.04, WARRANTY_1_PLUS: 1.02,
    OS: { fresh: 1, cluttered: 0.98 }, OS_UNKNOWN: 0.99,
    CLEANED: 1.02,
    SPREAD: 0.08, SPREAD_PER_UNKNOWN: 0.015, SPREAD_MAX: 0.2,   // range half-width around the middle value
    MIN_NET_INR: 500,                                          // a fix must add at least this after its cost
  },
  MODEL: process.env.LAPFIT_MODEL || 'claude-haiku-5-5',
};

export const PUBLIC_SETTINGS = {
  MIN_EVIDENCE_N: SETTINGS.MIN_EVIDENCE_N,
  COMPARE_MIN: SETTINGS.COMPARE_MIN,
  COMPARE_MAX: SETTINGS.COMPARE_MAX,
  MODEL_TIMEOUT_MS: SETTINGS.MODEL_TIMEOUT_MS,
  WINDOW_CHOICES: SETTINGS.WINDOW_CHOICES,
  MONTHS_CHOICES: SETTINGS.MONTHS_CHOICES,
  TREND_WINDOW_DAYS: SETTINGS.TREND_WINDOW_DAYS,
  SUBMIT_MAX_CHARS: SETTINGS.SUBMIT_MAX_CHARS,
};
