// "Add my experience": owner reports go into a queue. Nothing shows up in results until a person approves it.
import { z } from 'zod';
import { db } from './db.js';
import { SETTINGS } from '../settings.js';
import { PERSONAS, TOPICS } from './engine.js';

const Submission = z.object({
  laptop_id: z.string().min(1).max(10),
  persona: z.enum(PERSONAS),
  ownership_months: z.number().int().min(0).max(120),
  topic: z.enum(TOPICS),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(SETTINGS.SUBMIT_MIN_CHARS).max(SETTINGS.SUBMIT_MAX_CHARS),
});

const hits = new Map(); // simple per-address limit, kept in memory only
const PRIVATE = /https?:\/\/|www\.|[\w.+-]+@[\w-]+\.\w+|(?:\+?91[\s-]?)?\b\d{10}\b/i;

export function submitReport(body, who) {
  const now = Date.now();
  const recent = (hits.get(who) || []).filter((t) => now - t < 3600000);
  if (recent.length >= SETTINGS.SUBMIT_PER_HOUR) return { ok: false, error: 'Too many reports in the last hour. Please try again later.' };
  const parsed = Submission.safeParse({ ...body, ownership_months: Number(body.ownership_months), rating: Number(body.rating) });
  if (!parsed.success) return { ok: false, error: `Please check the form. Your note needs ${SETTINGS.SUBMIT_MIN_CHARS} to ${SETTINGS.SUBMIT_MAX_CHARS} characters, a laptop, a type of user, months owned, a topic and a rating from 1 to 5.` };
  const d = parsed.data;
  if (PRIVATE.test(d.text)) return { ok: false, error: 'Please remove links, email addresses and phone numbers from your note.' };
  if (!db.prepare('SELECT 1 FROM laptop_model WHERE id = ?').get(d.laptop_id)) return { ok: false, error: 'That laptop is not in the catalog.' };
  db.prepare('INSERT INTO owner_submission (laptop_id, persona, ownership_months, topic, rating, text, submitted_at) VALUES (?,?,?,?,?,?,?)')
    .run(d.laptop_id, d.persona, d.ownership_months, d.topic, d.rating, d.text, new Date().toISOString());
  hits.set(who, [...recent, now]);
  return { ok: true };
}

export function reviewSubmission(id, action, reviewer) {
  const sub = db.prepare('SELECT * FROM owner_submission WHERE id = ?').get(id);
  if (!sub || sub.status !== 'pending') return false;
  const now = new Date().toISOString();
  const by = String(reviewer || 'admin').slice(0, 60);
  db.transaction(() => {
    let evId = null;
    if (action === 'approve') {
      evId = `U${sub.id}`;
      const sample = db.prepare('SELECT is_sample FROM laptop_model WHERE id = ?').get(sub.laptop_id)?.is_sample ?? 0;
      db.prepare(`INSERT INTO evidence_excerpt (id, laptop_id, topic, text, source_name, source_url, date, reviewer_type, ownership_months, n_reports, rating, persona, verified, verified_by, verified_at, is_sample)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(evId, sub.laptop_id, sub.topic, sub.text, 'LapFit owner report', null, now.slice(0, 10), 'owner', sub.ownership_months, 1, sub.rating, sub.persona, 1, by, now, sample);
    }
    db.prepare('UPDATE owner_submission SET status = ?, reviewed_by = ?, reviewed_at = ?, evidence_id = ? WHERE id = ?').run(action === 'approve' ? 'approved' : 'rejected', by, now, evId, id);
  })();
  return true;
}
