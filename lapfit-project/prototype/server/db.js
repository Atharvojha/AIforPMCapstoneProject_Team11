import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed } from './seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.LAPFIT_DB || path.join(here, '..', 'data', 'lapfit.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const FACT = `verified INTEGER NOT NULL DEFAULT 0, verified_by TEXT, verified_at TEXT, is_sample INTEGER NOT NULL DEFAULT 0`;

db.exec(`
CREATE TABLE IF NOT EXISTS laptop_model (
  id TEXT PRIMARY KEY, brand TEXT NOT NULL, line TEXT NOT NULL, year INTEGER NOT NULL,
  processor TEXT, gpu TEXT, display_size REAL, weight_kg REAL,
  hinge_type TEXT NOT NULL CHECK (hinge_type IN ('clamshell','convertible_360','detachable')),
  ram_slots_or_soldered TEXT, warranty TEXT, warranty_years INTEGER, ${FACT});
CREATE TABLE IF NOT EXISTS variant (
  id TEXT PRIMARY KEY, model_id TEXT NOT NULL REFERENCES laptop_model(id),
  ram_gb INTEGER NOT NULL, storage_gb INTEGER NOT NULL, colours TEXT NOT NULL,
  price_inr INTEGER NOT NULL, price_as_of TEXT NOT NULL, availability TEXT, ${FACT});
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, variant_id TEXT NOT NULL REFERENCES variant(id),
  seller TEXT, price_inr INTEGER NOT NULL, timestamp TEXT NOT NULL, ${FACT});
CREATE TABLE IF NOT EXISTS evidence_excerpt (
  id TEXT PRIMARY KEY, laptop_id TEXT NOT NULL REFERENCES laptop_model(id), topic TEXT NOT NULL,
  text TEXT NOT NULL, source_name TEXT, source_url TEXT, date TEXT, reviewer_type TEXT,
  ownership_months INTEGER, n_reports INTEGER NOT NULL DEFAULT 1, rating REAL, persona TEXT, ${FACT});
CREATE TABLE IF NOT EXISTS claim_ledger (
  id TEXT PRIMARY KEY, claim_text TEXT NOT NULL, scope TEXT NOT NULL, match_terms TEXT,
  verdict TEXT, sample_size INTEGER, evidence_ids TEXT, approver TEXT, date TEXT, ${FACT});
CREATE TABLE IF NOT EXISTS query_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, flow TEXT, confidence REAL,
  language TEXT, router_mode TEXT, duration_ms INTEGER, outcome TEXT, text_len INTEGER);
CREATE TABLE IF NOT EXISTS unhandled_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, guessed_flow TEXT, reason TEXT, ts TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS view_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, laptop_id TEXT NOT NULL, kind TEXT NOT NULL, is_sample INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_view_ts ON view_events(ts);
CREATE TABLE IF NOT EXISTS owner_submission (
  id INTEGER PRIMARY KEY AUTOINCREMENT, laptop_id TEXT NOT NULL, persona TEXT NOT NULL, ownership_months INTEGER NOT NULL,
  topic TEXT NOT NULL, rating INTEGER NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TEXT NOT NULL, reviewed_by TEXT, reviewed_at TEXT, evidence_id TEXT);
CREATE TABLE IF NOT EXISTS demand_signal (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, budget_band TEXT NOT NULL, use_cases TEXT NOT NULL,
  musts TEXT NOT NULL, matched INTEGER NOT NULL, is_sample INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS resale_action (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, cost_low INTEGER NOT NULL, cost_high INTEGER NOT NULL, note TEXT, ${FACT});
CREATE TABLE IF NOT EXISTS gate_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, laptop_id TEXT, variant_id TEXT, check_name TEXT, detail TEXT);
`);

// Migration for databases made before owner voice existed. Sample data is rebuilt; real rows are never touched.
if (!db.prepare('PRAGMA table_info(evidence_excerpt)').all().some((c) => c.name === 'persona')) db.exec('ALTER TABLE evidence_excerpt ADD COLUMN persona TEXT');
if (db.prepare('SELECT COUNT(*) c FROM laptop_model').get().c === 0) { seed(db); db.pragma('user_version = 4'); }
else if (db.pragma('user_version', { simple: true }) < 4) {
  const real = db.prepare('SELECT (SELECT COUNT(*) FROM laptop_model WHERE is_sample = 0) + (SELECT COUNT(*) FROM evidence_excerpt WHERE is_sample = 0) AS c').get().c;
  if (!real) {
    db.transaction(() => { for (const t of ['price_history', 'evidence_excerpt', 'claim_ledger', 'variant', 'laptop_model', 'view_events', 'demand_signal', 'resale_action']) db.exec(`DELETE FROM ${t}`); seed(db); })();
    db.pragma('user_version = 4');
  }
}

export const isShowable = (alias) => `(${alias}.verified = 1 OR ${alias}.is_sample = 1)`;

export function logUnhandled(text, guessedFlow, reason) {
  db.prepare('INSERT INTO unhandled_requests (text, guessed_flow, reason, ts) VALUES (?,?,?,?)')
    .run(String(text).slice(0, 2000), guessedFlow, reason, new Date().toISOString());
}
export function logGate(laptopId, variantId, check, detail) {
  db.prepare('INSERT INTO gate_log (ts, laptop_id, variant_id, check_name, detail) VALUES (?,?,?,?,?)')
    .run(new Date().toISOString(), laptopId ?? null, variantId ?? null, check, String(detail).slice(0, 500));
}
export function logQuery(row) {
  db.prepare('INSERT INTO query_log (ts, flow, confidence, language, router_mode, duration_ms, outcome, text_len) VALUES (?,?,?,?,?,?,?,?)')
    .run(new Date().toISOString(), row.flow ?? null, row.confidence ?? null, row.language ?? null, row.router_mode ?? null, row.duration_ms ?? null, row.outcome ?? null, row.text_len ?? 0);
}

export function logViews(laptopIds, kind = 'view') {
  const ins = db.prepare('INSERT INTO view_events (ts, laptop_id, kind, is_sample) VALUES (?,?,?,(SELECT is_sample FROM laptop_model WHERE id = ?))');
  const ts = new Date().toISOString();
  for (const id of new Set(laptopIds)) ins.run(ts, id, kind, id);
}

export const budgetBand = (n) => (!n ? 'No budget given' : n < 40000 ? 'Under ₹40,000' : n < 60000 ? '₹40,000 to ₹60,000' : n < 80000 ? '₹60,000 to ₹80,000' : '₹80,000 and above');
/** What buyers ask for, with no free text and nothing that identifies a person. */
export function logDemand({ budget, useCases, musts, matched }) {
  db.prepare('INSERT INTO demand_signal (ts, budget_band, use_cases, musts, matched, is_sample) VALUES (?,?,?,?,?,?)')
    .run(new Date().toISOString(), budgetBand(budget), JSON.stringify((useCases || []).slice(0, 3)), JSON.stringify((musts || []).slice(0, 5)), matched, 1);
}
