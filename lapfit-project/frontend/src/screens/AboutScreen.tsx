import { useDataStatus } from '../state/useDataStatus';
import { DataStatus } from '../components/blocks/Misc';

export function AboutScreen() {
  const ds = useDataStatus();
  return (
    <section className="about" aria-labelledby="about-h">
      <h2 id="about-h">How LapFit works, and what to trust</h2>
      <h3>What this is</h3>
      <p>LapFit is a second opinion for people buying a laptop in India. It is a <strong>course project</strong> (IIIT Hyderabad, AI for PMs, Team 11), not a shop and not financial or purchase advice. It never says “buy this”.</p>
      <h3>What data is in here right now</h3>
      {ds ? <DataStatus b={ds} /> : <p className="muted">Loading the data summary…</p>}
      <h3>Where the facts come from</h3>
      <ul>
        <li><strong>Specs and prices</strong> come from stored catalog records. Every price shows the date it was recorded. Most of the catalog is <strong>imported listing data that no person has verified</strong>, so it is labelled “Sample data” or “not human-verified”.</li>
        <li><strong>Owner opinions</strong> were read from public review text by a machine. They are labelled “machine-read”. Counts remove duplicate reviews. Anything with fewer than 20 opinions is shown as “not enough evidence” with no percentage and no quote.</li>
        <li><strong>Live web reviews</strong> are fetched when you ask, from web search results, with a link to each source. They are <strong>not verified and not counted</strong> in the owner numbers above, and never change a price or a spec.</li>
        <li><strong>Owner reports</strong> from this site are shown only after a named person approves them, and are labelled “owner-reported, not verified”.</li>
      </ul>
      <h3>What the AI does, and does not do</h3>
      <p>An AI model reads your message into fields (budget, needs, which laptop) and may write short sentences from facts it is handed. It does not decide prices, specs, counts or verdicts: those come from stored data and fixed rules, and every answer is checked against the stored data again before you see it. If the AI is slow or unavailable I use a simpler reader and say so.</p>
      <h3>Words that are not in the data</h3>
      <p>Looks, design, “durable” and real battery life are not recorded. For those I show a stand-in (for example, how many owners praised the looks in reviews) and say it is only a guide.</p>
      <h3>Your privacy</h3>
      <ul>
        <li>What you type is sent to the server and, to be read, to Google’s Gemini model (or, when Gemini is busy, Anthropic’s Claude model). Phone numbers, emails and ID numbers are removed first. Only a laptop name and a topic are sent to the web search, never your text.</li>
        <li><strong>Pictures.</strong> If you add a picture, your device shrinks it (which also removes location details) and it is sent to Google’s Gemini AI (or, when Gemini is busy, Anthropic’s Claude) to be read. LapFit does not store it or keep it in the log. Please do not include faces, phone numbers or other people’s details.</li>
        <li><strong>Voice.</strong> Speaking to the app uses your browser’s speech service (Google, in Chrome), which may send your voice to its provider. LapFit never receives the audio. Reading answers aloud happens on your device.</li>
        <li><strong>Shop links.</strong> “Where to buy” links open a shop’s search page. Some may be affiliate links, which would be labelled, and may earn LapFit a small commission at no extra cost to you. Commission never changes what is shown or in what order. We count link opens without knowing who you are.</li>
        <li>We do not ask for your name or contact details. Your saved laptops and checklist ticks stay on this device.</li>
        <li><strong>Logs and what you type.</strong> To find and fix problems and to improve LapFit, the server saves, for 30 days, <strong>everything you type or tap</strong> (your messages, pasted listings, form choices, Sell answers and any experience you share), with a daily anonymous code and no name or address, along with what kind of request it was, how long each step took and whether anything failed. This text is saved as you typed it, so <strong>please do not type phone numbers, addresses or other personal details</strong>. Pictures are not saved. It is read only by the LapFit team, never sold, and removed after 30 days.</li>
        <li>This demo may use a free model plan, where inputs can be used by the provider to improve its products. Do not type personal information.</li>
      </ul>
      <h3>Follow-up questions</h3>
      <ul>
        <li>I remember only <strong>which laptop you are looking at</strong>, and which ones I showed you. I do not remember what you typed; that text is not part of this memory.</li>
        <li>I only answer about laptops. Anything else gets a polite no.</li>
        <li>I show where each part of an answer comes from: the catalog, owner reviews, or live web pages (which are not verified).</li>
        <li>I never promise how long a laptop will last, and I never tell you to buy. You can stop me asking about a laptop with the ✕ above the message box.</li>
      </ul>
      <h3>Limits</h3>
      <ul>
        <li>There are two tiers. Catalog laptops have dated prices and owner opinions. Laptops from the web are read from live pages and are not verified. Many weights, colours and hinge types are unknown, and an unknown value never counts as meeting a Must.</li>
        <li>Resale estimates use sample assumptions, not real sales.</li>
        <li>The dataset has no review dates or user types, so I cannot filter owners by “students” or “after 6 months”.</li>
        <li>If you send many requests quickly you may be asked to wait, or get the simpler reader without live web results.</li>
      </ul>
    </section>
  );
}
