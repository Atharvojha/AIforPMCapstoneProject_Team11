/** A price. It always shows the exact text the backend sent from the first paint: no counting up from zero, because an intermediate number is a price that does not exist. The "settle" is a short fade done in CSS. */
export function CountUp({ text }: { to?: number; text: string; ms?: number }) {
  return <span className="countup" aria-label={text}>{text}</span>;
}
