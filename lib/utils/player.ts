import { playerStore, setPlayerStore, setStore, store } from "@stores";
import { config, convertSStoHHMMSS, streamCache } from "@utils";
import { isQueuePrefetchActive } from "../modules/queuePrefetch";

let playerAbortController: AbortController;
export async function player(id?: string) {

  if (playerAbortController)
    playerAbortController.abort();

  playerAbortController = new AbortController();

  if (!id) return;

  const enforceVideo = !playerStore.isMusic && playerStore.isWatching;

  if (!enforceVideo)
    setPlayerStore({
      playbackState: 'loading',
      status: 'Loading Audio...'
    });


  if (!enforceVideo) {
    try {
      const { fetchPrimaryStream, playPrimaryStream } = await import('../modules/primaryStream');
      const primaryData = await fetchPrimaryStream(id, playerAbortController.signal);
      if (primaryData) {
        const played = await playPrimaryStream(primaryData);
        if (played) {
          if (!enforceVideo && !isQueuePrefetchActive()) {
            import('../modules/relatedQueue')
              .then(m => m.enqueueRelatedSongs(id, { skipFirst: true, silent: true }))
              .catch(() => {});
          }
          return;
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        console.warn('Primary stream fetch failed, falling back to default stream', e);
      }
    }


  }


  setPlayerStore('isLossless', false);

  if (!store.useSaavn)
    setStore('useSaavn', true);
  else if (playerStore.stream.author?.endsWith('Topic') && !streamCache.get(id))
    return import('../modules/jioSaavn').then(mod => mod.default());

  const getStreamData = await import('@modules/getStreamData').then(mod => mod.default);
  const data = await getStreamData(id, playerAbortController.signal);

  if (data && 'adaptiveFormats' in data)
    setPlayerStore({
      data,
      fullDuration: data.lengthSeconds
    });
  else {
    const errorData = data as Record<'error' | 'message', string>;
    setPlayerStore({
      playbackState: 'none',
      status: errorData.message || errorData.error || 'Loading Audio Failed'
    });
    setStore('snackbar', playerStore.status);
    return;
  }

  const invidiousData = data as Invidious;

  await import('../modules/setMetadata')
    .then(mod => mod.default({
      id,
      title: invidiousData.title,
      author: invidiousData.author,
      duration: convertSStoHHMMSS(invidiousData.lengthSeconds),
      authorId: invidiousData.authorId
    }));

  import('../modules/setAudioStreams')
    .then(mod => mod.default(
      invidiousData.adaptiveFormats
        .filter(f => f.type.startsWith('audio'))
        .sort((a, b) => (parseInt(a.bitrate) - parseInt(b.bitrate)))
    ));


  if (config.similarContent && !enforceVideo && !isQueuePrefetchActive()) {
    import('../modules/relatedQueue')
      .then(m => m.enqueueRelatedSongs(id, { silent: true }))
      .catch(() => {});
  }


}


