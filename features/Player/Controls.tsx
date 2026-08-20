import { LikeButton, PlayButton, PlayNextButton } from "@components/MediaPartials";
import { playerStore, playPrev, queueStore, setPlayerStore, t } from "@stores";
import { convertSStoHHMMSS, setConfig } from "@utils";
import { Accessor, onMount, Setter, Show } from "solid-js";

export default function(_: {
  showLyrics: Accessor<boolean>,
  setShowLyrics: Setter<boolean>,
  showQueue?: Accessor<boolean>,
  setShowQueue?: Setter<boolean>
}) {

  let slider!: HTMLInputElement;



  onMount(() => {
    ['touchstart', 'touchmove', 'touchend'].forEach(type => {
      slider.addEventListener(type, (e) => e.stopPropagation());
    });
  })

  function updatePositionState() {
    if ('mediaSession' in navigator)
      import('@modules/mediaSession').then(m => m.updateMediaSessionPosition());
  }

  function emitSeek(posSec: number) {
    import('@stores').then(({ roomStore }) => {
      if (roomStore.status === 'connected' && roomStore.isHost && !roomStore.isApplyingRemoteSync) {
        import('@modules/metroClient').then(({ metroClient }) => {
          metroClient.sendPlaybackAction({
            action: 'seek',
            track_id: playerStore.stream.id,
            position: Math.round(posSec * 1000)
          });
        });
      }
    });
  }

  return (
    <>
      <span class="slider">
        <input
          type="range"
          value={playerStore.currentTime}
          max={playerStore.fullDuration}
          ref={slider}
          onchange={(e) => {
            const newPos = parseInt(e.target.value);
            playerStore.audio.currentTime = newPos;
            emitSeek(newPos);
          }}
        />
        <div>
          <p id="currentDuration">{convertSStoHHMMSS(playerStore.currentTime)}</p>
          <p id="fullDuration">{convertSStoHHMMSS(playerStore.fullDuration)}</p>
        </div>
      </span>

      <div class="mainShelf">

        <Show when={queueStore.history.length}>
          <button
            aria-label={t('player_play_previous')}
            class="ri-skip-back-fill"
            id="playPrevButton"
            onclick={playPrev}
          ></button>
        </Show>

        <button
          aria-label={t('player_seek_backward')}
          class="ri-replay-15-line"
          id="seekBwdButton"
          onclick={() => {
            const newPos = Math.max(0, playerStore.audio.currentTime - 15);
            playerStore.audio.currentTime = newPos;
            emitSeek(newPos);
          }}
        ></button>

        <PlayButton />

        <button
          aria-label={t('player_seek_forward')}
          class="ri-forward-15-line"
          id="seekFwdButton"
          onclick={() => {
            const newPos = playerStore.audio.currentTime + 15;
            playerStore.audio.currentTime = newPos;
            emitSeek(newPos);
          }}
        ></button>

        <Show when={queueStore.list.length}>
          <PlayNextButton />
        </Show>

      </div>

      <div class="bottomShelf">

        <select
          id="playSpeed"
          value={playerStore.playbackRate.toFixed(2)}
          onchange={e => {
            const ref = e.target;
            const speed = parseFloat(ref.value);
            playerStore.audio.playbackRate = speed;
            setPlayerStore('playbackRate', speed);
            updatePositionState();
            ref.blur();
          }}
        >
          <option value="0.25">0.25x</option>
          <option value="0.33">0.33x</option>
          <option value="0.50">0.50x</option>
          <option value="0.75">0.75x</option>
          <option value="0.87">0.87x</option>
          <option value="1.00">1.00x</option>
          <option value="1.25">1.25x</option>
          <option value="1.50">1.50x</option>
          <option value="1.75">1.75x</option>
          <option value="2.00">2.00x</option>
          <option value="2.50">2.50x</option>
          <option value="3.00">3.00x</option>
          <option value="3.50">3.50x</option>
          <option value="4.00">4.00x</option>
        </select>

        <button
          type="button"
          aria-label={t('player_lyrics')}
          class="lyrics-btn"
          classList={{
            on: _.showLyrics()
          }}
          onclick={() => {
            const next = !_.showLyrics();
            _.setShowLyrics(next);
            if (next && _.setShowQueue) _.setShowQueue(false);
          }}
          title="Lyrics"
          style={{
            background: _.showLyrics() ? "rgba(255, 255, 255, 0.22)" : "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "var(--text)",
            padding: "8px 12px",
            "border-radius": "9999px",
            cursor: "pointer",
            display: "inline-flex",
            "align-items": "center",
            "justify-content": "center",
            gap: "6px",
            "font-size": "0.85rem",
            "font-weight": "600",
            transition: "all 0.2s ease"
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ display: "inline-block" }}>
            <path d="M12 13.535V3h8v3h-6v7.535A4 4 0 1 1 12 13.535zM4 17a2 2 0 1 0 2-2 2 2 0 0 0-2 2zm8-13.5V6h6V3.5h-6z" />
          </svg>
          <span>Lyrics</span>
        </button>

        <LikeButton />

        <i
          aria-label={t("player_loop")}
          class="ri-repeat-fill"
          classList={{ on: playerStore.loop }}
          onclick={() => {
            const newLoopState = !playerStore.loop;
            playerStore.audio.loop = newLoopState;
            setPlayerStore('loop', newLoopState);
          }}
        ></i>


        <select
          id="volumeChanger"
          value={playerStore.volume}
          onchange={e => {
            const ref = e.target;
            const vol = parseFloat(ref.value);
            playerStore.audio.volume = vol;
            setConfig('volume', (vol * 100).toString());
            setPlayerStore('volume', vol);
            import('@stores').then(({ roomStore }) => {
              if (roomStore.status === 'connected' && roomStore.isHost && !roomStore.isApplyingRemoteSync) {
                import('@modules/metroClient').then(({ metroClient }) => {
                  metroClient.sendPlaybackAction({
                    action: 'set_volume',
                    volume: vol
                  });
                });
              }
            });
            ref.blur();
          }}
        >

          <option value="0">0%</option>
          <option value="0.002">0.2%</option>
          <option value="0.005">0.5%</option>
          <option value="0.01">1%</option>
          <option value="0.02">2%</option>
          <option value="0.03">3%</option>
          <option value="0.05">5%</option>
          <option value="0.1">10%</option>
          <option value="0.15">15%</option>
          <option value="0.25">25%</option>
          <option value="0.5">50%</option>
          <option value="0.75">75%</option>
          <option value="1">100%</option>
        </select>

      </div>

    </>
  );
}
