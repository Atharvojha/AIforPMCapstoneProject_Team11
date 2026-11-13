/** Three big numbers instead of a wall of text: how many things to ask about, how many look fine, how many notes. Counts of what the checks returned. */
export function FlagStrip({ warn, ok, info }: { warn: number; ok: number; info: number }) {
  return (
    <div className="flag-strip" role="group" aria-label={`${warn} things to ask about, ${ok} that look fine, ${info} notes`}>
      <div className="flag warn"><strong>{warn}</strong><span>to ask about</span></div>
      <div className="flag ok"><strong>{ok}</strong><span>look fine</span></div>
      <div className="flag info"><strong>{info}</strong><span>notes</span></div>
    </div>
  );
}
