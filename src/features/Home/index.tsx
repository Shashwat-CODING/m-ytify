import { createSignal, onMount, For, Show } from "solid-js";
import { getStoredUser, getAuthToken, isGuestUser, logout, MuzoUser } from "@modules/muzoAuth";
import { getCollection, getTracksMap, getLists, fetchCollection } from "@utils";
import { setNavStore } from "@stores";
import StreamItem from "@components/StreamItem";
import ListItem from "@components/ListItem";
import AuthModal from "@components/AuthModal";
import "./Home.css";

export default function Home() {
  const [user, setUser] = createSignal<MuzoUser | null>(getStoredUser());
  const [showAccountMenu, setShowAccountMenu] = createSignal(false);

  onMount(() => {
    setUser(getStoredUser());
  });

  const getRecentHistoryTracks = () => {
    const historyIds = getCollection("history").slice(0, 20);
    const tracks = getTracksMap();
    return historyIds.map(id => tracks[id]).filter(Boolean);
  };

  const getFavoriteTracks = () => {
    const favoriteIds = getCollection("favorites").slice(0, 20);
    const tracks = getTracksMap();
    return favoriteIds.map(id => tracks[id]).filter(Boolean);
  };

  const getUserPlaylists = () => {
    const playlists = getLists("playlists");
    const tracks = getTracksMap();

    return playlists.map(p => {
      let cover = p.img;
      if (!cover) {
        // Check if collection has songs and use first song's thumbnail
        const plSongs = getCollection(`pl_${p.name}`) || getCollection(p.id) || getCollection(p.name);
        if (plSongs.length > 0 && tracks[plSongs[0]]) {
          cover = tracks[plSongs[0]].img || "";
        }
      }
      return {
        ...p,
        img: cover
      };
    });
  };

  const avatarUrl = () => {
    const u = user();
    if (u?.avatar_url) return u.avatar_url;
    if (u?.avatar) return u.avatar;
    const name = u?.username || u?.email || "Guest";
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=ff6b00&backgroundType=gradientLinear`;
  };

  const [showAuthModal, setShowAuthModal] = createSignal(false);

  return (
    <section class="homeSection">
      {/* Top Bar with Brand and Account Avatar */}
      <header class="homeHeader sticky-bar">
        <div class="brand" style={{ display: "flex", "align-items": "center", gap: "10px" }}>
          <svg viewBox="0 0 100 100" width="32" height="32" fill="currentColor" style={{ color: "var(--text)" }}>
            <rect x="18" y="49" width="13" height="16" rx="1.5" />
            <path d="M31.5 33.5 H41.5 L53 49 H43 Z" />
            <rect x="31.5" y="33.5" width="10" height="31.5" rx="1.5" />
            <path d="M54 33.5 H64 L75.5 49 H65.5 Z" />
            <rect x="54" y="33.5" width="10" height="31.5" rx="1.5" />
            <rect x="75" y="49" width="7" height="16" rx="1.5" />
          </svg>
          <h2>m-ytify</h2>
        </div>

        <div class="userMenuContainer">
          <div
            class="avatarButton"
            onclick={() => setShowAccountMenu(!showAccountMenu())}
            title={user()?.username || "Account"}
          >
            <img
              src={avatarUrl()}
              alt="Avatar"
              class="avatarImg"
            />
          </div>

          <Show when={showAccountMenu()}>
            <div class="accountDropdown">
              <div class="accountInfo">
                <p class="accountName">{user()?.username || (isGuestUser() ? "Guest User" : "User")}</p>
                <p class="accountEmail">{user()?.email || (isGuestUser() ? "Local Session" : "")}</p>
              </div>
              <hr />
              <button
                onclick={() => {
                  setShowAccountMenu(false);
                  setNavStore("active", "settings");
                }}
              >
                <i class="ri-settings-3-line"></i> Settings
              </button>

              <Show
                when={getAuthToken()}
                fallback={
                  <button
                    onclick={() => {
                      setShowAccountMenu(false);
                      setShowAuthModal(true);
                    }}
                  >
                    <i class="ri-login-box-line"></i> Sign In / Sign Up
                  </button>
                }
              >
                <button
                  onclick={() => {
                    logout();
                    setUser(null);
                    setShowAccountMenu(false);
                    location.reload();
                  }}
                >
                  <i class="ri-logout-box-r-line"></i> Logout
                </button>
              </Show>
            </div>
          </Show>
        </div>
      </header>

      <Show when={showAuthModal()}>
        <AuthModal
          onClose={() => {
            setShowAuthModal(false);
            setUser(getStoredUser());
          }}
        />
      </Show>

      {/* Main Home Content */}
      <div class="homeContent">
        
        {/* Recently Played */}
        <section class="homeCardSection">
          <div class="sectionHeader">
            <h3>Recently Played</h3>
            <Show when={getCollection("history").length > 0}>
              <button class="viewAllBtn" onclick={() => fetchCollection("history")}>
                View All
              </button>
            </Show>
          </div>

          <Show
            when={getRecentHistoryTracks().length > 0}
            fallback={<p class="emptyPrompt">No recent songs played yet.</p>}
          >
            <div class="horizontalTracksRail">
              <For each={getRecentHistoryTracks()}>
                {(track) => (
                  <StreamItem
                    id={track.id}
                    title={track.title}
                    author={track.author}
                    duration={track.duration}
                    authorId={track.authorId}
                    img={track.img}
                    type="video"
                    context={{
                      src: "collection",
                      id: "history"
                    }}
                  />
                )}
              </For>
            </div>
          </Show>
        </section>

        {/* Playlists */}
        <section class="homeCardSection">
          <div class="sectionHeader">
            <h3>Your Playlists</h3>
          </div>

          <Show
            when={getUserPlaylists().length > 0}
            fallback={<p class="emptyPrompt">No playlists found.</p>}
          >
            <div class="playlistsGrid">
              <For each={getUserPlaylists()}>
                {(playlist) => (
                  <ListItem
                    id={playlist.id}
                    name={playlist.name}
                    img={playlist.img}
                    type="playlist"
                  />
                )}
              </For>
            </div>
          </Show>
        </section>

        {/* Favorites */}
        <section class="homeCardSection">
          <div class="sectionHeader">
            <h3>Favorites</h3>
            <Show when={getCollection("favorites").length > 0}>
              <button class="viewAllBtn" onclick={() => fetchCollection("favorites")}>
                View All
              </button>
            </Show>
          </div>

          <Show
            when={getFavoriteTracks().length > 0}
            fallback={<p class="emptyPrompt">No favorite tracks yet.</p>}
          >
            <div class="horizontalTracksRail">
              <For each={getFavoriteTracks()}>
                {(track) => (
                  <StreamItem
                    id={track.id}
                    title={track.title}
                    author={track.author}
                    duration={track.duration}
                    authorId={track.authorId}
                    img={track.img}
                    type="video"
                    context={{
                      src: "collection",
                      id: "favorites"
                    }}
                  />
                )}
              </For>
            </div>
          </Show>
        </section>

      </div>
    </section>
  );
}
