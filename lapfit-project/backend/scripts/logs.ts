// Read the request log from your own machine, through your Supabase CLI login (read-only, no database password).
//   npm run logs -- recent 30        the last requests
//   npm run logs -- failures 30      requests that failed or fell back, with the stage and reason
//   npm run logs -- stages           which stage fails most, and how often
//   npm run logs -- summary          per day and flow: count, average and p95 time, router fallbacks
//   npm run logs -- slow 15          the slowest requests with their stage timings
//   npm run logs -- request <id>     everything about one request (the id is in every reply as request_id)
//   npm run logs -- search <words>   requests whose (scrubbed) text contains the words
//   npm run logs -- client 30        failures only the browser saw
//   npm run logs -- inputs 30       the last inputs, in full: everything typed or tapped (own table input_log)
//   npm run logs -- isearch <words>  inputs whose text or form data contains the words
//   npm run logs -- tail [N]         LIVE: prints each new input as it arrives, then what the system did with it (Ctrl+C to stop); N = also show the last N first
//   npm run logs -- export           writes ALL stored inputs to exports/inputs-<date>.jsonl (never committed)
//   npm run logs -- export-all      saves EVERY log table (requests, inputs, gate checks, unhandled, shop clicks) to exports/<timestamp>/ as JSON lines, with a manifest and row counts checked against the database
//   npm run logs -- clicks           shop-link clicks per day and shop (affiliate or not) (network down, crashes)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cliDb } from './lib/db.ts';

