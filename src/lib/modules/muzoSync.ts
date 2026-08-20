import {
  getTracksMap,
  saveTracksMap,
  saveCollection,
  saveLists,
  getLists,
  getCollection,
  metaUpdater,
  rehydrateStores,
} from "@utils";
import { setStore, t } from "@stores";
import { getAuthToken, getStoredUser, muzoFetch, MuzoUser } from "./muzoAuth";

export interface MuzoSyncedSong {
  videoId: string;
  title: string;
  channelName?: string;
  thumbnail?: string;
  duration?: number | string;
  albumName?: string | null;
  albumId?: string | null;
  added_at?: string;
}

export interface MuzoSyncedPlaylist {
  id: number;
  name: string;
  description?: string;
  cover?: string;
  created_at?: string;
  song_count?: number;
  songs: MuzoSyncedSong[];
}

export interface MuzoSyncedArtist {
  browseId: string;
  name: string;
  thumbnail?: string;
  added_at?: string;
  db_id?: number;
}

export interface MuzoUserDataResponse {
  source?: string;
  user: MuzoUser;
  stats?: {
    history_count: number;
    favorites_count: number;
    playlists_count: number;
    followed_artists_count: number;
  };
  history?: MuzoSyncedSong[];
  favorites?: MuzoSyncedSong[];
  followedArtists?: MuzoSyncedArtist[];
  playlists?: MuzoSyncedPlaylist[];
}

let isPullingData = false;
let hasPulledOnStart = false;

export function isCloudSyncEnabled(): boolean {
  return Boolean(getAuthToken());
}

export async function pullMuzoUserData(force = false): Promise<{ success: boolean; message: string }> {
  if (!getAuthToken()) {
    return { success: false, message: "Not logged in" };
  }

  if (isPullingData) {
    return { success: true, message: "Sync in progress" };
  }

  if (hasPulledOnStart && !force) {
    return { success: true, message: "Already synced" };
  }

  isPullingData = true;
  setStore("syncState", "syncing");

  try {
    const res = await muzoFetch("/api/user/data");
    if (!res.ok) {
      setStore("syncState", "error");
      throw new Error(`Sync pull failed with status ${res.status}`);
    }

    hasPulledOnStart = true;
    const data: MuzoUserDataResponse = await res.json();
    const tracks = getTracksMap();

    // Save user if present
    if (data.user) {
      localStorage.setItem("muzo_user", JSON.stringify(data.user));
    }

    // 1. Process History
    if (Array.isArray(data.history)) {
      const historyIds: string[] = [];
      for (const song of data.history) {
        const id = song.videoId;
        if (!id) continue;
        historyIds.push(id);
        tracks[id] = {
          id,
          title: song.title || "Unknown Title",
          author: song.channelName || "",
          authorId: "",
          img: song.thumbnail || "",
          duration: typeof song.duration === "number" ? String(song.duration) : (song.duration || "0:00")
        };
      }
      saveCollection("history", historyIds);
    }

    // 2. Process Favorites
    if (Array.isArray(data.favorites)) {
      const favoriteIds: string[] = [];
      for (const song of data.favorites) {
        const id = song.videoId;
        if (!id) continue;
        favoriteIds.push(id);
        tracks[id] = {
          id,
          title: song.title || "Unknown Title",
          author: song.channelName || "",
          authorId: "",
          img: song.thumbnail || "",
          duration: typeof song.duration === "number" ? String(song.duration) : (song.duration || "0:00")
        };
      }
      saveCollection("favorites", favoriteIds);
    }

    // 3. Process Playlists
    if (Array.isArray(data.playlists)) {
      const userPlaylists: Playlist[] = [];
      const validPlKeys = new Set<string>();

      for (const pl of data.playlists) {
        const plCollectionKey = `pl_${pl.name}`;
        validPlKeys.add(plCollectionKey);
        validPlKeys.add(`pl_${pl.id}`);
        const plSongIds: string[] = [];

        if (Array.isArray(pl.songs)) {
          for (const s of pl.songs) {
            const sid = s.videoId;
            if (!sid) continue;
            plSongIds.push(sid);
            tracks[sid] = {
              id: sid,
              title: s.title || "Unknown Title",
              author: s.channelName || "",
              authorId: "",
              img: s.thumbnail || "",
              duration: typeof s.duration === "number" ? String(s.duration) : (s.duration || "0:00")
            };
          }
        }

        saveCollection(plCollectionKey, plSongIds);

        userPlaylists.push({
          id: String(pl.id),
          name: pl.name,
          img: pl.cover || "",
          author: data.user?.username || ""
        });
      }

      // Cleanup stale pl_* keys from localStorage
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('library_pl_')) {
          const plKey = key.slice(8);
          if (!validPlKeys.has(plKey)) {
            localStorage.removeItem(key);
          }
        }
      }

      saveLists("playlists", userPlaylists);
    }


    // 4. Process Followed Artists / Channels
    if (Array.isArray(data.followedArtists)) {
      const channels: Channel[] = data.followedArtists.map(a => ({
        id: a.browseId,
        name: a.name,
        img: a.thumbnail || ""
      }));
      saveLists("channels", channels);
    }

    saveTracksMap(tracks);
    rehydrateStores();
    setStore("syncState", "synced");
    return { success: true, message: t("sync_up_to_date") };
  } catch (err: any) {
    setStore("syncState", "error");
    return { success: false, message: err?.message || "Cloud sync error" };
  } finally {
    isPullingData = false;
  }
}

