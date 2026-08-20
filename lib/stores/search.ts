import { createStore } from 'solid-js/store';
import { config, drawer, setDrawer } from '@utils';
import { updateParam, setStore } from '@stores';

const createInitialState = () => ({
  query: '',
  results: [] as (YTItem | YTListItem)[],
  isLoading: false,
  page: 1,
  suggestions: {
    data: [] as string[],
    index: -1,
    controller: new AbortController()
  },
  observer: { disconnect() { } } as IntersectionObserver
});

export const [searchStore, setSearchStore] = createStore(createInitialState());

let suggestionTimeout: ReturnType<typeof setTimeout> | undefined;
let lastQuery = '';
const DEBOUNCE_TIME = 400;

export function resetSearch() {
  searchStore.observer.disconnect();
  setSearchStore(createInitialState());
  updateParam('q');
  updateParam('f');
}

export function getSearchSuggestions(text: string) {
  searchStore.suggestions.controller.abort();
  clearTimeout(suggestionTimeout);

  if (text.length < 3) {
    setSearchStore('suggestions', 'data', []);
    lastQuery = '';
    return;
  }

  if (text === lastQuery) return;

  suggestionTimeout = setTimeout(() => {
    lastQuery = text;
    setSearchStore('page', 1);
    setSearchStore('suggestions', 'index', -1);

    const newController = new AbortController();
    setSearchStore('suggestions', 'controller', newController);

    const isMusic = ['song', 'artist', 'album'].includes(config.searchFilter);
    const url = `/search-suggestions?q=${encodeURIComponent(text)}&music=${isMusic}`;

    fetch(url, { signal: newController.signal })
      .then(res => res.json() as Promise<string[]>)
      .then(data => {
        setSearchStore('suggestions', 'data', data);
      })
      .catch(e => {
        if (e.name === 'AbortError') return;
        setStore('snackbar', e.message);
        setSearchStore('suggestions', 'data', []);
      });
  }, DEBOUNCE_TIME);
}

export async function getSearchResults(force = false) {
  const { query, results, isLoading } = searchStore;
  let searchFilter = config.searchFilter;

  // Normalize filter to strictly supported list: songs, videos, albums, artists, playlists
  const validFilters = ['songs', 'videos', 'albums', 'artists', 'playlists'];
  if (!validFilters.includes(searchFilter)) {
    if (searchFilter === 'song' || searchFilter === 'all') searchFilter = 'songs';
    else if (searchFilter === 'album') searchFilter = 'albums';
    else if (searchFilter === 'artist') searchFilter = 'artists';
    else if (searchFilter === 'playlist') searchFilter = 'playlists';
    else searchFilter = 'songs';
  }

  if (!query || (isLoading && !force)) return;
  if (!force && results.length > 0) return;

  setSearchStore('isLoading', true);
  searchStore.suggestions.controller.abort();
  setSearchStore('suggestions', 'data', []);
  searchStore.observer.disconnect();

  const { recentSearches } = drawer;
  const lc = query.trim().toLowerCase();

  if (config.saveRecentSearches && lc && !lc.includes(' ') && !lc.includes(',')) {
    if (recentSearches.includes(lc)) {
      recentSearches.splice(recentSearches.indexOf(lc), 1);
    }
    recentSearches.push(lc);

    while (recentSearches.length > 7)
      recentSearches.shift();

    setDrawer('recentSearches', recentSearches);
  }

  const url = `https://api.muzo.dpdns.org/api/search?q=${encodeURIComponent(query)}&filter=${searchFilter}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (!data || !Array.isArray(data.results)) {
        setSearchStore('results', []);
        return;
      }

      const formattedResults: (YTItem | YTListItem)[] = data.results.map((item: any) => {
        const thumbUrl = item.thumbnails?.[item.thumbnails.length - 1]?.url || item.thumbnails?.[0]?.url || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg` : '');
        const artistName = item.artists?.map((a: any) => a.name).filter(Boolean).join(", ") || item.channelName || "";
        const durationStr = item.duration || (item.duration_seconds ? `${Math.floor(item.duration_seconds / 60)}:${String(item.duration_seconds % 60).padStart(2, '0')}` : "0:00");

        if (searchFilter === 'songs' || searchFilter === 'videos' || item.resultType === 'song' || item.resultType === 'video' || item.videoId) {
          const trackItem: YTItem = {
            id: item.videoId || '',
            title: item.title || '',
            author: artistName,
            authorId: item.artists?.[0]?.id || '',
            duration: durationStr,
            img: thumbUrl,
            albumId: typeof item.album === 'object' ? item.album?.id : (item.browseId || undefined),
            subtext: item.album ? (typeof item.album === 'object' ? item.album.name : item.album) : (item.views || undefined),
            type: (item.resultType === 'video' || searchFilter === 'videos') ? 'video' : 'song'
          };
          return trackItem;
        }

        if (searchFilter === 'albums' || item.resultType === 'album') {
          const albumItem: YTAlbumItem = {
            id: item.browseId || item.id || '',
            name: item.title || '',
            img: thumbUrl,
            type: 'album',
            author: artistName,
            year: item.year || ''
          };
          return albumItem;
        }

        if (searchFilter === 'artists' || item.resultType === 'artist') {
          const artistItem: YTArtistItem = {
            id: item.browseId || item.id || '',
            name: item.title || '',
            img: thumbUrl,
            type: 'artist',
            subscribers: item.subscribers || ''
          };
          return artistItem;
        }

        // playlists
        const playlistItem: YTPlaylistItem = {
          id: item.browseId || item.id || '',
          name: item.title || '',
          img: thumbUrl,
          type: 'playlist',
          author: artistName,
          videoCount: item.views || ''
        };
        return playlistItem;
      });

      setSearchStore('results', formattedResults);
    })
    .catch(e => {
      setStore('snackbar', e.message);
      setSearchStore('results', []);
    })
    .finally(() => {
      setSearchStore('isLoading', false);
    });

  updateParam('q', query);
  updateParam('f', searchFilter);
}
