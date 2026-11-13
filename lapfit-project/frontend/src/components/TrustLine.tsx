/** The one trust line used on every hero, card and row: when the price was recorded, how many owner opinions stand behind it, and that no person has verified the specs. Nothing here is computed. */
export function TrustLine({ asOf, owners, verified, extra, compact = false }: { asOf: string; owners?: number | null; verified: boolean; extra?: string; compact?: boolean }) {
  return (
    <p className={`trust-line ${compact ? 'compact' : ''}`}>
      <span>Price as of {asOf}</span>
      {!compact && owners != null && <span>{owners} owner opinion{owners === 1 ? '' : 's'}</span>}
      <span className={verified ? 'ok' : 'warn'}>{verified ? 'Verified' : 'Not human-verified'}</span>
      {extra && <span>{extra}</span>}
    </p>
  );
}
