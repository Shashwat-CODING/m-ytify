import { addToCollection, getCollection, getCollectionsKeys, removeFromCollection, getLists } from '@utils';
import { setStore, t } from '@stores';
import { syncCreatePlaylist, syncAddSongToPlaylist, syncRemoveSongFromPlaylist, syncFetchPlaylists } from '@modules/cloudSync';
import { For, Show, onMount, createSignal } from 'solid-js';

interface SelectorItem {
  key: string;
  name: string;
  type: 'playlist' | 'collection';
}

export default function(_: {
  close?: () => void,
  data: TrackItem[]
}) {
  const [playlistsTick, setPlaylistsTick] = createSignal(0);

  onMount(() => {
    syncFetchPlaylists().then(() => {
      setPlaylistsTick(t => t + 1);
    }).catch(() => {});
  });

  const handleCollectionChange = async (e: Event & { target: HTMLSelectElement }) => {
    const { value } = e.target;
    if (!value) return;

    const isNew = value === '+cl';

    if (isNew) {
      const title = prompt('Playlist Name ?')?.trim();
      if (title) {
        const pl = await syncCreatePlaylist(title);
        if (_.data && _.data.length > 0) {
          for (const item of _.data) {
            await syncAddSongToPlaylist(pl?.id || title, item);
          }
        }
        setStore('snackbar', `Added to ${title}`);
      }
    } else if (value.startsWith('pl:')) {
      const plId = value.slice(3);
      const userPlaylists = getLists('playlists');
      const matched = userPlaylists.find(p => String(p.id) === plId || p.name === plId);
      const plName = matched ? matched.name : plId;

      if (_.data && _.data.length > 0) {
        for (const item of _.data) {
          await syncAddSongToPlaylist(plId, item);
        }
      }
      setStore('snackbar', `Added to ${plName}`);
    } else if (value.startsWith('-pl:')) {
      const plId = value.slice(4);
      const userPlaylists = getLists('playlists');
      const matched = userPlaylists.find(p => String(p.id) === plId || p.name === plId);
      const plName = matched ? matched.name : plId;

      if (_.data && _.data.length > 0) {
        for (const item of _.data) {
          await syncRemoveSongFromPlaylist(plId, item.id);
        }
      }
      setStore('snackbar', `Removed from ${plName}`);
    } else if (value.startsWith('cl:')) {
      const clName = value.slice(3);
      if (_.data && _.data.length > 0) {
        addToCollection(clName, _.data);
      }
      setStore('snackbar', `Added to ${clName}`);
    } else if (value.startsWith('-cl:') || value.startsWith('-cl')) {
      const clName = value.startsWith('-cl:') ? value.slice(4) : value.slice(3);
      if (_.data && _.data.length > 0) {
        removeFromCollection(clName, _.data.map(d => d.id));
      }
      setStore('snackbar', `Removed from ${clName}`);
    } else {
      // Legacy fallback
      if (_.data && _.data.length > 0) {
        addToCollection(value, _.data);
      }
      setStore('snackbar', `Added to ${value}`);
    }

    if (_.close)
      _.close();
    e.target.selectedIndex = 0;
  };

  const getAvailableItems = (add: boolean): SelectorItem[] => {
    // depend on playlistsTick for re-rendering after background fetch
    playlistsTick();

    if (!_.data || _.data.length === 0) {
      return [];
    }

    const firstTrackId = _.data[0].id;
    const items: SelectorItem[] = [];
    const seenNames = new Set<string>();

    // 1. User playlists from backend / local sync
    const userPlaylists = getLists('playlists');
    for (const pl of userPlaylists) {
      if (!pl.name || seenNames.has(pl.name)) continue;
      seenNames.add(pl.name);

      const plSongs = getCollection(`pl_${pl.name}`) || getCollection(pl.id) || getCollection(pl.name);
      const isIncluded = plSongs.includes(firstTrackId);
      if (add ? !isIncluded : isIncluded) {
        items.push({
          key: (add ? 'pl:' : '-pl:') + (pl.id || pl.name),
          name: pl.name,
          type: 'playlist'
        });
      }
    }

    // 2. Custom Collections (excluding reserved system collections like history, favorites, liked)
    const collectionKeys = getCollectionsKeys();
    const reservedToSkip = ['history', 'favorites', 'liked'];
    for (const k of collectionKeys) {
      if (reservedToSkip.includes(k) || seenNames.has(k)) continue;
      seenNames.add(k);

      const isIncluded = getCollection(k).includes(firstTrackId);
      if (add ? !isIncluded : isIncluded) {
        items.push({
          key: (add ? 'cl:' : '-cl:') + k,
          name: k === 'listenLater' ? t('library_listen_later') : k,
          type: 'collection'
        });
      }
    }

    return items;
  };


  return (
    <select
      class="ri-play-list-add-fill"
      id="collectionSelector"
      onchange={handleCollectionChange}
      aria-label={t('collection_selector_add_to')}
    >
      <option value="" selected disabled>&#xf00e;</option>
      <option value="+cl">{t('collection_selector_create_new')}</option>

      <Show when={getAvailableItems(true).length > 0}>
        <optgroup label="Add to Playlist">
          <For each={getAvailableItems(true)}>
            {(item) => <option value={item.key}>{item.name}</option>}
          </For>
        </optgroup>
      </Show>

      <Show when={getAvailableItems(false).length > 0}>
        <optgroup label="Remove from Playlist">
          <For each={getAvailableItems(false)}>
            {(item) => <option value={item.key}>{item.name}</option>}
          </For>
        </optgroup>
      </Show>
    </select>
  );
}
