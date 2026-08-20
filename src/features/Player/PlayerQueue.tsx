import { Show, lazy } from "solid-js";
import { queueStore, setQueueStore, groupQueueByAuthor, totalQueueDuration, playerStore, setStore } from "@stores";
import { config, shuffle } from "@utils";
import StreamItem from "@components/StreamItem";
import { enqueueRelatedSongs } from "@modules/relatedQueue";

const Sortable = lazy(() => import("solid-sortablejs"));

export default function PlayerQueue(props: { onClose?: () => void }) {
  const handleShuffle = () => {
    if (queueStore.list.length <= 1) return;
    setQueueStore("list", (list) => shuffle([...list]));
    setStore("snackbar", "Queue shuffled");
  };

  const handleClear = () => {
    if (queueStore.list.length === 0) return;
    setQueueStore("list", []);
    setStore("snackbar", "Queue cleared");
  };

  const handleFetchRelated = async () => {
    if (!playerStore.stream.id) {
      setStore("snackbar", "No song currently playing");
      return;
    }
    await enqueueRelatedSongs(playerStore.stream.id, { skipFirst: true });
  };

  return (
    <div class="playerQueueContainer" style={{
      width: "100%",
      height: "100%",
      display: "flex",
      "flex-direction": "column",
      "border-radius": "1.25rem",
      background: "rgba(0, 0, 0, 0.4)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      "backdrop-filter": "blur(20px)",
      "-webkit-backdrop-filter": "blur(20px)",
      overflow: "hidden",
      "box-sizing": "border-box"
    }}>
      {/* Queue Header Bar */}
      <div style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        padding: "10px 14px",
        background: "rgba(255, 255, 255, 0.05)",
        "border-bottom": "1px solid rgba(255, 255, 255, 0.08)"
      }}>
        <div style={{ display: "flex", "align-items": "baseline", gap: "8px" }}>
          <span style={{ "font-size": "0.95rem", "font-weight": "700", color: "var(--text)" }}>
            Up Next
          </span>
          <span style={{ "font-size": "0.75rem", opacity: "0.6", "font-weight": "500" }}>
            {queueStore.list.length} tracks {totalQueueDuration(queueStore.list) ? `• ${totalQueueDuration(queueStore.list)}` : ""}
          </span>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
          <button
            type="button"
            onclick={handleFetchRelated}
            title="Add Related Songs"
            aria-label="Add Related Songs"
            disabled={queueStore.isLoading}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "none",
              color: "var(--text)",
              padding: "5px 9px",
              "border-radius": "8px",
              cursor: "pointer",
              "font-size": "0.78rem",
              "font-weight": "600",
              display: "flex",
              "align-items": "center",
              gap: "4px"
            }}
          >
            <i class="ri-sparkling-fill" style={{ "font-size": "0.9rem", color: "var(--accent, #6366f1)" }}></i>
            <span>Related</span>
          </button>

          <button
            type="button"
            onclick={handleShuffle}
            title="Shuffle Queue"
            aria-label="Shuffle Queue"
            style={{
              background: "none",
              border: "none",
              color: "var(--text)",
              padding: "4px",
              opacity: "0.75",
              cursor: "pointer",
              "font-size": "1.1rem"
            }}
          >
            <i class="ri-shuffle-line"></i>
          </button>

          <button
            type="button"
            onclick={handleClear}
            title="Clear Queue"
            aria-label="Clear Queue"
            style={{
              background: "none",
              border: "none",
              color: "var(--text)",
              padding: "4px",
              opacity: "0.75",
              cursor: "pointer",
              "font-size": "1.1rem"
            }}
          >
            <i class="ri-delete-bin-line"></i>
          </button>

          <Show when={props.onClose}>
            <button
              type="button"
              onclick={props.onClose}
              title="Close Queue View"
              aria-label="Close"
              style={{
                background: "none",
                border: "none",
                color: "var(--text)",
                padding: "4px",
                opacity: "0.75",
                cursor: "pointer",
                "font-size": "1.1rem"
              }}
            >
              <i class="ri-close-line"></i>
            </button>
          </Show>
        </div>
      </div>

      {/* Queue Content / Items */}
      <div style={{
        flex: "1",
        "overflow-y": "auto",
        "overflow-x": "hidden",
        padding: "8px"
      }}>
        <Show when={queueStore.isLoading}>
          <div style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            gap: "8px",
            padding: "16px 0",
            opacity: "0.8"
          }}>
            <i class="ri-loader-3-line loading-spinner" style={{ "font-size": "1.2rem" }}></i>
            <span style={{ "font-size": "0.85rem" }}>Finding related tracks...</span>
          </div>
        </Show>

        <Show
          when={queueStore.list.length > 0}
          fallback={
            <div style={{
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              "justify-content": "center",
              padding: "36px 16px",
              gap: "12px",
              opacity: "0.75"
            }}>
              <i class="ri-play-list-2-line" style={{ "font-size": "2rem", opacity: "0.5" }}></i>
              <p style={{ margin: "0", "font-size": "0.88rem", "font-weight": "500" }}>Queue is empty</p>
              <button
                type="button"
                onclick={handleFetchRelated}
                style={{
                  background: "var(--text)",
                  color: "var(--trueBg, #000)",
                  border: "none",
                  padding: "8px 16px",
                  "border-radius": "9999px",
                  "font-size": "0.82rem",
                  "font-weight": "700",
                  cursor: "pointer",
                  display: "flex",
                  "align-items": "center",
                  gap: "6px"
                }}
              >
                <i class="ri-sparkling-fill"></i>
                Add Related Songs
              </button>
            </div>
          }
        >
          <div id="queuelist">
            <Sortable
              items={queueStore.list}
              setItems={(items: TrackItem[]) => {
                let newList = items;
                if (config.authorGrouping) newList = groupQueueByAuthor(newList);
                setQueueStore("list", newList);
              }}
              idField="id"
              animation={150}
              handle=".ri-draggable"
            >
              {(item: TrackItem) => (
                <StreamItem
                  id={item.id}
                  title={item.title}
                  author={item.author}
                  duration={item.duration}
                  authorId={item.authorId}
                  img={item.img}
                  type="video"
                  draggable={true}
                  removeMode={queueStore.removeMode}
                  context={item.context}
                  inQueue={true}
                />
              )}
            </Sortable>
          </div>
        </Show>
      </div>
    </div>
  );
}
