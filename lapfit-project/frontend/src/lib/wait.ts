/** 682 seconds becomes "11 min 22 s": people do not think in hundreds of seconds. */
export const fmtWait = (s: number): string => { const n = Math.max(0, Math.round(s)); if (n < 60) return `${n} s`; const m = Math.floor(n / 60); const r = n % 60; return r ? `${m} min ${r} s` : `${m} min`; };