// Background sync push helpers for live actions

export async function syncTrackPlay(track: TrackItem) {
  if (!getAuthToken() || !track.id) return;
  try {
    let durationSec: number | string | undefined;
    if (track.duration) {
      if (typeof track.duration === "number") {
        durationSec = track.duration;
      } else {
        const parts = String(track.duration).split(":").map(Number);
        if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
        else if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else durationSec = track.duration;
      }
    }

    const payload = {
      videoId: track.id,
      title: track.title || "Unknown Title",
      channelName: track.author?.replace(" - Topic", "") || "Unknown Artist",
      thumbnail: track.img || `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`,
      duration: durationSec,
      album: undefined
    };

    const res = await muzoFetch("/api/history", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.warn("Failed to sync track history, status:", res.status);
    }
  } catch (e) {
    console.warn("Failed to sync track history", e);
  }
}

export async function syncFavoriteToggle(track: TrackItem, isFavorite: boolean) {
  if (!getAuthToken() || !track.id) return;
  try {
    if (isFavorite) {
      let durationSec: number | string | undefined;
      if (track.duration) {
        if (typeof track.duration === "number") {
          durationSec = track.duration;
        } else {
          const parts = String(track.duration).split(":").map(Number);
          if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
          else if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
          else durationSec = track.duration;
        }
      }

      const payload = {
        videoId: track.id,
        title: track.title || "Unknown Title",
        channelName: track.author?.replace(" - Topic", "") || "Unknown Artist",
        thumbnail: track.img || `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`,
        duration: durationSec,
        album: undefined
      };

      await muzoFetch("/api/favorites", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    } else {
      await muzoFetch(`/api/favorites/${encodeURIComponent(track.id)}`, {
        method: "DELETE"
      });
    }
  } catch (e) {
    console.warn("Failed to sync favorite toggle", e);
  }
}

export async function syncFollowArtist(artist: { browseId: string; name: string; thumbnail?: string }, follow: boolean) {
  if (!getAuthToken() || !artist.browseId) return;
  try {
    if (follow) {
      await muzoFetch("/api/artists/follow", {
        method: "POST",
        body: JSON.stringify(artist)
      });
    } else {
      await muzoFetch(`/api/artists/follow/${encodeURIComponent(artist.browseId)}`, {
        method: "DELETE"
      });
    }
  } catch (e) {
    console.warn("Failed to sync artist follow state", e);
  }
}

export async function syncCreatePlaylist(name: string, description = ""): Promise<Playlist | null> {
  const cleanName = name.trim();
  if (!cleanName) return null;

  let playlistId = Date.now().toString();
  let createdPlaylist: Playlist = {
    id: playlistId,
    name: cleanName,
    img: "",
    author: getStoredUser()?.username || ""
  };

  if (getAuthToken()) {
    try {
      const res = await muzoFetch("/api/playlists", {
        method: "POST",
        body: JSON.stringify({ name: cleanName, description })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.playlist?.id) {
          playlistId = String(data.playlist.id);
          createdPlaylist.id = playlistId;
          if (data.playlist.cover) createdPlaylist.img = data.playlist.cover;
        }
      } else {
        console.warn(`Failed to create playlist on cloud: status ${res.status}`);
      }
    } catch (e) {
      console.warn("Failed to sync create playlist", e);
    }
  }

  const playlists = getLists('playlists');
  if (!playlists.some(p => p.name === cleanName || String(p.id) === String(playlistId))) {
    playlists.push(createdPlaylist);
    saveLists('playlists', playlists);
  }

  saveCollection(`pl_${cleanName}`, []);
  metaUpdater(`pl_${cleanName}`);
  rehydrateStores();

  return createdPlaylist;
}

export async function syncAddSongToPlaylist(playlistIdOrName: string | number, track: TrackItem): Promise<boolean> {
  if (!track?.id) return false;

  const playlists = getLists('playlists');
  const matchedPl = playlists.find(p => String(p.id) === String(playlistIdOrName) || p.name === String(playlistIdOrName));
  const plName = matchedPl ? matchedPl.name : String(playlistIdOrName);
  const plId = matchedPl ? matchedPl.id : String(playlistIdOrName);

  // 1. Update local storage collection
  const plKey = `pl_${plName}`;
  const collection = getCollection(plKey);
  const tracks = getTracksMap();

  if (!collection.includes(track.id)) {
    collection.push(track.id);
    tracks[track.id] = {
      ...track,
      img: track.img || `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`
    };
    saveCollection(plKey, collection);
    saveTracksMap(tracks);
    metaUpdater(plKey);
    rehydrateStores();
  }

  // 2. Sync to cloud API if authenticated
  if (getAuthToken()) {
    try {
      let durationSec: number | string | undefined;
      if (track.duration) {
        if (typeof track.duration === "number") {
          durationSec = track.duration;
        } else {
          const parts = String(track.duration).split(":").map(Number);
          if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
          else if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
          else durationSec = track.duration;
        }
      }

      const payload = {
        videoId: track.id,
        title: track.title || "Unknown Title",
        channelName: track.author?.replace(" - Topic", "") || "Unknown Artist",
        thumbnail: track.img || `https://i.ytimg.com/vi/${track.id}/mqdefault.jpg`,
        duration: durationSec
      };

      const res = await muzoFetch(`/api/playlists/${encodeURIComponent(plId)}/songs`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        console.warn(`Failed to add song to cloud playlist: status ${res.status}`);
      }
    } catch (e) {
      console.warn("Failed to sync add song to playlist", e);
    }
  }

  return true;
}

export async function syncRemoveSongFromPlaylist(playlistIdOrName: string | number, videoId: string): Promise<boolean> {
  if (!videoId) return false;

  const playlists = getLists('playlists');
  const matchedPl = playlists.find(p => String(p.id) === String(playlistIdOrName) || p.name === String(playlistIdOrName));
  const plName = matchedPl ? matchedPl.name : String(playlistIdOrName);
  const plId = matchedPl ? matchedPl.id : String(playlistIdOrName);

  // 1. Update local collection
  const plKey = `pl_${plName}`;
  const collection = getCollection(plKey);
  const idx = collection.indexOf(videoId);
  if (idx !== -1) {
    collection.splice(idx, 1);
    saveCollection(plKey, collection);
    metaUpdater(plKey);
    rehydrateStores();
  }

  // 2. Sync to cloud API if authenticated
  if (getAuthToken()) {
    try {
      const res = await muzoFetch(`/api/playlists/${encodeURIComponent(plId)}/songs/${encodeURIComponent(videoId)}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        console.warn(`Failed to remove song from cloud playlist: status ${res.status}`);
      }
    } catch (e) {
      console.warn("Failed to sync remove song from playlist", e);
    }
  }

  return true;
}

export async function syncDeletePlaylist(id: string | number) {
  if (!id) return;
  const playlists = getLists('playlists');
  const matched = playlists.find(p => String(p.id) === String(id) || p.name === String(id));
  const plName = matched ? matched.name : String(id);
  const plId = matched ? matched.id : String(id);

  // Remove local playlist and collection
  const updatedPlaylists = playlists.filter(p => String(p.id) !== String(plId) && p.name !== plName);
  saveLists('playlists', updatedPlaylists);
  localStorage.removeItem(`library_pl_${plName}`);
  metaUpdater(`pl_${plName}`, true);
  rehydrateStores();

  if (getAuthToken()) {
    try {
      await muzoFetch(`/api/playlists/${encodeURIComponent(plId)}`, {
        method: "DELETE"
      });
    } catch (e) {
      console.warn("Failed to sync delete playlist", e);
    }
  }
}

export async function syncFetchPlaylists(): Promise<Playlist[]> {
  if (!getAuthToken()) return getLists('playlists');
  try {
    const res = await muzoFetch("/api/playlists");
    if (!res.ok) return getLists('playlists');
    const playlistsData: MuzoSyncedPlaylist[] = await res.json();
    if (Array.isArray(playlistsData)) {
      const userPlaylists: Playlist[] = [];
      const validPlKeys = new Set<string>();
      const tracks = getTracksMap();

      for (const pl of playlistsData) {
        const plCollectionKey = `pl_${pl.name}`;
        validPlKeys.add(plCollectionKey);
        validPlKeys.add(`pl_${pl.id}`);
        const plSongIds: string[] = [];

        if (Array.isArray(pl.songs)) {
          for (const s of pl.songs) {
            const sid = s.videoId;
            if (!sid) continue;
            plSongIds.push(sid);
            tracks[sid] = {
              id: sid,
              title: s.title || "Unknown Title",
              author: s.channelName || "",
              authorId: "",
              img: s.thumbnail || "",
              duration: typeof s.duration === "number" ? String(s.duration) : (s.duration || "0:00")
            };
          }
        }

        saveCollection(plCollectionKey, plSongIds);

        userPlaylists.push({
          id: String(pl.id),
          name: pl.name,
          img: pl.cover || "",
          author: getStoredUser()?.username || ""
        });
      }

      // Cleanup stale pl_* keys
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('library_pl_')) {
          const plKey = key.slice(8);
          if (!validPlKeys.has(plKey)) {
            localStorage.removeItem(key);
          }
        }
      }

      saveLists("playlists", userPlaylists);
      saveTracksMap(tracks);
      rehydrateStores();
      return userPlaylists;
    }
  } catch (e) {
    console.warn("Failed to fetch cloud playlists", e);
  }
  return getLists('playlists');
}



let syncDebounceTimer: NodeJS.Timeout | null = null;
export function scheduleMuzoSync() {
  if (!getAuthToken()) return;
  setStore("syncState", "dirty");
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    pullMuzoUserData();
    syncDebounceTimer = null;
  }, 10000);
}
