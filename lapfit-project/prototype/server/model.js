// The only place that talks to the AI model. Runs on the server; the key never reaches the browser.
import { SETTINGS } from '../settings.js';

export const hasModelKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

export async function callModel({ system, user, image = null, temperature, maxTokens = 1500, signal }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('no_model_key');
  const content = [];
  if (image?.data && /^image\/(png|jpeg|webp|gif)$/.test(image.media_type)) {
    content.push({ type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } });
  }
  content.push({ type: 'text', text: user });
  const res = await fetch(process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: SETTINGS.MODEL, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw new Error(`model_http_${res.status}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (!text) throw new Error('model_empty');
  return text;
}

export function extractJson(text) {
  const t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no_json');
  return JSON.parse(t.slice(a, b + 1));
}
