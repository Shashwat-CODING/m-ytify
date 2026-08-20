import { setStore, playerStore, setPlayerStore } from '@stores';
import { streamCache } from '@utils';

export default function(
  audio: HTMLAudioElement | HTMLVideoElement,
  prefetch = ''
) {
  audio.pause();

  if (!audio.src || audio.src === location.href) return;

  const isFallback = audio.src.endsWith('&fallback');
  const id = prefetch || playerStore.stream.id;

  if (isFallback) {
    if (!playerStore.isWatching && !prefetch) {
      setStore('snackbar', 'Error 403 : Unauthenticated Stream');
      setPlayerStore('playbackState', 'none');
    }
    streamCache.remove(id);
    return;
  }

  // No proxy fallback — report failure and clear cache
  if (!prefetch) {
    setPlayerStore({
      playbackState: 'none',
      status: 'Streaming Failed'
    });
    setStore('snackbar', 'Streaming Failed');
  }
  streamCache.remove(id);
}