const [cmd = 'recent', ...rest] = process.argv.slice(2);
const here = path.dirname(fileURLToPath(import.meta.url));
const db = await cliDb(path.resolve(here, '..'), { readOnly: true });
const n = Math.min(Math.max(parseInt(rest[0] ?? '', 10) || 25, 1), 200);
const ORDER: Record<string, string[]> = {
  recent: ['time', 'request_id', 'flow', 'outcome', 'router', 'ms', 'text'], failures: ['time', 'request_id', 'flow', 'outcome', 'stage', 'why', 'ms'], stages: ['stage', 'kind', 'times', 'last_seen', 'example'],
  summary: ['day', 'flow', 'outcome', 'requests', 'avg_ms', 'p50', 'p95', 'fallbacks'], slow: ['time', 'request_id', 'flow', 'ms', 'router', 'flow_ms', 'reasons', 'gate'],
  clicks: ['day', 'retailer', 'affiliate', 'clicks', 'laptops', 'visitors'], search: ['time', 'request_id', 'flow', 'outcome', 'text'], client: ['time', 'outcome', 'screen', 'message', 'action'],
};
const Q: Record<string, [string, unknown[]]> = {
  recent: [`select to_char(ts at time zone 'Asia/Kolkata','DD Mon HH24:MI:SS') as time, request_id, coalesce(flow, input_kind) as flow, outcome, router_mode as router, duration_ms as ms, left(text_scrubbed, 60) as text from query_log order by ts desc limit $1`, [n]],
  failures: [`select to_char(ts at time zone 'Asia/Kolkata','DD Mon HH24:MI:SS') as time, request_id, coalesce(flow, input_kind) as flow, outcome, error_stage as stage, left(coalesce(error_message, (failures->0->>'stage') || ': ' || (failures->0->>'kind') || ' - ' || (failures->0->>'message')), 80) as why, duration_ms as ms from v_failures limit $1`, [n]],
  stages: [`select stage, kind, times, to_char(last_seen at time zone 'Asia/Kolkata','DD Mon HH24:MI') as last_seen, left(example, 70) as example from v_stage_failures limit 50`, []],
  summary: [`select day, flow, outcome, requests, avg_ms, round(p50_ms::numeric) as p50, round(p95_ms::numeric) as p95, router_fallbacks as fallbacks from v_daily_summary limit 60`, []],
  slow: [`select to_char(ts at time zone 'Asia/Kolkata','DD Mon HH24:MI:SS') as time, request_id, coalesce(flow, input_kind) as flow, duration_ms as ms, timings->>'router_ms' as router, timings->>'flow_ms' as flow_ms, timings->>'reasons_ms' as reasons, timings->>'gate_ms' as gate from query_log where duration_ms is not null order by duration_ms desc limit $1`, [n]],
  request: [`select * from query_log where request_id = $1`, [rest[0] ?? '']],
  search: [`select to_char(ts at time zone 'Asia/Kolkata','DD Mon HH24:MI:SS') as time, request_id, coalesce(flow, input_kind) as flow, outcome, left(text_scrubbed, 80) as text from query_log where text_scrubbed ilike $1 order by ts desc limit 50`, ['%' + rest.join(' ') + '%']],
  inputs: [`select to_char(ts at time zone 'Asia/Kolkata','DD Mon HH24:MI:SS') as time, request_id, left(visitor, 6) as who, kind, text_input as text, payload from input_log order by ts desc limit ${n}`, []],
  isearch: [`select to_char(ts at time zone 'Asia/Kolkata','DD Mon HH24:MI:SS') as time, request_id, left(visitor, 6) as who, kind, text_input as text, payload from input_log where text_input ilike $1 or payload::text ilike $1 order by ts desc limit 100`, [`%${rest.join(' ')}%`]],
  export: [`select to_char(ts at time zone 'Asia/Kolkata','YYYY-MM-DD"T"HH24:MI:SS') as time, request_id, visitor, kind, text_input as text, payload, scrubbed from input_log order by ts`, []],
  clicks: [`select day, retailer, affiliate, clicks, laptops, visitors from v_clicks_daily limit 60`, []],
  client: [`select to_char(ts at time zone 'Asia/Kolkata','DD Mon HH24:MI:SS') as time, outcome, error_stage as screen, left(error_message, 80) as message, detail->>'action' as action from query_log where input_kind = 'client' order by ts desc limit $1`, [n]],
};
if (cmd === 'export-all') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); const dir = path.join('exports', stamp); fs.mkdirSync(dir, { recursive: true });
  const tables = ['query_log', 'input_log', 'gate_log', 'unhandled_request', 'outbound_click', 'demand_signal', 'view_event']; const manifest: Record<string, unknown> = { saved_at: new Date().toISOString(), tables: {} as Record<string, unknown> };
  for (const t of tables) {
    const total = Number((await db.query(`select count(*)::int as n from ${t}`)).rows[0].n); const out: string[] = []; const page = 100;
    for (let off = 0; off < total; off += page) { const { rows } = await db.query(`select to_jsonb(x) as r from (select * from ${t} order by 1 limit ${page} offset ${off}) x`); for (const r of rows as any[]) out.push(JSON.stringify(r.r)); }
    fs.writeFileSync(path.join(dir, `${t}.jsonl`), out.length ? out.join('\n') + '\n' : ''); (manifest.tables as any)[t] = { in_database: total, saved: out.length, match: total === out.length };
    console.log(`${t.padEnd(18)} ${String(total).padStart(5)} in database, ${String(out.length).padStart(5)} saved ${total === out.length ? 'OK' : 'MISMATCH'}`);
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2)); console.log(`\nSaved to backend/${dir}/ (ignored by git; it holds raw text, keep it private)`); await db.close(); process.exit(0);
}
if (cmd === 'tail') {
  const every = Math.max(2, Number(process.env.TAIL_SECONDS) || 3); const first = Math.max(0, parseInt(rest[0] ?? '', 10) || 0);
  const max0 = Number((await db.query('select coalesce(max(id), 0) as m from input_log')).rows[0].m); const baseline = Math.max(0, max0 - first);
  const printed = new Set<number>(); const outcome = new Set<number>(); let stop = false;
  process.on('SIGINT', async () => { stop = true; console.log('\nStopped.'); await db.close(); process.exit(0); });
  console.log(`Listening for new inputs (checking every ${every} s). Ctrl+C to stop.${first ? ` Showing the last ${first} first.` : ''}\n`);
  const t = (v: unknown) => String(v ?? '').replace(/\n/g, '\n           ');
  while (!stop) {
    try {
      const { rows } = await db.query(`select i.id, to_char(i.ts at time zone 'Asia/Kolkata','HH24:MI:SS') as time, i.request_id, left(i.visitor, 6) as who, i.kind, i.text_input, i.payload, q.flow, q.outcome, q.duration_ms, q.router_mode, q.error_stage, q.detail->>'reasons_mode' as reasons, jsonb_array_length(coalesce(q.detail->'failures', '[]'::jsonb)) as soft
        from input_log i left join query_log q on q.request_id = i.request_id where i.id > $1 or i.ts > now() - interval '3 minutes' order by i.id`, [baseline]);
      for (const r of rows as any[]) {
        const id = Number(r.id);
        if (id > baseline && !printed.has(id)) { printed.add(id); console.log(`[${r.time}] ${r.who} ${r.kind}`); if (r.text_input) console.log('   typed:  ' + t(r.text_input)); if (r.payload) console.log('   tapped: ' + JSON.stringify(r.payload)); }
        if (printed.has(id) && !outcome.has(id) && r.outcome) { outcome.add(id); console.log(`   -> ${r.flow ?? r.kind}: ${r.outcome}${r.duration_ms != null ? ` in ${(r.duration_ms / 1000).toFixed(1)} s` : ''}${r.router_mode ? `, read by ${r.router_mode}` : ''}${r.reasons ? `, wording ${r.reasons}` : ''}${Number(r.soft) ? `, ${r.soft} soft failure${Number(r.soft) === 1 ? '' : 's'}` : ''}${r.error_stage ? `, FAILED at ${r.error_stage}` : ''}\n`); }
      }
    } catch (e) { console.log('(could not reach the database just now; retrying)'); }
    await new Promise((res) => setTimeout(res, every * 1000));
  }
}
if (!Q[cmd]) { console.log('commands:', Object.keys(Q).join(', ')); process.exit(1); }
const [sql, params] = Q[cmd];
const { rows } = await db.query(sql, params);
await db.close();
if (!rows.length) { console.log('(no rows)'); process.exit(0); }
if (cmd === 'inputs' || cmd === 'isearch') { for (const r of [...rows].reverse().length ? rows : []) { console.log(`[${r.time}] ${r.who} ${r.kind}  (request ${r.request_id})`); if (r.text) console.log('   typed:  ' + String(r.text).replace(/\n/g, '\n           ')); if (r.payload) console.log('   tapped: ' + JSON.stringify(r.payload)); console.log(''); } console.log(`${rows.length} input${rows.length === 1 ? '' : 's'}`); process.exit(0); }
if (cmd === 'export') { fs.mkdirSync('exports', { recursive: true }); const file = `exports/inputs-${new Date().toISOString().slice(0, 10)}.jsonl`; fs.writeFileSync(file, rows.map((r: any) => JSON.stringify(r)).join('\n') + '\n'); console.log(`${rows.length} inputs written to ${file} (this folder is ignored by git; it holds raw text, keep it private)`); process.exit(0); }
if (cmd === 'request') { for (const [k, v] of Object.entries(rows[0])) console.log(k.padEnd(16), typeof v === 'object' && v !== null ? JSON.stringify(v, null, 1) : v); process.exit(0); }
const cell = (v: unknown) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' '));
const keys = Object.keys(rows[0]); const cols = [...(ORDER[cmd] ?? []).filter((c) => keys.includes(c)), ...keys.filter((k) => !(ORDER[cmd] ?? []).includes(k))];
const w = cols.map((c) => Math.min(60, Math.max(c.length, ...rows.map((r: any) => cell(r[c]).length))));
console.log(cols.map((c, i) => c.padEnd(w[i])).join('  ')); console.log(w.map((x) => '-'.repeat(x)).join('  '));
for (const r of rows) console.log(cols.map((c, i) => cell((r as any)[c]).slice(0, 60).padEnd(w[i])).join('  '));
