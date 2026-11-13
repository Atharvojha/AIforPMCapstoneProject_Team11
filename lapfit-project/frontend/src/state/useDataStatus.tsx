import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { sendQuery, type ApiConfig } from '../lib/api';
import type { Block } from '../lib/types';
import { getSession, setSession } from '../lib/storage';

const Ctx = createContext<Block | null>(null);
export const useDataStatus = () => useContext(Ctx);
/** What data the product holds and how old it is. Fetched once per browser session (no model call on the server). */
export function DataStatusProvider({ cfg, children, send = sendQuery }: { cfg: ApiConfig; children: ReactNode; send?: typeof sendQuery }) {
  const [b, setB] = useState<Block | null>(() => getSession<Block | null>('lapfit.datastatus', null));
  useEffect(() => { if (b) return; let live = true;
    // paint the status saved with the website at once; the live one replaces it
    if ((import.meta as any).env?.MODE !== 'test') fetch('/snapshot.json').then((r) => (r.ok ? r.json() : null)).then((snap) => { if (live && snap?.data_status) setB((cur) => cur ?? snap.data_status); }).catch(() => { /* ignore */ }); send(cfg, { action: 'data_status' }).then((r) => { const x = r.ok ? r.reply.blocks.find((y) => y.type === 'data_status') : null; if (live && x) { setB(x); setSession('lapfit.datastatus', x); } }); return () => { live = false; }; }, [cfg, send, b]);
  return <Ctx.Provider value={b}>{children}</Ctx.Provider>;
}
/** The one honest line about the data, built from the status the server reported. */
export const dataLine = (b: Block | null): string => {
  if (!b) return 'Prices are a saved snapshot, not live. Specs are imported listing data that no person has checked yet. Web reviews are fetched live when you ask. Catalog laptops have dated prices and owner opinions. Laptops from the web are read from live pages and are not verified.';
  return b.notice as string;
};
