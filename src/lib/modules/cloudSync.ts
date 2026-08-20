import {
  pullMuzoUserData,
  isCloudSyncEnabled,
  scheduleMuzoSync,
  syncTrackPlay,
  syncFavoriteToggle,
  syncFollowArtist,
  syncCreatePlaylist,
  syncAddSongToPlaylist,
  syncRemoveSongFromPlaylist,
  syncDeletePlaylist,
  syncFetchPlaylists
} from "./muzoSync";
import { getAuthToken } from "./muzoAuth";

export async function runSync(token = getAuthToken()) {
  if (!token) return { success: false, message: "No auth token" };
  return pullMuzoUserData();
}

export function scheduleSync() {
  scheduleMuzoSync();
}

export function addDirtyTrack(_id?: string) {
  // Synchronized seamlessly via muzoSync
}

export function removeDirtyTrack(_id?: string) {
  // Synchronized seamlessly via muzoSync
}

export {
  pullMuzoUserData,
  isCloudSyncEnabled,
  scheduleMuzoSync,
  syncTrackPlay,
  syncFavoriteToggle,
  syncFollowArtist,
  syncCreatePlaylist,
  syncAddSongToPlaylist,
  syncRemoveSongFromPlaylist,
  syncDeletePlaylist,
  syncFetchPlaylists
};