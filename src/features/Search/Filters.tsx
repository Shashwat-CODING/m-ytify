import { getSearchResults, searchStore, setSearchStore, updateParam } from "@stores";
import { config, setConfig } from "@utils";

export default function() {

  return (
    <select
      class="searchFilters"
      onchange={(e) => {
        const { value } = e.target;
        searchStore.observer.disconnect();
        setSearchStore({
          page: 1,
          results: [],
        });
        setConfig('searchFilter', value);
        updateParam('f', value);

        getSearchResults();

      }}
      value={['songs', 'videos', 'albums', 'artists', 'playlists'].includes(config.searchFilter) ? config.searchFilter : 'songs'}
    >
      <option value="songs">Songs</option>
      <option value="videos">Videos</option>
      <option value="albums">Albums</option>
      <option value="artists">Artists</option>
      <option value="playlists">Playlists</option>
    </select>
  );
}
