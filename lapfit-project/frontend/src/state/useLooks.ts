import { useEffect, useMemo } from 'react';
import { useCatalog } from './useCatalog';
import { fromCatalog, type Look } from '../lib/looks';

/** Every recommendable laptop with the numbers the look visuals need, from the one catalog list the app already fetches. Empty until it arrives; the visuals then simply do not show. */
export function useAllLooks(): Look[] {
  const { rows, load } = useCatalog();
  useEffect(() => { load(); }, [load]);
  return useMemo(() => rows.filter((r) => r.recommendable).map(fromCatalog), [rows]);
}
