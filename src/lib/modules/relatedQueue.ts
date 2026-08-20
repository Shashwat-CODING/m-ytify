import { addToQueue, setQueueStore, playerStore, setStore } from "@stores";
import { getTracksMap, saveTracksMap } from "@utils";

export const MUZO_API_BASE_URL = "https://api.muzo.dpdns.org";

export interface MuzoRelatedSong {
  videoId: string;
  title: string;
  artist: string;
  thumbnail?: string;
  duration?: string;
}

export interface MuzoRelatedResponse {
  success: boolean;
  videoId: string;
  count: number;
  songs: MuzoRelatedSong[];
}

export async function fetchRelatedSongs(videoId: string, signal?: AbortSignal): Promise<TrackItem[]> {
  if (!videoId) return [];

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${MUZO_API_BASE_URL}/api/related?videoId=${encodeURIComponent(videoId)}`, { signal });
      if (!res.ok) {
        throw new Error(`Related fetch failed with HTTP ${res.status}`);
      }

      const data: MuzoRelatedResponse = await res.json();
      if (!data.success || !Array.isArray(data.songs)) {
        throw new Error("Invalid response format");
      }

      const tracksMap = getTracksMap();
      let hasNewTracks = false;

      const trackItems: TrackItem[] = data.songs.map((song) => {
        const id = song.videoId;
        const duration = song.duration || "0:00";
        const title = song.title || "Unknown Title";
        const author = song.artist || "Unknown Artist";
        const img = song.thumbnail || "";

        if (id && !tracksMap[id]) {
          tracksMap[id] = {
            id,
            title,
            author,
            authorId: "",
            duration,
            img
          };
          hasNewTracks = true;
        }

        return {
          id,
          title,
          author,
          authorId: "",
          duration,
          img,
          context: {
            src: "queue",
            id: `Related to ${playerStore.stream.title || "Song"}`
          }
        };
      });

      if (hasNewTracks) {
        saveTracksMap(tracksMap);
      }

      return trackItems;
    } catch (err: any) {
      if (err.name === "AbortError") return [];
      if (attempt === maxRetries) {
        console.warn(`Failed to fetch related songs after ${maxRetries} attempts:`, err);
        return [];
      }
      // Wait before retrying (250ms, 500ms)
      await new Promise(r => setTimeout(r, attempt * 250));
    }
  }

  return [];
}


export async function enqueueRelatedSongs(
  videoId: string,
  options: {
    replace?: boolean;
    skipFirst?: boolean;
    silent?: boolean;
  } = {}
): Promise<number> {
  if (!videoId) return 0;

  const { replace = false, skipFirst = true, silent = false } = options;

  setQueueStore("isLoading", true);
  try {
    const tracks = await fetchRelatedSongs(videoId);
    if (!tracks || tracks.length === 0) {
      if (!silent) setStore("snackbar", "No related songs found");
      return 0;
    }

    // First song in queue response is the one requested
    let candidateTracks = tracks;
    if (skipFirst && candidateTracks.length > 0) {
      if (candidateTracks[0].id === videoId || candidateTracks[0].id === playerStore.stream.id) {
        candidateTracks = candidateTracks.slice(1);
      }
    }

    if (candidateTracks.length === 0) {
      return 0;
    }

    if (replace) {
      setQueueStore("list", candidateTracks);
    } else {
      addToQueue(candidateTracks);
    }

    if (!silent) {
      setStore("snackbar", `Added ${candidateTracks.length} related songs to Queue`);
    }

    return candidateTracks.length;
  } finally {
    setQueueStore("isLoading", false);
  }
}
