import { lazy, onMount, Show, createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { themer, syncLibrary } from '@utils';
import NavBar from '@components/NavBar.tsx';
import { updateLang, setStore, store, navStore, playerStore } from '@stores';
import { hasSeenOnboarding, getAuthToken } from '@modules/muzoAuth';
import './styles/global.css';

updateLang().then(() => {
  themer();

  render(() => (
    <App />
  ), document.body);
});



const MiniPlayer = lazy(() => import('@components/MiniPlayer'));
const ActionsMenu = lazy(() => import('@components/ActionsMenu'));
const SnackBar = lazy(() => import('@components/SnackBar'));
const AuthModal = lazy(() => import('@components/AuthModal'));

export default function App() {
  const [showAuth, setShowAuth] = createSignal(false);

  onMount(async () => {
    await import('@modules/start.ts').then(mod => mod.default());

    if (!hasSeenOnboarding() && !getAuthToken()) {
      setShowAuth(true);
    } else if (getAuthToken()) {
      setStore('syncState', 'synced');
      syncLibrary('init');
    }
  });

  const Home = navStore.home.component;
  const Search = navStore.search.component;
  const Library = navStore.library.component;
  const List = navStore.list.component;
  const Settings = navStore.settings.component;
  const Queue = navStore.queue.component;
  const Player = navStore.player.component;

  return (
    <div class="app-root" classList={{ "has-side-player": navStore.player.state }}>
      <main class="app-main">
        <Show when={navStore.queue.state}>
          <Queue />
        </Show>

        <div class="main-content-panel">
          <Show when={navStore.active === 'home'}><Home /></Show>
          <Show when={navStore.active === 'search'}><Search /></Show>
          <Show when={navStore.active === 'library'}><Library /></Show>
          <Show when={navStore.active === 'list'}><List /></Show>
          <Show when={navStore.active === 'settings'}><Settings /></Show>
        </div>

        <Show when={navStore.player.state}>
          <div class="desktop-side-player">
            <Player />
          </div>
        </Show>
      </main>
      <Show when={!navStore.player.state && playerStore.playbackState !== 'none'}>
        <div class="miniplayer-floating-container">
          <MiniPlayer />
        </div>
      </Show>
      <footer class="navbar-floating-container">
        <NavBar />
      </footer>
      <Show when={store.actionsMenu?.id}>
        <ActionsMenu />
      </Show>
      <Show when={store.snackbar}>
        <SnackBar />
      </Show>
      <Show when={showAuth()}>
        <AuthModal onClose={() => setShowAuth(false)} isFirstLaunch={true} />
      </Show>
    </div>
  );
}
