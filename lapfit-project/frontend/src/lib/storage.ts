// Everything the user keeps stays on their device. Every access is guarded: storage can be blocked or full.
const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };
export const getJson = <T,>(key: string, fallback: T): T => safe(() => { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }, fallback);
export const setJson = (key: string, value: unknown): boolean => safe(() => { localStorage.setItem(key, JSON.stringify(value)); return true; }, false);
export const getSession = <T,>(key: string, fallback: T): T => safe(() => { const v = sessionStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }, fallback);
export const setSession = (key: string, value: unknown) => safe(() => { sessionStorage.setItem(key, JSON.stringify(value)); return true; }, false);

export interface OwnedLaptop { id: string; variant_id: string; name: string; purchase_date: string; price_paid: number | null }
const OWNED = 'lapfit.owned.v1'; const CHECKS = 'lapfit.checks.v1';
export const loadOwned = (): OwnedLaptop[] => getJson<OwnedLaptop[]>(OWNED, []);
export const saveOwned = (list: OwnedLaptop[]) => setJson(OWNED, list.slice(0, 10));
export const loadChecks = (): Record<string, boolean> => getJson<Record<string, boolean>>(CHECKS, {});
export const saveChecks = (c: Record<string, boolean>) => setJson(CHECKS, c);
export const newId = () => Math.random().toString(36).slice(2, 10);
