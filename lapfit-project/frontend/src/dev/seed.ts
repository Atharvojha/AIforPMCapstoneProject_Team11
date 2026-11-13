// DEVELOPMENT ONLY: preload the catalog and data status from fixtures so screens can be reviewed without calling the live backend.
const mods = import.meta.glob('../test/fixtures/{catalog,data_status}.json', { eager: true }) as Record<string, { default: { reply: any } }>;
const wc = import.meta.glob('../test/fixtures/web_catalog.json', { eager: true }) as Record<string, { default: { reply: any } }>;
export function seed() {
  const reply = Object.values(wc)[0]?.default.reply; const real = window.fetch.bind(window);
  if (reply) window.fetch = (async (u: any, init: any) => { try { if (JSON.parse(init?.body ?? '{}').action === 'web_catalog') return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } }); } catch { /* fall through */ } return real(u, init); }) as typeof fetch;
  if (location.search.includes('webtier')) sessionStorage.setItem('lapfit.explore.web', JSON.stringify({ budget: 70000 }));   // opens Explore on the web tier
  for (const [p, m] of Object.entries(mods)) {
    const blocks = m.default.reply.blocks as any[];
    if (p.includes('catalog')) sessionStorage.setItem('lapfit.catalog.v2', JSON.stringify(blocks.find((b) => b.type === 'catalog').rows));
    if (p.includes('data_status')) sessionStorage.setItem('lapfit.datastatus', JSON.stringify(blocks.find((b) => b.type === 'data_status')));
  }
}
