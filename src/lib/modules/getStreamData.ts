import { setPlayerStore } from '@stores';
import { streamCache } from '@utils';

const STREAM_API = 'https://mlc-ytify.kouzu.in';

export default async function(
  id: string,
  signal?: AbortSignal
): Promise<Invidious | Record<'error' | 'message', string>> {

  const cached = streamCache.get(id) as Invidious;
  if (cached) return cached;

  try {
    const res = await fetch(`${STREAM_API}/api/v1/videos/${id}`, {
      headers: { 'Accept': 'application/json' },
      signal
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    if (!data || !Array.isArray(data.adaptiveFormats)) {
      throw new Error(data?.error || 'Invalid response: adaptiveFormats missing');
    }

    if (!data.adaptiveFormats.some((f: { type: string }) => f.type.startsWith('audio'))) {
      throw new Error('No audio streams found');
    }

    const invidiousData = data as Invidious;
    // No proxy — direct URL usage
    invidiousData.proxy = '';
    setPlayerStore('proxy', '');
    streamCache.set(id, invidiousData);
    return invidiousData;

  } catch (e) {
    console.error('getStreamData failed:', e);
    return { error: 'Stream fetch failed', message: (e as Error).message };
  }
}
