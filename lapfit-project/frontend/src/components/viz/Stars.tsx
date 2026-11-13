/** A star rating you tap. */
export function Stars({ value, onChange, label = 'Rating' }: { value: number; onChange(v: number): void; label?: string }) {
  return (
    <div className="stars" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} role="radio" aria-checked={value === n} aria-label={`${n} of 5`} className={n <= value ? 'on' : ''} onClick={() => onChange(value === n ? 0 : n)}>★</button>)}
    </div>
  );
}
