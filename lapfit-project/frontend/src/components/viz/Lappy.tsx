export type Mood = 'idle' | 'thinking' | 'happy' | 'oops' | 'listening';

/** Lappy, the little laptop who answers. Decorative: the words always say the same thing, so it is hidden from screen readers. */
export function Lappy({ mood = 'idle', size = 88 }: { mood?: Mood; size?: number }) {
  const mouth = mood === 'happy' ? 'M38 56 Q50 68 62 56' : mood === 'oops' ? 'M40 62 Q50 54 60 62' : mood === 'listening' ? 'M44 58 Q50 66 56 58' : 'M42 58 Q50 63 58 58';
  return (
    <svg className={`lappy ${mood}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="lp-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7c5cff" /><stop offset="1" stopColor="#00c2b3" /></linearGradient>
        <linearGradient id="lp-base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9d7ff" /><stop offset="1" stopColor="#b9b6f5" /></linearGradient>
      </defs>
      <g className="lappy-body">
        <rect x="14" y="16" width="72" height="56" rx="9" fill="url(#lp-screen)" />
        <rect x="19" y="21" width="62" height="46" rx="6" fill="#14142b" />
        <g className="eyes"><ellipse className="eye" cx="38" cy="42" rx="5" ry={mood === 'happy' ? 3 : 6} fill="#fff" /><ellipse className="eye" cx="62" cy="42" rx="5" ry={mood === 'happy' ? 3 : 6} fill="#fff" /></g>
        <path d={mouth} stroke="#fff" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <path d="M6 76 H94 L88 86 H12 Z" fill="url(#lp-base)" />
        {mood === 'happy' && <g className="spark" fill="#ffd166"><path d="M88 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /><path d="M10 30l1.5 3.5 3.5 1.5-3.5 1.5L10 40l-1.5-3.5L5 35l3.5-1.5z" /></g>}
        {mood === 'oops' && <path className="drop" d="M84 22c3 5 5 8 5 11a5 5 0 0 1-10 0c0-3 2-6 5-11z" fill="#7dd3fc" />}
        {mood === 'thinking' && <g className="think" fill="#fff"><circle cx="30" cy="30" r="2.6" /><circle cx="50" cy="30" r="2.6" /><circle cx="70" cy="30" r="2.6" /></g>}
        {mood === 'listening' && <g className="waves" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none"><path d="M24 36v12" /><path d="M32 30v24" /><path d="M68 30v24" /><path d="M76 36v12" /></g>}
      </g>
    </svg>
  );
}
