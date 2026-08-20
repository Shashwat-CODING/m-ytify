import { Show } from "solid-js";
import { playerStore } from "@stores";
import { hostResolver } from "@utils";

export default function() {

  return (
    <div class="mediaDetails">
      <a
        id="title"
        href={hostResolver(`/watch?v=${playerStore.stream.id}`)}
        target="_blank"
      >{
          playerStore.status ||
          playerStore.stream.title
        }</a>
      <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-top": "2px" }}>
        <p id="author" style={{ margin: "0" }}>{playerStore.stream.author?.replace('- Topic', '') ?? ''}</p>
        <Show when={playerStore.isLossless}>
          <span
            aria-label="Lossless Audio"
            title="Lossless Audio Active"
            style={{
              display: "inline-flex",
              "align-items": "center",
              gap: "4px",
              padding: "2px 7px",
              background: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              "border-radius": "9999px",
              "font-size": "0.68rem",
              "font-weight": "700",
              "letter-spacing": "0.06em",
              "text-transform": "uppercase",
              color: "var(--text)",
              "backdrop-filter": "blur(12px)",
              "-webkit-backdrop-filter": "blur(12px)",
              "line-height": "1.2"
            }}
          >
            <i class="ri-disc-line" style={{ "font-size": "0.75rem", color: "#38bdf8" }}></i>
            LOSSLESS
          </span>
        </Show>
      </div>
    </div>
  );

}
