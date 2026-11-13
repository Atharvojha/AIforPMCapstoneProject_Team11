import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { sendQuery, type ApiConfig } from '../lib/api';
import type { CatalogRow } from '../lib/types';
import { getSession, setSession } from '../lib/storage';

interface CatalogState { rows: CatalogRow[]; status: 'idle' | 'loading' | 'ready' | 'error'; load(): void }
/** Version 2 added weight, screen, market and image fields. A list saved by an older build lacks them, so it is never trusted: it is fetched again. */
export const CATALOG_KEY = 'lapfit.catalog.v2';
export const isFreshCatalog = (rows: unknown): rows is CatalogRow[] => Array.isArray(rows) && rows.length > 0 && rows.every((r) => r && typeof r === 'object' && 'weight_kg' in r && 'display_size' in r);
const Ctx = createContext<CatalogState>({ rows: [], status: 'idle', load() {} });
export const useCatalog = () => useContext(Ctx);

/** The list of laptops for pickers. Fetched once per browser session, with no model call on the server. */
export function CatalogProvider({ cfg, children, send = sendQuery }: { cfg: ApiConfig; children: ReactNode; send?: typeof sendQuery }) {
  const [rows, setRows] = useState<CatalogRow[]>(() => { try { sessionStorage.removeItem('lapfit.catalog'); } catch { /* ignore */ } const c = getSession<unknown>(CATALOG_KEY, []); return isFreshCatalog(c) ? c : []; });
  const [status, setStatus] = useState<CatalogState['status']>(rows.length ? 'ready' : 'idle'); const started = useRef(rows.length > 0);
  const load = useCallback(() => {
    if (started.current) return; started.current = true; setStatus('loading');
    send(cfg, { action: 'catalog' }).then((r) => {
      const b = r.ok ? r.reply.blocks.find((x) => x.type === 'catalog') : null;
      if (b) { setRows(b.rows as CatalogRow[]); setSession(CATALOG_KEY, b.rows); setStatus('ready'); } else { started.current = false; setStatus('error'); }
    });
  }, [cfg, send]);
  return <Ctx.Provider value={{ rows, status, load }}>{children}</Ctx.Provider>;
}
