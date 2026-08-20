import { playerStore, setPlayerStore, updateParam } from "@stores";
import { config } from "@utils";

export interface PrimaryStreamData {
  id: string;
  name: string;
  artist: string;
  url: string;
  lossless?: string;
}

export async function fetchPrimaryStream(rawId: string, signal?: AbortSignal): Promise<PrimaryStreamData | null> {
  if (!rawId) return null;
  const id = rawId.length > 11 ? rawId.slice(0, 11) : rawId;
  const endpoints = [
    `https://mlc-ytify.kouzu.in/api/stream?id=${encodeURIComponent(id)}`,
    `https://shashwatidr-filestore.hf.space/api/stream?id=${encodeURIComponent(id)}`
  ];


  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { signal });
      if (!res.ok) continue;
      const data: PrimaryStreamData = await res.json();
      if (data && (data.url || data.lossless)) {
        return data;
      }
    } catch {
      continue;
    }
  }
  return null;
}


export async function playPrimaryStream(streamData: PrimaryStreamData, forceLossless?: boolean): Promise<boolean> {
  const { audio } = playerStore;
  const wantLossless = forceLossless !== undefined ? forceLossless : Boolean(config.preferLossless);
  const streamUrl = (wantLossless && streamData.lossless) ? streamData.lossless : streamData.url;

  if (!streamUrl) return false;

  const title = streamData.name || playerStore.stream.title || '';
  const author = streamData.artist || playerStore.stream.author || '';

  const existingImg = playerStore.stream.img || '';

  setPlayerStore({
    isLossless: Boolean(wantLossless && streamData.lossless),
    data: streamData,
    stream: {
      id: streamData.id,
      title,
      author,
      duration: playerStore.stream.duration || '',
      authorId: playerStore.stream.authorId || '',
      img: existingImg,
      context: playerStore.stream.context
    }
  });

  await import('./setMetadata')
    .then(mod => mod.default({
      id: streamData.id,
      title,
      author,
      duration: playerStore.stream.duration || '',
      authorId: playerStore.stream.authorId || '',
      img: existingImg
    }));

  delete audio.dataset.retried;
  audio.src = streamUrl;
  updateParam('s', streamData.id);

  // Directly record to collection and sync to history API
  const trackObj: TrackItem = {
    id: streamData.id,
    title,
    author,
    duration: playerStore.stream.duration || '',
    authorId: playerStore.stream.authorId || '',
    img: existingImg
  };

  try {
    const { addToCollection } = await import('@utils');
    addToCollection('history', [trackObj]);
  } catch (e) {
    console.warn("addToCollection history error:", e);
  }

  try {
    const { syncTrackPlay } = await import('./muzoSync');
    syncTrackPlay(trackObj);
  } catch (e) {
    console.warn("syncTrackPlay error:", e);
  }

  return true;
}
