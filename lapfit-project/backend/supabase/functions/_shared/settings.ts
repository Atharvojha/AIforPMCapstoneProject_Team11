import type { Tools } from './tools.ts';
import type { Settings } from './types.ts';
export async function loadSettings(tools: Tools): Promise<Settings> {
  return await tools.call<Settings>('settings', {});
}
