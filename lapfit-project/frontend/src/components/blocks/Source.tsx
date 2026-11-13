/** One consistent way to say where a part of an answer comes from. Dataset = machine-read owner opinions, Web = live and not verified, Catalog = saved snapshot. */
const KIND = {
  dataset: { icon: '💬', text: 'Dataset', title: 'Owner opinions read by a machine from the recorded review dataset. Not human-verified.' },
  web: { icon: '🌐', text: 'Web', title: 'Fetched live from the web. Not verified.' },
  catalog: { icon: '📦', text: 'Catalog', title: 'Specs and prices from the saved catalog snapshot, not live.' },
} as const;
export function Source({ kind, children }: { kind: keyof typeof KIND; children?: string }) {
  const k = KIND[kind];
  return <span className={`src-tag src-${kind}`} title={k.title}><span aria-hidden="true">{k.icon}</span> {children ?? k.text}</span>;
}
