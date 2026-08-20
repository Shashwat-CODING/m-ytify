import { createSignal, onMount, createEffect, For, Show } from "solid-js";
import { getStoredUser, getAuthToken, isGuestUser, logout, MuzoUser } from "@modules/muzoAuth";
import { getCollection, getTracksMap, getLists, fetchCollection } from "@utils";
import { setNavStore, store } from "@stores";
import { pullMuzoUserData } from "@modules/muzoSync";
import StreamItem from "@components/StreamItem";
import ListItem from "@components/ListItem";
import AuthModal from "@components/AuthModal";
import "./Home.css";

export default function Home() {
  const [user, setUser] = createSignal<MuzoUser | null>(getStoredUser());
  const [showAccountMenu, setShowAccountMenu] = createSignal(false);
  const [recentHistory, setRecentHistory] = createSignal<TrackItem[]>([]);
  const [favoriteTracks, setFavoriteTracks] = createSignal<TrackItem[]>([]);
  const [userPlaylists, setUserPlaylists] = createSignal<Playlist[]>([]);
  const [historyCount, setHistoryCount] = createSignal(0);
  const [favoritesCount, setFavoritesCount] = createSignal(0);
  const [showAuthModal, setShowAuthModal] = createSignal(false);

  const refreshData = () => {
    setUser(getStoredUser());
    const historyIds = getCollection("history");
    setHistoryCount(historyIds.length);
    const favoriteIds = getCollection("favorites");
    setFavoritesCount(favoriteIds.length);
    const tracks = getTracksMap();

    setRecentHistory(historyIds.slice(0, 20).map(id => tracks[id]).filter(Boolean));
    setFavoriteTracks(favoriteIds.slice(0, 20).map(id => tracks[id]).filter(Boolean));

    const playlists = getLists("playlists");
    setUserPlaylists(playlists.map(p => {
      let cover = p.img;
      if (!cover) {
        const plSongs = getCollection(`pl_${p.name}`) || getCollection(p.id) || getCollection(p.name);
        if (plSongs.length > 0 && tracks[plSongs[0]]) {
          cover = tracks[plSongs[0]].img || "";
        }
      }
      return {
        ...p,
        img: cover
      };
    }));
  };

  onMount(() => {
    refreshData();
    if (getAuthToken()) {
      pullMuzoUserData().then(refreshData).catch(() => {});
    }
  });

  // Re-run whenever syncState or active navigation changes
  createEffect(() => {
    store.syncState;
    refreshData();
  });

  const avatarUrl = () => {
    const u = user();
    if (u?.avatar_url) return u.avatar_url;
    if (u?.avatar) return u.avatar;
    const name = u?.username || u?.email || "Guest";
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=ff6b00&backgroundType=gradientLinear`;
  };

  return (
    <section class="homeSection">
      {/* Top Bar with Brand and Account Avatar */}
      <header class="homeHeader sticky-bar">
        <div class="brand" style={{ display: "flex", "align-items": "center", gap: "10px" }}>
          <svg viewBox="0 0 512 512" width="32" height="32" style={{ color: "var(--text)" }}>
            <g transform="translate(0,512) scale(0.1,-0.1)" fill="currentColor" stroke="none">
              <path d="M1663 3400 c-66 -15 -63 4 -63 -396 l0 -363 -22 -13 c-17 -10 -107 -14 -336 -18 -263 -4 -314 -7 -322 -20 -6 -9 -10 -174 -10 -397 0 -376 0 -382 21 -396 17 -13 69 -14 322 -11 195 3 306 9 314 16 10 8 13 80 13 330 0 260 3 324 15 347 14 29 33 41 63 41 19 0 102 -78 102 -97 0 -6 6 -16 14 -20 8 -4 38 -35 66 -68 29 -33 80 -91 115 -130 34 -38 79 -90 100 -115 20 -25 56 -67 79 -94 22 -27 57 -70 77 -96 20 -26 51 -62 70 -78 l35 -31 199 -2 200 -2 17 28 c13 22 16 42 11 90 -3 34 -2 182 2 329 7 266 7 268 30 278 33 15 65 4 105 -36 35 -34 58 -60 165 -191 32 -38 67 -79 80 -90 12 -11 35 -38 51 -60 16 -22 46 -57 67 -77 20 -20 37 -39 37 -43 0 -3 15 -21 33 -39 50 -52 80 -87 112 -133 17 -23 37 -46 45 -50 8 -4 170 -8 359 -10 299 -3 346 -2 367 12 l24 15 0 379 c0 467 16 426 -165 426 l-126 0 -47 51 c-109 116 -214 234 -281 314 -39 47 -85 102 -103 122 -18 20 -76 85 -128 145 -52 60 -108 120 -125 133 l-29 25 -211 -3 c-198 -3 -211 -4 -227 -24 -16 -18 -18 -49 -18 -327 0 -225 -3 -310 -12 -319 -7 -7 -29 -12 -50 -12 -40 0 -79 32 -143 116 -16 21 -55 66 -87 98 -32 33 -58 63 -58 68 0 4 -21 30 -47 56 -27 27 -57 60 -68 74 -11 14 -50 59 -87 99 -36 41 -81 91 -98 112 -18 21 -41 42 -51 48 -23 12 -352 20 -396 9z"/>
            </g>
          </svg>
          <h2>m-ytify</h2>
        </div>

        <div class="userMenuContainer" style={{ display: "flex", "align-items": "center", gap: "10px" }}>
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
            refreshData();
          }}
        />
      </Show>

      {/* Main Home Content */}
      <div class="homeContent">
        
        {/* Recently Played */}
        <section class="homeCardSection">
          <div class="sectionHeader">
            <h3>Recently Played</h3>
            <Show when={historyCount() > 0}>
              <button class="viewAllBtn" onclick={() => fetchCollection("history")}>
                View All
              </button>
            </Show>
          </div>

          <Show
            when={recentHistory().length > 0}
            fallback={<p class="emptyPrompt">No recent songs played yet.</p>}
          >
            <div class="horizontalTracksRail">
              <For each={recentHistory()}>
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
            when={userPlaylists().length > 0}
            fallback={<p class="emptyPrompt">No playlists found.</p>}
          >
            <div class="playlistsGrid">
              <For each={userPlaylists()}>
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
            <Show when={favoritesCount() > 0}>
              <button class="viewAllBtn" onclick={() => fetchCollection("favorites")}>
                View All
              </button>
            </Show>
          </div>

          <Show
            when={favoriteTracks().length > 0}
            fallback={<p class="emptyPrompt">No favorite tracks yet.</p>}
          >
            <div class="horizontalTracksRail">
              <For each={favoriteTracks()}>
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
