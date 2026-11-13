import { describe, it, expect } from 'vitest';
import { parseBudget, moveNeed, cleanNeeds, understoodNeeds, sameNeeds, emptyNeeds } from '../lib/needs';
import { fx } from './helpers';

describe('budget parsing', () => {
  it.each([['60k', 60000], ['1 lakh', 100000], ['1.5 lakh', 150000], ['₹62,990', 62990], ['Rs. 45000', 45000], ['2l', 200000], ['50000', 50000]])('%s', (s, n) => expect(parseBudget(s)).toBe(n));
  it.each(['', 'abc', '10', '-5', '0', '99 crore', '60k laptop', '1e9'])('rejects %j', (s) => expect(parseBudget(s)).toBeNull());
});
describe('needs editing', () => {
  const n = { ...emptyNeeds(), musts: [{ attribute: 'ram_gb', operator: '>=', value: 8, label: 'RAM 8 GB or more', supported: true }], shoulds: [{ attribute: 'weight_kg', operator: '<=', value: 1.5 }] };
  it('moves a need between tiers without touching the original', () => { const m = moveNeed(n, 'musts', 0, 'shoulds'); expect(m.musts).toHaveLength(0); expect(m.shoulds).toHaveLength(2); expect(n.musts).toHaveLength(1); });
  it('removes a need', () => expect(moveNeed(n, 'shoulds', 0, null).shoulds).toHaveLength(0));
  it('sends only the fields the server reads', () => { const c = cleanNeeds(n); expect(Object.keys(c.musts[0]).sort()).toEqual(['attribute', 'operator', 'source_text', 'value']); });
  it('detects an unchanged set of needs even when display fields differ', () => expect(sameNeeds(n, cleanNeeds(n))).toBe(true));
  it('reads the understood needs from a real reply, and null when there are none', () => { expect(understoodNeeds(fx('shortlist'))?.budget_max_inr).toBe(60000); expect(understoodNeeds(fx('help'))).toBeNull(); });
});
