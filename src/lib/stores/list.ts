import { createStore } from "solid-js/store";
import { setNavStore, updateParam, setStore, store, navStore } from "@stores";
import { drawer } from "@utils";

const initialState = () => ({
  isLoading: false,
  isSubscribed: false,
  isSortable: false,
  isReversed: false,
  isShared: false,
  list: [] as YTItem[],
  length: 0,
  reservedCollections: ['history', 'favorites', 'liked', 'listenLater', 'channels', 'playlists'],
  name: '',
  url: '',
  type: 'collection' as 'channels' | 'playlists' | 'collection' | 'album',
  id: '',
  page: 1,
  author: '',
  img: '',
  hasContinuation: false,
  artistAlbums: [] as YTAlbumItem[],
  observer: { disconnect() { } } as IntersectionObserver
});

export const [listStore, setListStore] = createStore(initialState());
export async function getList(
  id: string,
  type: 'playlist' | 'channel' | 'album' | 'artist',
  all?: boolean
) {

  setListStore('hasContinuation', false);

  setListStore('isLoading', true);
  setNavStore('active', 'list');

  if (!all) updateParam(type, id);

  // Check if this is a user synced / custom playlist first
  const { getCollection, getTracksMap, getLists } = await import('@utils');
  const userPlaylists = getLists('playlists');
  const matchedPl = userPlaylists.find(p => String(p.id) === String(id) || p.name === id);

  if (matchedPl) {
    const plSongs = getCollection(`pl_${matchedPl.name}`) || getCollection(matchedPl.id) || getCollection(matchedPl.name);
    if (plSongs && plSongs.length > 0) {
      const tracksMap = getTracksMap();
      const items: YTItem[] = plSongs.map(sid => {
        const t = tracksMap[sid];
        if (!t) return null;
        return {
          id: sid,
          title: t.title,
          author: t.author,
          authorId: t.authorId,
          duration: t.duration,
          img: t.img,
          context: { src: 'playlists' as Context, id: matchedPl.name }
        };
      }).filter(Boolean) as YTItem[];

      if (items.length > 0) {
        setListStore({
          name: matchedPl.name,
          img: matchedPl.img || items[0]?.img || '',
          id: String(matchedPl.id),
          author: matchedPl.author || '',
          type: 'playlists',
          url: String(matchedPl.id),
          hasContinuation: false,
          list: items,
          isLoading: false
        });
        return;
      }
    }
  }

  try {
    const res = await fetch(`${store.api}/${type}?id=${id}${all ? '&all=true' : ''}`);
    if (!res.ok) throw new Error(`Failed to fetch ${type}`);
    const data = await res.json() as YTListItem;

    if (data.type === 'artist') {
      const artist = data as YTArtistItem;
      const contextId = 'Artist - ' + artist.name;
      setListStore({
        name: contextId,
        id: id,
        type: 'channels',
        url: id,
        img: artist.img,
        list: (artist.items || []).map(v => ({
          ...v,
          author: v.author.endsWith(' - Topic') ? v.author : `${v.author} - Topic`,
          context: { src: 'channels' as const, id: contextId }
        }) as YTItem),
        artistAlbums: artist.albums
      });
    } else {
      const listData = data as (YTPlaylistItem | YTChannelItem | YTAlbumItem);
      const isChannel = data.type === 'channel';
      const listType = isChannel ? 'channels' : (data.type === 'album' ? 'album' : 'playlists');

      setListStore({
        name: listData.name,
        img: listData.img,
        id: id,
        author: 'author' in listData ? (listData as YTPlaylistItem | YTAlbumItem).author || '' : listData.name,
        type: listType,
        url: id,
        hasContinuation: 'hasContinuation' in listData ? (listData as YTPlaylistItem).hasContinuation : false,
        list: (listData.items || []).map(v => ({
          ...v,
          author: (data.type === 'album' && !v.author.endsWith(' - Topic')) ? `${v.author} - Topic` : v.author,
          context: { src: listType as Context, id: listData.name }
        }) as YTItem)
      });
    }
  } catch (e) {
    setStore('snackbar', e instanceof Error ? e.message : 'Unknown error');
    resetList();
  }

  setListStore('isLoading', false);
}

export function resetList() {
  if (navStore.active === 'list') {
    setNavStore('active', drawer.lastMainFeature || 'home');
  }
  listStore.observer.disconnect();

  updateParam('collection');
  updateParam('playlist');
  updateParam('channel');
  updateParam('artist');
  updateParam('album');
  setListStore(initialState());
}

export function loadAll() {
  const { id, type } = listStore;
  if (type === 'playlists') {
    getList(id, 'playlist', true);
  }
}
