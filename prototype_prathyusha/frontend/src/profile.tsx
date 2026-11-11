import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Profile } from './types'

export const WORKLOADS: Record<string, string> = {
  programming: 'Coding and programming', college_research: 'Studies and research', design_video: 'Design and video editing', gaming: 'Gaming', ai_ml: 'AI and machine learning', office: 'Everyday use (browsing, documents, meetings)',
}
export const CATEGORIES: Record<string, string> = {
  performance: 'Speed (processor)', memory: 'Memory (RAM)', gpu: 'Graphics (for games, video)', battery: 'Battery', display: 'Screen', thermals_noise: 'Heat and fan noise', portability: 'Weight and size',
  keyboard_trackpad: 'Keyboard and touchpad', ports_connectivity: 'Ports and Wi-Fi', upgradeability: 'Can you upgrade it?', build_reliability: 'Build and durability', value: 'Value for money',
}
export const EMPTY: Profile = { workloads: {}, hard_requirements: {}, priorities: [] }
const KEY = 'lapfit.profile.v1'

type Ctx = { profile: Profile; setProfile: (p: Profile) => void; has: boolean }
const C = createContext<Ctx>({ profile: EMPTY, setProfile: () => {}, has: false })

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setP] = useState<Profile>(() => {
    try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as Profile) : EMPTY } catch { return EMPTY }
  })
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(profile)) } catch { /* storage unavailable: profile lives in memory */ } }, [profile])
  const has = Object.keys(profile.workloads).length > 0
  return <C.Provider value={{ profile, setProfile: setP, has }}>{children}</C.Provider>
}
export const useProfile = () => useContext(C)
