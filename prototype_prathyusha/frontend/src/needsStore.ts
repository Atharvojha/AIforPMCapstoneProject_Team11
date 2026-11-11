import type { Overrides } from './types'

const KEY = 'lapfit.needs.sheet.v1'
export type SavedNeeds = { text: string; overrides: Overrides; savedAt: string }

export function loadNeeds(): SavedNeeds | null {
  try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as SavedNeeds) : null } catch { return null }
}
export function saveNeeds(text: string, overrides: Overrides): boolean {
  try { localStorage.setItem(KEY, JSON.stringify({ text, overrides, savedAt: new Date().toISOString() })); return true } catch { return false }
}
export function clearNeeds() { try { localStorage.removeItem(KEY) } catch { /* nothing to clear */ } }
