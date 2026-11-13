// DEVELOPMENT ONLY: preload the catalog and data status from fixtures so screens can be reviewed without calling the live backend.
const mods = import.meta.glob('../test/fixtures/{catalog,data_status}.json', { eager: true }) as Record<string, { default: { reply: any } }>;
export function seed() {
  for (const [p, m] of Object.entries(mods)) {
    const blocks = m.default.reply.blocks as any[];
    if (p.includes('catalog')) sessionStorage.setItem('lapfit.catalog', JSON.stringify(blocks.find((b) => b.type === 'catalog').rows));
    if (p.includes('data_status')) sessionStorage.setItem('lapfit.datastatus', JSON.stringify(blocks.find((b) => b.type === 'data_status')));
  }
}
