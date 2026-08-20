import { onMount, Show, For } from "solid-js";
import './Search.css';
import Results from './Results';
import Input from "./Input";
import { searchStore, t, navStore, setNavStore, setSearchStore, getSearchResults } from "@stores";
import { drawer, setDrawer } from "@utils";
import Filters from "./Filters";

export default function() {
  let searchRef!: HTMLElement;

  onMount(() => {
    setNavStore('search', 'ref', searchRef);
  });

  function toggleFullScreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  return (
    <section class="search" ref={searchRef}>
      <header class="sticky-bar">
        <p>{t('nav_search')}</p>

        <div class="right-group">
          <Show when={!matchMedia('(display-mode: standalone)').matches}>
            <i
              class="ri-fullscreen-line"
              aria-label={t('settings_fullscreen')}
              onclick={toggleFullScreen}
            ></i>
          </Show>
          <Show when={navStore.active !== 'settings'}>
            <i
              class="ri-settings-line"
              aria-label={t('nav_settings')}
              onclick={() => setNavStore('active', 'settings')}
            ></i>
          </Show>
        </div>
      </header>

      <form class="superInputContainer">
        <Input />
        <Filters />
      </form>

      <Show
        when={searchStore.query || searchStore.results.length > 0}
        fallback={
          <div class="searchEmptyState" style={{ "text-align": "center", "padding": "var(--size-6) var(--size-4)", "max-width": "480px", "margin": "0 auto" }}>
            
            {/* Recent Searches Section */}
            <Show when={drawer.recentSearches && drawer.recentSearches.length > 0}>
              <div style={{ "margin-bottom": "var(--size-6)", "text-align": "left" }}>
                <div style={{ "display": "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "var(--size-2)" }}>
                  <p style={{ "font-size": "0.88rem", "font-weight": "700", "color": "var(--text)", "opacity": "0.85", "margin": "0" }}>
                    <i class="ri-history-line" style={{ "margin-right": "6px" }}></i>
                    Recent Searches
                  </p>
                  <button
                    style={{
                      "background": "none",
                      "border": "none",
                      "color": "var(--text2)",
                      "font-size": "0.75rem",
                      "cursor": "pointer",
                      "opacity": "0.6"
                    }}
                    onclick={() => {
                      setDrawer('recentSearches', []);
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div style={{ "display": "flex", "flex-wrap": "wrap", "gap": "8px" }}>
                  <For each={[...drawer.recentSearches].reverse().slice(0, 10)}>
                    {(query) => (
                      <button
                        style={{
                          "background": "rgba(255, 255, 255, 0.06)",
                          "border": "1px solid rgba(255, 255, 255, 0.1)",
                          "color": "var(--text)",
                          "padding": "6px 14px",
                          "border-radius": "9999px",
                          "font-size": "0.82rem",
                          "cursor": "pointer",
                          "display": "inline-flex",
                          "align-items": "center",
                          "gap": "6px",
                          "transition": "all 0.2s ease"
                        }}
                        onclick={() => {
                          setSearchStore('suggestions', 'data', []);
                          setSearchStore('page', 1);
                          setSearchStore('results', []);
                          setSearchStore('query', query);
                          getSearchResults();
                        }}
                      >
                        <i class="ri-search-line" style={{ "font-size": "0.75rem", "opacity": "0.5" }}></i>
                        <span>{query}</span>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            <i class="ri-search-line" style={{ "font-size": "2.2rem", "margin-bottom": "var(--size-3)", "display": "block", "opacity": "0.4" }}></i>
            <p style={{ "font-size": "0.95rem", "font-weight": "600", "margin-bottom": "var(--size-2)", "color": "var(--text)" }}>
              Search for songs, videos, albums, artists, or playlists
            </p>
            <p style={{ "font-size": "0.8rem", "line-height": "1.4", "opacity": "0.55", "margin-bottom": "var(--size-4)" }}>
              This is a fork of ytify which uses the Muzo API for everything — an attempt to make it work properly and smoothly.
            </p>
            <a
              href="https://t.me/muzoapp"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                "display": "inline-flex",
                "align-items": "center",
                "gap": "6px",
                "font-size": "0.82rem",
                "color": "var(--text)",
                "background": "rgba(255, 255, 255, 0.06)",
                "border": "1px solid rgba(255, 255, 255, 0.12)",
                "padding": "6px 14px",
                "border-radius": "9999px",
                "text-decoration": "none",
                "transition": "all 0.2s ease"
              }}
            >
              <i class="ri-telegram-fill" style={{ "color": "#229ED9" }}></i>
              <span>@muzoapp</span>
            </a>
          </div>
        }
      >
        <Results />
      </Show>
    </section>
  );
}
