import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETTINGS, PUBLIC_SETTINGS } from '../settings.js';
import { handle, BANNER } from './handler.js';
import { db } from './db.js';
import { hasModelKey } from './model.js';
import { submitReport, reviewSubmission } from './submissions.js';
import { homeSummary, demandSummary, insightsFor, garageSummary } from './insights.js';
import { variantsOfModel, PERSONAS, TOPICS, PERSONA_LABEL, TOPIC_LABEL, allModels } from './engine.js';
import { fmtInr, fmtStorage } from './util.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > SETTINGS.MAX_BODY_BYTES) { reject(new Error('too_large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };

// Admin can change what the public sees, so: with ADMIN_TOKEN set, the token is required; without it, only this computer may use it.
function adminAllowed(req, url, form) {
  const token = process.env.ADMIN_TOKEN;
  if (token) return (url.searchParams.get('token') || form?.token) === token;
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}
function adminPage(token) {
  const pend = db.prepare("SELECT s.*, m.line FROM owner_submission s JOIN laptop_model m ON m.id = s.laptop_id WHERE s.status = 'pending' ORDER BY s.id").all();
  const queue = `<h2>Owner reports waiting for review (${pend.length})</h2>${pend.length ? pend.map((r) => `<form method="post" action="/admin/review" class="q"><input type="hidden" name="id" value="${r.id}"><input type="hidden" name="token" value="${esc(token || '')}">
    <p><b>${esc(r.line)}</b> · ${esc(PERSONA_LABEL[r.persona])} · ${r.ownership_months} months · ${esc(TOPIC_LABEL[r.topic] || r.topic)} · rating ${r.rating}/5 · ${esc(r.submitted_at.slice(0, 10))}</p>
    <p>${esc(r.text)}</p><label>Your name <input name="reviewer" required maxlength="60"></label>
    <button name="action" value="approve">Approve and publish</button> <button name="action" value="reject">Reject</button></form>`).join('') : '<p>Nothing waiting.</p>'}`;
  const table = (title, head, rows) => `<h2>${esc(title)} (${rows.length})</h2><table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
  const un = db.prepare('SELECT text, guessed_flow, reason, ts FROM unhandled_requests ORDER BY id DESC LIMIT 200').all();
  const gl = db.prepare('SELECT ts, laptop_id, variant_id, check_name, detail FROM gate_log ORDER BY id DESC LIMIT 100').all();
  const ql = db.prepare('SELECT ts, flow, confidence, language, router_mode, duration_ms, outcome FROM query_log ORDER BY id DESC LIMIT 50').all();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LapFit admin</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;padding:16px;background:#f7f5f0;color:#1f2a2e}h1{font-size:20px}h2{font-size:16px;margin-top:28px}.b{background:#fff3cd;border:1px solid #e0c36a;padding:8px 12px;border-radius:8px}
table{border-collapse:collapse;width:100%;background:#fff;font-size:13px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top;word-break:break-word}th{background:#eee}.w{overflow-x:auto}.q{background:#fff;border:1px solid #ddd;border-radius:8px;padding:8px 12px;margin:8px 0}button,input{font:inherit;padding:6px 10px}</style></head><body>
<h1>LapFit admin</h1><p class="b">${esc(BANNER)}. Requests below were not handled by one of the five flows. Use them to decide which scenarios to add.</p>
${queue}<div class="w">${table('Unhandled requests', ['Text', 'Guessed flow', 'Reason', 'Time'], un.map((r) => [r.text, r.guessed_flow, r.reason, r.ts]))}
${table('Pre-send gate drops and replacements', ['Time', 'Laptop', 'Variant', 'Check', 'Detail'], gl.map((r) => [r.ts, r.laptop_id, r.variant_id, r.check_name, r.detail]))}
${table('Recent requests', ['Time', 'Flow', 'Confidence', 'Language', 'Reader', 'ms', 'Outcome'], ql.map((r) => [r.ts, r.flow, r.confidence, r.language, r.router_mode, r.duration_ms, r.outcome]))}</div></body></html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/api/query') {
      let body; try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { ok: false, error: 'bad_request' }); }
      return json(res, 200, await handle(body));
    }
    if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, { settings: PUBLIC_SETTINGS, banner: BANNER, modelConnected: hasModelKey(), offlineReader: process.env.LAPFIT_OFFLINE_ROUTER === '1' });
    if (req.method === 'GET' && url.pathname === '/admin') {
      if (!adminAllowed(req, url)) { res.writeHead(401); return res.end(process.env.ADMIN_TOKEN ? 'Admin token needed: /admin?token=...' : 'Admin is open from this computer only. Set ADMIN_TOKEN to use it elsewhere.'); }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(adminPage(url.searchParams.get('token')));
    }
    if (req.method === 'POST' && url.pathname === '/admin/review') {
      const form = Object.fromEntries(new URLSearchParams(await readBody(req)));
      if (!adminAllowed(req, url, form)) { res.writeHead(401); return res.end('Not allowed'); }
      if (['approve', 'reject'].includes(form.action) && form.reviewer) reviewSubmission(Number(form.id), form.action, form.reviewer);
      res.writeHead(303, { location: '/admin' + (process.env.ADMIN_TOKEN ? `?token=${encodeURIComponent(form.token || '')}` : '') }); return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/api/home') return json(res, 200, homeSummary());
    if (req.method === 'GET' && url.pathname === '/api/demand') return json(res, 200, demandSummary());
    if (req.method === 'GET' && url.pathname === '/api/insights') { const r = insightsFor(url.searchParams.get('laptop')); return r ? json(res, 200, r) : json(res, 404, { ok: false }); }
    if (req.method === 'POST' && url.pathname === '/api/garage') { let b; try { b = JSON.parse(await readBody(req)); } catch { return json(res, 400, { ok: false }); } return json(res, 200, { ok: true, items: garageSummary(b.items) }); }
    if (req.method === 'GET' && url.pathname === '/api/catalog') return json(res, 200, { variants: allModels().flatMap((m) => variantsOfModel(m.id).map((v) => ({ id: v.variant_id, laptop_id: m.id, label: `${m.line}: ${v.ram_gb} GB, ${fmtStorage(v.storage_gb)}, ${fmtInr(v.price_inr)}` }))), laptops: allModels().map((m) => ({ id: m.id, name: m.line })), personas: PERSONAS.map((p) => ({ value: p, label: PERSONA_LABEL[p] })), topics: TOPICS.map((t) => ({ value: t, label: TOPIC_LABEL[t] || t })), max_chars: SETTINGS.SUBMIT_MAX_CHARS });
    if (req.method === 'POST' && url.pathname === '/api/submit-report') {
      let body; try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { ok: false, error: 'Bad request.' }); }
      return json(res, 200, submitReport(body, req.socket.remoteAddress || 'x'));
    }
    const file = url.pathname === '/' ? '/index.html' : url.pathname;
    const full = path.join(pub, path.normalize(file));
    if (!full.startsWith(pub) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(full)] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
  } catch (e) { console.error(e); json(res, 500, { ok: false }); }
});
const port = Number(process.env.PORT || 3000);
server.listen(port, () => console.log(`LapFit running at http://localhost:${port}  (${hasModelKey() ? 'model connected' : process.env.LAPFIT_OFFLINE_ROUTER === '1' ? 'offline demo reader' : 'no model key: rules-only form'})`));
