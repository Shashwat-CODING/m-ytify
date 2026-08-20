import { For, Show, lazy, onMount, createSignal } from "solid-js";
import './Library.css';
import Collections from "./Collections";

import { getLibraryAlbums, getMeta, getLists, getTracksMap, getCollection } from "@utils";
import { t, setNavStore } from "@stores";
import ListItem from "@components/ListItem";
import Dropdown from "./Dropdown";

const Gallery = lazy(() => import('./Gallery'));
const SubFeed = lazy(() => import('./SubFeed'));


export default function() {
  const [showGallery, setShowGallery] = createSignal(false);
  const [showSubFeed, setShowSubFeed] = createSignal(false);
  let libraryRef!: HTMLElement;

  if (getMeta().version === 4)
    import('@modules/libraryMigratorV5').then(m => m.default());
  else
    onMount(() => {
      setNavStore('library', 'ref', libraryRef);
    });

  return (
    <section class="library" ref={libraryRef}>
      <header class="sticky-bar">
        <p>{t('nav_library')}</p>

        <div class="right-group">
          <i
            aria-label={t('hub_subfeed')}
            class={`ri-tv-${showSubFeed() ? 'fill' : 'line'}`}

            onclick={() => {
              setShowSubFeed(!showSubFeed());
              if (showSubFeed()) setShowGallery(false);
            }}
          ></i>

          <i
            aria-label={t('hub_gallery')}
            class="ri-user-heart-line"
            classList={{ 'ri-user-heart-fill': showGallery() }}
            onclick={() => {
              setShowGallery(!showGallery());
              if (showGallery()) setShowSubFeed(false);
            }}
          ></i>
        </div>

        <Dropdown />
      </header>

      <Show when={showGallery()}>
        <Gallery />
      </Show>
      <Show when={showSubFeed()}>
        <SubFeed />
      </Show>
      <Collections />
      <br />
      <Show when={getLibraryAlbums().length > 0}>
        <article>
          <p>
            <i class="ri-album-fill"></i>&nbsp;
            {t('library_albums')}
          </p>
          <div>
            <For each={getLibraryAlbums()}>
              {(item) =>
                <ListItem
                  name={item.name}
                  id={item.id}
                  img={item.img}
                  author={item.author}
                  type='album'
                />
              }
            </For>
          </div>
        </article>
      </Show>
      <br />

      <Show when={getLists('playlists').length > 0}>
        <article class="library-playlists-article">
          <p>
            <i class='ri-play-list-line'></i>&nbsp;
            {t('library_playlists')}
          </p>
          <div class="libraryPlaylistsGrid">
            <For each={getLists('playlists')}>
              {(item) => {
                const tracks = getTracksMap();
                let cover = item.img;
                if (!cover) {
                  const plSongs = getCollection(`pl_${item.name}`) || getCollection(item.id) || getCollection(item.name);
                  if (plSongs.length > 0 && tracks[plSongs[0]]) {
                    cover = tracks[plSongs[0]].img || "";
                  }
                }
                return (
                  <ListItem
                    name={item.name}
                    id={item.id}
                    img={cover}
                    author={item.author}
                    type='playlist'
                  />
                );
              }}
            </For>
          </div>
        </article>
      </Show>

      <br />

    </section>
  );
}
