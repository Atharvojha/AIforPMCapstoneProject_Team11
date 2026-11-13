import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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
  // first visit: paint the list that was saved with the website (public/snapshot.json, made at build time) at once; the live list replaces it when it arrives
  useEffect(() => {
    if (rows.length || (import.meta as any).env?.MODE === 'test') return; let alive = true;
    fetch('/snapshot.json').then((r) => (r.ok ? r.json() : null)).then((s) => { if (alive && isFreshCatalog(s?.catalog)) { setRows((cur) => (cur.length ? cur : s.catalog)); setStatus((st) => (st === 'idle' ? 'ready' : st)); } }).catch(() => { /* the live list is on its way */ });
    return () => { alive = false; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const load = useCallback(() => {
    if (started.current) return; started.current = true; if (!rows.length) setStatus('loading');
    send(cfg, { action: 'catalog' }).then((r) => {
      const b = r.ok ? r.reply.blocks.find((x) => x.type === 'catalog') : null;
      if (b) { setRows(b.rows as CatalogRow[]); setSession(CATALOG_KEY, b.rows); setStatus('ready'); } else { started.current = false; setStatus(rows.length ? 'ready' : 'error'); }
    });
  }, [cfg, send]);
  return <Ctx.Provider value={{ rows, status, load }}>{children}</Ctx.Provider>;
}
