import { useEffect, useRef, useState } from 'react';
import { LaptopArt } from './viz/LaptopArt';

export interface Pic { url: string; site: string | null; page: string | null; alt: string }

/** The laptop's picture with a shimmer while it loads. If there is no picture, or it fails to load, a drawn laptop takes its place. */
export function LaptopImage({ pic, brand, name, screen, weight, caption = true }: { pic?: Pic | null; brand: string; name: string; screen?: number | null; weight?: number | null; caption?: boolean }) {
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading'); const ref = useRef<HTMLImageElement>(null);
  useEffect(() => { const el = ref.current; if (el?.complete) setState(el.naturalWidth > 0 ? 'ok' : 'failed'); }, [pic?.url]);   // a cached picture can finish before the load handler is attached
  if (!pic || state === 'failed') return <div className="laptop-media art"><LaptopArt brand={brand} screen={screen} weight={weight} name={name} />{caption && <span className="media-cap">Illustration</span>}</div>;
  return (
    <div className={`laptop-media ${state}`}>
      <img ref={ref} src={pic.url} alt={pic.alt || name} loading="lazy" decoding="async" referrerPolicy="no-referrer" onLoad={() => setState('ok')} onError={() => setState('failed')} />
      {caption && <span className="media-cap" title="A picture from the web. It may not show this exact version, and its licence is not verified.">{pic.page ? <a href={pic.page} target="_blank" rel="noopener noreferrer">Photo: {pic.site ?? 'web'}</a> : <>Photo: {pic.site ?? 'web'}</>}</span>}
    </div>
  );
}
