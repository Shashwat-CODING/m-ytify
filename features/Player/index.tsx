import { createEffect, createSignal, lazy, onCleanup, onMount, Show } from "solid-js"
import './Player.css'
import { MediaDetails } from "@components/MediaPartials";
import { config, cssVar } from "@utils";
import { closeFeature, playerStore, setNavStore, setStore, t, updateParam } from "@stores";

const MediaArtwork = lazy(() => import('../../components/MediaPartials/MediaArtwork'));
const Lyrics = lazy(() => import('./Lyrics'));
const Video = lazy(() => import('./Video'));
const Controls = lazy(() => import('./Controls'));
const PlayerQueue = lazy(() => import('./PlayerQueue'));

export default function() {
  let playerSection!: HTMLDivElement;

  const [showLyrics, setShowLyrics] = createSignal(false);
  const [showQueue, setShowQueue] = createSignal(false);

  onMount(() => {
    setNavStore('player', 'ref', playerSection);
  });

  createEffect(() => {
    if (playerStore.stream.id)
      updateParam('s', playerStore.stream.id);
  });

  onCleanup(() => {
    updateParam('s');
  });


  createEffect(() => {
    const { immersive, mediaArtwork } = playerStore;
    if (immersive)
      cssVar('--player-bg', `url(${mediaArtwork})`);
  });


  function getContext() {
    const { id } = playerStore.context;

    return id;
  }


  return (
    <section
      id="playerSection"
      ref={playerSection}>

      <Show when={playerStore.immersive} >
        <div class="bg-pane" />
        <div class="bg-image" />
      </Show>

      <header class="topShelf">
        <p>
          <Show when={playerStore.context.src}>
            <Show when={playerStore.context.src === 'queue'} fallback={t('player_from', getContext())}>
              {getContext()}
            </Show>
          </Show>
        </p>

        <div class="right-group" style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <i
            aria-label={t('player_more')}
            class="ri-more-2-fill"
            id="moreBtn"
            onclick={() => setStore('actionsMenu', playerStore.stream)}
            title="Options"
          ></i>

          <i
            aria-label="Queue"
            class="ri-play-list-2-fill"
            classList={{ on: showQueue() }}
            style={{
              cursor: "pointer",
              color: showQueue() ? "var(--text)" : undefined,
              background: showQueue() ? "rgba(255,255,255,0.15)" : undefined,
              "border-radius": "8px"
            }}
            onclick={() => {
              const next = !showQueue();
              setShowQueue(next);
              if (next) setShowLyrics(false);
            }}
            title="Queue"
          ></i>

          <i
            aria-label={t('close')}
            onclick={() => { closeFeature('player') }}
            class="ri-close-large-line"
            title="Close"
          ></i>
        </div>
      </header>

      <article>

        <Show when={playerStore.isWatching && !playerStore.isMusic}>
          <Video />
        </Show>

        <div class="player-main-view" style={{
          position: "relative",
          width: "100%",
          "max-width": "min(88dvw, 420px)",
          "aspect-ratio": "1",
          margin: "0 auto",
          "border-radius": "1.5rem",
          overflow: "hidden",
          display: "flex",
          "align-items": "center",
          "justify-content": "center"
        }}>
          <Show when={(!playerStore.isWatching || playerStore.isMusic) && config.loadImage}>
            <MediaArtwork />
          </Show>

          <Show when={showLyrics()}>
            <div class="player-overlay-layer lyrics-overlay" style={{
              position: "absolute",
              top: "0",
              left: "0",
              width: "100%",
              height: "100%",
              background: "color-mix(in srgb, var(--bg) 88%, transparent)",
              "backdrop-filter": "blur(20px)",
              "-webkit-backdrop-filter": "blur(20px)",
              "border-radius": "1.5rem",
              overflow: "hidden",
              "z-index": "5"
            }}>
              <Lyrics onClose={() => setShowLyrics(false)} />
            </div>
          </Show>

          <Show when={showQueue()}>
            <div class="player-overlay-layer queue-overlay" style={{
              position: "absolute",
              top: "0",
              left: "0",
              width: "100%",
              height: "100%",
              background: "color-mix(in srgb, var(--bg) 92%, transparent)",
              "backdrop-filter": "blur(20px)",
              "-webkit-backdrop-filter": "blur(20px)",
              "border-radius": "1.5rem",
              overflow: "hidden",
              "z-index": "5"
            }}>
              <PlayerQueue onClose={() => setShowQueue(false)} />
            </div>
          </Show>
        </div>

        <MediaDetails />

        <Controls
          showLyrics={showLyrics}
          setShowLyrics={setShowLyrics}
          showQueue={showQueue}
          setShowQueue={setShowQueue}
        />
      </article>

    </section>
  )
}

