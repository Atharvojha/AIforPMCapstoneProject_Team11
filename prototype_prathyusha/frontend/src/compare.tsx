import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const KEY = 'lapfit.compare.v1'
type Ctx = { ids: string[]; toggle: (id: string) => void; clear: () => void; has: (id: string) => boolean }
const C = createContext<Ctx>({ ids: [], toggle: () => {}, clear: () => {}, has: () => false })

export function CompareProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[] } catch { return [] } })
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch { /* in-memory only */ } }, [ids])
  const toggle = (id: string) => setIds(s => s.includes(id) ? s.filter(x => x !== id) : s.length >= 4 ? s : [...s, id])
  return <C.Provider value={{ ids, toggle, clear: () => setIds([]), has: id => ids.includes(id) }}>{children}</C.Provider>
}
export const useCompare = () => useContext(C)
