import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { sendQuery, type ApiConfig } from '../lib/api';
import type { CatalogRow } from '../lib/types';
import { getSession, setSession } from '../lib/storage';

interface CatalogState { rows: CatalogRow[]; status: 'idle' | 'loading' | 'ready' | 'error'; load(): void }
const Ctx = createContext<CatalogState>({ rows: [], status: 'idle', load() {} });
export const useCatalog = () => useContext(Ctx);

/** The list of laptops for pickers. Fetched once per browser session, with no model call on the server. */
export function CatalogProvider({ cfg, children, send = sendQuery }: { cfg: ApiConfig; children: ReactNode; send?: typeof sendQuery }) {
  const [rows, setRows] = useState<CatalogRow[]>(() => getSession<CatalogRow[]>('lapfit.catalog', []));
  const [status, setStatus] = useState<CatalogState['status']>(rows.length ? 'ready' : 'idle'); const started = useRef(rows.length > 0);
  const load = useCallback(() => {
    if (started.current) return; started.current = true; setStatus('loading');
    send(cfg, { action: 'catalog' }).then((r) => {
      const b = r.ok ? r.reply.blocks.find((x) => x.type === 'catalog') : null;
      if (b) { setRows(b.rows as CatalogRow[]); setSession('lapfit.catalog', b.rows); setStatus('ready'); } else { started.current = false; setStatus('error'); }
    });
  }, [cfg, send]);
  return <Ctx.Provider value={{ rows, status, load }}>{children}</Ctx.Provider>;
}
