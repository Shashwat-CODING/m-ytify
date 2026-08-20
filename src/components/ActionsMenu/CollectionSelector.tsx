import { addToCollection, getCollection, getCollectionsKeys, removeFromCollection, getLists } from '@utils';
import { setStore, t } from '@stores';
import { syncCreatePlaylist, syncAddSongToPlaylist, syncRemoveSongFromPlaylist, syncFetchPlaylists } from '@modules/cloudSync';
import { For, Show, onMount, createSignal, createMemo } from 'solid-js';

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
      setPlaylistsTick(n => n + 1);
    }).catch(() => {});
  });

  const handleCollectionChange = async (e: Event & { target: HTMLSelectElement }) => {
    const { value } = e.target;
    if (!value) return;

    if (value === '+cl') {
      const title = prompt('Playlist Name ?')?.trim();
      if (title) {
        const pl = await syncCreatePlaylist(title);
        if (_.data?.length > 0) {
          for (const item of _.data) {
            await syncAddSongToPlaylist(pl?.id || title, item);
          }
        }
        setStore('snackbar', `Added to ${title}`);
        setPlaylistsTick(n => n + 1);
      }
    } else if (value.startsWith('pl:')) {
      const plId = value.slice(3);
      const matched = getLists('playlists').find(p => String(p.id) === plId || p.name === plId);
      if (_.data?.length > 0) {
        for (const item of _.data) await syncAddSongToPlaylist(plId, item);
      }
      setStore('snackbar', `Added to ${matched?.name ?? plId}`);
    } else if (value.startsWith('-pl:')) {
      const plId = value.slice(4);
      const matched = getLists('playlists').find(p => String(p.id) === plId || p.name === plId);
      if (_.data?.length > 0) {
        for (const item of _.data) await syncRemoveSongFromPlaylist(plId, item.id);
      }
      setStore('snackbar', `Removed from ${matched?.name ?? plId}`);
    } else if (value.startsWith('cl:')) {
      const clName = value.slice(3);
      if (_.data?.length > 0) addToCollection(clName, _.data);
      setStore('snackbar', `Added to ${clName}`);
    } else if (value.startsWith('-cl:')) {
      const clName = value.slice(4);
      if (_.data?.length > 0) removeFromCollection(clName, _.data.map(d => d.id));
      setStore('snackbar', `Removed from ${clName}`);
    } else {
      if (_.data?.length > 0) addToCollection(value, _.data);
      setStore('snackbar', `Added to ${value}`);
    }

    if (_.close) _.close();
    e.target.selectedIndex = 0;
  };

  const buildItems = (add: boolean): SelectorItem[] => {
    if (!_.data || _.data.length === 0) return [];
    const firstTrackId = _.data[0].id;
    const items: SelectorItem[] = [];
    const seen = new Set<string>();

    for (const pl of getLists('playlists')) {
      if (!pl.name || seen.has(pl.name)) continue;
      seen.add(pl.name);
      const plSongs = getCollection(`pl_${pl.name}`) || getCollection(pl.id) || getCollection(pl.name);
      const inList = plSongs.includes(firstTrackId);
      if (add ? !inList : inList) {
        items.push({ key: (add ? 'pl:' : '-pl:') + (pl.id || pl.name), name: pl.name, type: 'playlist' });
      }
    }

    const reserved = new Set(['history', 'favorites', 'liked']);
    for (const k of getCollectionsKeys()) {
      if (reserved.has(k) || seen.has(k)) continue;
      seen.add(k);
      const inList = getCollection(k).includes(firstTrackId);
      if (add ? !inList : inList) {
        items.push({ key: (add ? 'cl:' : '-cl:') + k, name: k === 'listenLater' ? t('library_listen_later') : k, type: 'collection' });
      }
    }
    return items;
  };

  // createMemo ensures reactivity tracks playlistsTick() signal
  const addItems = createMemo<SelectorItem[]>(() => { playlistsTick(); return buildItems(true); });
  const removeItems = createMemo<SelectorItem[]>(() => { playlistsTick(); return buildItems(false); });

  return (
    <select
      class="ri-play-list-add-fill"
      id="collectionSelector"
      onchange={handleCollectionChange}
      aria-label={t('collection_selector_add_to')}
    >
      <option value="" selected disabled>&#xf00e;</option>
      <option value="+cl">{t('collection_selector_create_new')}</option>

      <Show when={addItems().length > 0}>
        <optgroup label="Add to Playlist">
          <For each={addItems()}>
            {(item) => <option value={item.key}>{item.name}</option>}
          </For>
        </optgroup>
      </Show>

      <Show when={removeItems().length > 0}>
        <optgroup label="Remove from Playlist">
          <For each={removeItems()}>
            {(item) => <option value={item.key}>{item.name}</option>}
          </For>
        </optgroup>
      </Show>
    </select>
  );
}
