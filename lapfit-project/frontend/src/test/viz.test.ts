import { describe, it, expect } from 'vitest';
import { norm, axesFor, daysOld, freshness } from '../lib/viz';
import { fitWithin } from '../lib/image';
import { speechLangFor } from '../lib/speech';
import { fx } from './helpers';

describe('chart scaling uses only recorded values and never invents one', () => {
  it('scales against the other laptops, higher or lower being better, and keeps unknown as null', () => {
    expect(norm(10, [10, 20, 30], true)).toBeCloseTo(0.18); expect(norm(30, [10, 20, 30], true)).toBeCloseTo(1); expect(norm(10, [10, 20, 30], false)).toBeCloseTo(1); expect(norm(30, [10, 20, 30], false)).toBeCloseTo(0.18);
    expect(norm(null, [10, 20], true)).toBeNull(); expect(norm(5, [5], true)).toBe(0.62); expect(norm(7, [7, 7], true)).toBe(0.62);
  });
  it('builds six axes from a real card, and an owner-mood axis only when there is enough evidence', () => {
    const cards = (fx('shortlist').blocks.find((b) => b.type === 'cards')!.cards as any[]); const a = axesFor(cards[0]); expect(a.map((x) => x.key)).toEqual(['price', 'ram', 'storage', 'weight', 'screen', 'owners']);
    expect(a[0].shown).toBe(cards[0].price_text); const thin = axesFor({ ...cards[0], evidence: { enough: false, n: 3, positive: 3, negative: 0 } }); expect(thin[5].value).toBeNull(); expect(thin[5].shown).toBe('not enough evidence');
    const enough = axesFor({ ...cards[0], evidence: { enough: true, n: 40, positive: 30, negative: 10 } }); expect(enough[5].value).toBeCloseTo(0.75);
  });
  it('how old a recorded price is, in days, and how it is labelled', () => {
    const now = new Date('2026-11-20T10:00:00Z'); expect(daysOld('2026-11-10', now)).toBe(10); expect(daysOld('2026-11-20', now)).toBe(0); expect(daysOld(null, now)).toBeNull(); expect(daysOld('garbage', now)).toBeNull(); expect(daysOld('2026-12-01', now)).toBe(0);
    expect(freshness(0)).toEqual({ tone: 'fresh', text: 'today' }); expect(freshness(1).text).toBe('1 day old'); expect(freshness(5).tone).toBe('fresh'); expect(freshness(20).tone).toBe('aging'); expect(freshness(90).tone).toBe('stale'); expect(freshness(null).tone).toBe('unknown');
  });
});
describe('picture sizing and speech language', () => {
  it('never enlarges, keeps the shape, and caps the long side at 1280', () => { expect(fitWithin(4000, 3000)).toEqual({ w: 1280, h: 960 }); expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 }); expect(fitWithin(1000, 4000)).toEqual({ w: 320, h: 1280 }); expect(fitWithin(0, 0).w).toBeGreaterThanOrEqual(1); });
  it('the answer is spoken in the language the backend detected', () => { expect(speechLangFor('Hinglish')).toBe('hi-IN'); expect(speechLangFor('Hindi')).toBe('hi-IN'); expect(speechLangFor('Telugu-English')).toBe('te-IN'); expect(speechLangFor('Tamil-English')).toBe('ta-IN'); expect(speechLangFor('English')).toBe('en-IN'); expect(speechLangFor(undefined)).toBe('en-IN'); });
});

import { fmtWait } from '../lib/wait';
describe('wait times are shown the way people think', () => { it('seconds, minutes and mixed', () => { expect(fmtWait(0)).toBe('0 s'); expect(fmtWait(45)).toBe('45 s'); expect(fmtWait(60)).toBe('1 min'); expect(fmtWait(682)).toBe('11 min 22 s'); expect(fmtWait(3599)).toBe('59 min 59 s'); expect(fmtWait(-5)).toBe('0 s'); }); });
