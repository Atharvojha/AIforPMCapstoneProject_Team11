import { createContext, useContext } from 'react';
import type { Needs } from '../lib/types';

/** A laptop card as the backend sends it (the fields the detail sheet reads). */
export interface DetailCard {
  variant_id: string; name: string; brand?: string; price_inr: number; price_text: string; as_of: string; as_of_text: string; data_status: string; spec_lines: string[]; specs: any; image?: any;
  musts: { label: string; ok: boolean | null; actual: string }[]; evidence: { n: number; enough: boolean; text: string; positive: number; negative: number; min_n?: number }; reasons: string[]; unknown_fields: string[];
}
export type DetailTab = 'fit' | 'specs' | 'trust';

/** What a block can ask the app to do. Blocks never call the network themselves. */
export interface Ctx {
  sendText(t: string): void; prefill(t: string): void; sendNeeds(n: Needs): void; action(body: Record<string, unknown>, label: string): void;
  compare: { ids: string[]; has(id: string): boolean; toggle(id: string, name: string): void };
  goto(tab: string): void; busy: boolean;
  /** Re-run THIS reply in place (a re-sort, "Update results"): its answer is replaced, no new message, no new turn. Set per turn by the thread view. */
  resort(body: Record<string, unknown>, label?: string): Promise<boolean> | void;
  /** The needs the app last understood, for a re-sort when the block does not carry them. */
  savedNeeds(): Needs | null;
  /** True while a reply is being replaced in place (the block shows a subtle busy state). */
  refreshing?: boolean;
  /** Open the one Detail sheet (Fit | Specs | Trust) for a laptop card. */
  openDetail(card: DetailCard, tab?: DetailTab): void;
}
export const noopCtx: Ctx = { sendText() {}, prefill() {}, sendNeeds() {}, action() {}, compare: { ids: [], has: () => false, toggle() {} }, goto() {}, busy: false, openDetail() {}, resort() {}, savedNeeds: () => null };
export const CtxContext = createContext<Ctx>(noopCtx);
export const useCtx = () => useContext(CtxContext);
/** The id of the turn whose reply a block sits in (null outside a thread). */
export const TurnContext = createContext<number | null>(null);
export const useTurnId = () => useContext(TurnContext);

import type { Thread } from '../state/useThread';
export interface ComparePicks { ids: string[]; names: Record<string, string>; has(id: string): boolean; toggle(id: string, name: string): void; remove(id: string): void; clear(): void }
/** Builds what blocks may do, for the conversation of one screen. */
export function buildCtx(thread: Thread, compare: ComparePicks, goto: (tab: string) => void, prefill: (t: string) => void): Ctx {
  return {
    sendText: (t) => { thread.sendText(t); }, prefill, sendNeeds: (n) => { thread.sendNeeds(n); }, action: (body, label) => { thread.action(body, label); },
    compare: { ids: compare.ids, has: compare.has, toggle: compare.toggle }, goto, busy: thread.busy || thread.cooldown > 0, openDetail: () => {}, resort: () => {}, savedNeeds: () => thread.session.get().needs,
  };
}
