import { useCallback, useEffect, useMemo, useState } from 'react';
import { readConfig, type ApiConfig } from './lib/api';
import { useThread } from './state/useThread';
import { CatalogProvider } from './state/useCatalog';
import { DataStatusProvider, useDataStatus, dataLine } from './state/useDataStatus';
import { ApiConfigContext } from './components/api-context';
import type { ComparePicks } from './components/ctx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Lappy } from './components/viz/Lappy';
import { lazy, Suspense } from 'react';
const Gallery = import.meta.env.DEV ? lazy(() => import('./dev/Gallery')) : null;   // design-review page, development only
import { reportClientError, kindOf } from './lib/clientLog';
import { getSession, setSession } from './lib/storage';
import { AskScreen } from './screens/AskScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { CheckScreen } from './screens/CheckScreen';
import { SellScreen } from './screens/SellScreen';
import { YouScreen } from './screens/YouScreen';
import { MarketScreen } from './screens/MarketScreen';
import { AboutScreen } from './screens/AboutScreen';
import { TrustSheet } from './components/TrustSheet';
import { getJson, setJson } from './lib/storage';
import { createSessionStore } from './lib/session';

const ICON: Record<string, string> = { ask: '✨', explore: '🗺️', check: '🕵️', sell: '💰', you: '🙂' };
const TABS = [
  { id: 'ask', label: 'Ask', primary: true }, { id: 'explore', label: 'Explore', primary: true }, { id: 'check', label: 'Check', primary: true }, { id: 'sell', label: 'Sell', primary: true }, { id: 'you', label: 'You', primary: true },
  { id: 'market', label: 'Market' }, { id: 'about', label: 'About' },   // Market and About are reached from Explore and the Trust sheet, not from the nav
] as const;
type TabId = typeof TABS[number]['id'];
const galleryOf = (): string | null => { if (!import.meta.env.DEV) return null; const h = window.location.hash.replace(/^#\/?/, ''); return h.startsWith('gallery') ? h.slice('gallery'.length).replace(/^\//, '') : null; };
const routeOf = (): TabId => { const h = window.location.hash.replace(/^#\/?/, ''); return (TABS.some((t) => t.id === h) ? h : 'ask') as TabId; };

const FOOTER = 'LapFit shows recorded facts with their dates. It is a second opinion, not a purchase recommendation or a guarantee.';
/** Market lives inside Explore; About has no tab. */
const navOf = (t: TabId) => (t === 'market' ? 'explore' : t);
export default function App({ config = readConfig() }: { config?: ApiConfig | null }) {
  if (!config) return <Setup />;
  return <ApiConfigContext.Provider value={config}><CatalogProvider cfg={config}><DataStatusProvider cfg={config}><Shell cfg={config} /></DataStatusProvider></CatalogProvider></ApiConfigContext.Provider>;
}

function Shell({ cfg }: { cfg: ApiConfig }) {
  const [tab, setTab] = useState<TabId>(routeOf());
  useEffect(() => { const on = () => setTab(routeOf()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  const goto = useCallback((t: string) => { window.location.hash = `/${t}`; window.scrollTo?.(0, 0); }, []);
  // failures that only this browser can see are reported to the server, with the screen and request kind but never the user's text
  const reporter = useCallback((screen: string) => (error: import('./lib/types').ApiError, body: Record<string, unknown>) => {
    const what = kindOf(error); if (what) reportClientError(cfg, { what, screen, message: error.message, action: String(body.action ?? (body.needs ? 'needs' : body.owned ? 'owned' : 'text')) });
  }, [cfg]);
  const [trustOpen, setTrustOpen] = useState(false); const closeTrust = useCallback(() => setTrustOpen(false), []);
  const [chipOpen, setChipOpen] = useState(() => !getJson<boolean>('lapfit.chipseen.v1', false));   // first visit: the line is shown in full for 3 s, then it folds to one line
  useEffect(() => { if (!chipOpen) return; const t = setTimeout(() => { setChipOpen(false); setJson('lapfit.chipseen.v1', true); }, 3000); return () => clearTimeout(t); }, [chipOpen]);
  const session = useMemo(() => createSessionStore(), []);   // the saved brief of the Ask conversation: needs, recommendations, selection
  const th = { ask: useThread(cfg, undefined, reporter('ask'), session), explore: useThread(cfg, undefined, reporter('explore')), check: useThread(cfg, undefined, reporter('check')), sell: useThread(cfg, undefined, reporter('sell')),
    mine: useThread(cfg, undefined, reporter('mine')), share: useThread(cfg, undefined, reporter('share')), market: useThread(cfg, undefined, reporter('market')) };

  // laptops picked for comparison (kept for this browser session)
  const [picks, setPicks] = useState<{ ids: string[]; names: Record<string, string> }>(() => getSession('lapfit.picks', { ids: [], names: {} }));
  useEffect(() => { setSession('lapfit.picks', picks); session.set({ picks: picks.ids.map((id) => ({ id, name: picks.names[id] ?? id })) }); }, [picks, session]);
  const compare: ComparePicks = useMemo(() => ({
    ids: picks.ids, names: picks.names, has: (id) => picks.ids.includes(id),
    toggle: (id, name) => setPicks((p) => (p.ids.includes(id) ? { ids: p.ids.filter((x) => x !== id), names: p.names } : p.ids.length >= 4 ? p : { ids: [...p.ids, id], names: { ...p.names, [id]: name } })),
    remove: (id) => setPicks((p) => ({ ids: p.ids.filter((x) => x !== id), names: p.names })), clear: () => setPicks({ ids: [], names: {} }),
  }), [picks]);

  const lastReply = Object.values(th).flatMap((t) => t.turns).filter((t) => t.reply).sort((a, b) => b.id - a.id)[0]?.reply;
  const ds = useDataStatus(); const notice = lastReply?.notice || dataLine(ds);
  const openCompare = () => { goto('explore'); if (compare.ids.length >= 2) th.explore.action({ action: 'compare', variant_ids: compare.ids }, `Compare ${compare.ids.length} laptops`); };
  const props = (k: keyof typeof th) => ({ thread: th[k], compare, goto });

  return (
    <div className={`app ${compare.ids.length > 0 && tab !== 'explore' ? 'has-tray' : ''}`}>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <a className="brand" href="#/ask" aria-label="LapFit home"><span className="logo" aria-hidden="true"><Lappy mood="idle" size={30} /></span> LapFit</a>
        <nav className="top-nav" aria-label="Main">{TABS.filter((t) => 'primary' in t).map((t) => <a key={t.id} href={`#/${t.id}`} aria-current={navOf(tab) === t.id ? 'page' : undefined}>{t.label}</a>)}</nav>
      </header>
      <div className={`trust-chip ${chipOpen ? 'open' : ''}`}><p role="note">{notice}</p><button className="chip-i" onClick={() => setTrustOpen(true)} aria-label="Why trust this?" aria-haspopup="dialog"><span aria-hidden="true">i</span></button></div>
      <TrustSheet open={trustOpen} onClose={closeTrust} notice={notice} footer={lastReply?.footer ?? FOOTER} status={ds} reply={lastReply} />
      <main id="main" tabIndex={-1}>
        {Gallery && galleryOf() !== null && <Suspense fallback={null}><Gallery which={galleryOf()!} /></Suspense>}
        <ErrorBoundary key={tab} screen={tab} onCrash={(message, screen) => reportClientError(cfg, { what: 'ui_crash', screen, message })}>
        {tab === 'ask' && <AskScreen {...props('ask')} />}
        {tab === 'explore' && <ExploreScreen {...props('explore')} />}
        {tab === 'check' && <CheckScreen {...props('check')} />}
        {tab === 'sell' && <SellScreen {...props('sell')} />}
        {tab === 'you' && <YouScreen mine={th.mine} share={th.share} compare={compare} goto={goto} />}
        {tab === 'market' && <MarketScreen {...props('market')} />}
        {tab === 'about' && <AboutScreen />}
        </ErrorBoundary>
      </main>
      {compare.ids.length > 0 && tab !== 'explore' && (
        <div className="tray" role="region" aria-label="Laptops picked for comparison">
          <span className="tray-count">{compare.ids.length} picked{compare.ids.length < 2 ? ' (pick one more)' : ''}<small className="tray-names" aria-hidden="true">{compare.ids.map((i) => (compare.names[i] ?? '').split(' · ')[0]).filter(Boolean).join(', ')}</small></span>
          <button className="btn small" disabled={compare.ids.length < 2} onClick={openCompare}>Compare</button>
          <button className="link" onClick={compare.clear}>Clear</button>
        </div>
      )}
      <nav className="bottom-nav" aria-label="Main (mobile)">
        {TABS.filter((t) => 'primary' in t).map((t) => <a key={t.id} href={`#/${t.id}`} aria-current={navOf(tab) === t.id ? 'page' : undefined}><span className="nav-icon" aria-hidden="true">{ICON[t.id]}</span><span className="nav-label">{t.label}</span></a>)}
      </nav>
    </div>
  );
}

function Setup() {
  return (
    <main className="setup"><h1>LapFit needs two settings</h1>
      <p>Create a file named <code>.env.local</code> in the <code>frontend</code> folder with the project address and the <strong>public</strong> anon key (both are in your Supabase project under Settings, API):</p>
      <pre>{`VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co\nVITE_SUPABASE_ANON_KEY=your-public-anon-key`}</pre>
      <p>Then restart the dev server. Never put the Gemini, Tavily or service-role keys here.</p></main>
  );
}
