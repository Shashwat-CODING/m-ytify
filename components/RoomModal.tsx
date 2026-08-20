import { createSignal, Show, For } from "solid-js";
import "./RoomModal.css";
import { roomStore, setStore, JoinRequest, SongSuggestion, RoomUser } from "@stores";
import { metroClient } from "@modules/metroClient";

export default function RoomModal(props: { onClose: () => void }) {
  const [tab, setTab] = createSignal<"create" | "join">("create");
  const [username, setUsername] = createSignal(roomStore.username || "Listener");
  const [roomCodeInput, setRoomCodeInput] = createSignal(roomStore.roomCode || "");
  const [copied, setCopied] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  let dialogRef!: HTMLDialogElement;

  const isInRoom = () => roomStore.status === "connected" && Boolean(roomStore.roomCode);

  const handleCreateRoom = async (e: Event) => {
    e.preventDefault();
    if (!username().trim()) return;
    setIsSubmitting(true);
    try {
      await metroClient.createRoom(username().trim());
      props.onClose();
    } catch (err: unknown) {
      const error = err as Error;
      setStore("snackbar", error?.message || "Failed to create party");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinRoom = async (e: Event) => {
    e.preventDefault();
    if (!roomCodeInput().trim() || !username().trim()) return;
    setIsSubmitting(true);
    try {
      await metroClient.joinRoom(roomCodeInput().trim(), username().trim());
      setStore("snackbar", "Join request sent. Waiting for host approval...");
      props.onClose();
    } catch (err: unknown) {
      const error = err as Error;
      setStore("snackbar", error?.message || "Failed to join party");
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleCopyCode = () => {
    if (!roomStore.roomCode) return;
    const shareUrl = `${window.location.origin}?room=${roomStore.roomCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setStore("snackbar", "Invite link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <dialog
      ref={dialogRef}
      class="displayer room-modal-dialog"
      open
      onclick={(e) => {
        if (e.target === dialogRef) props.onClose();
      }}
    >
      <div class="room-modal-card" onclick={(e) => e.stopPropagation()}>
        <header class="room-modal-header">
          <div class="room-modal-title">
            <h3>
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="currentColor"
                style={{ color: "var(--accent, #818cf8)", "flex-shrink": "0" }}
              >
                <path d="M12 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm-1 2.45V21h2v-7.55a4 4 0 0 0 0-7.9 4 4 0 0 0-2 7.45zM7.05 5.05a7 7 0 0 0 0 9.9l1.41-1.41a5 5 0 0 1 0-7.08L7.05 5.05zm9.9 0l-1.41 1.41a5 5 0 0 1 0 7.08l1.41 1.41a7 7 0 0 0 0-9.9zM4.22 2.22a11 11 0 0 0 0 15.56l1.42-1.42a9 9 0 0 1 0-12.72L4.22 2.22zm15.56 0l-1.42 1.42a9 9 0 0 1 0 12.72l1.42 1.42a11 11 0 0 0 0-15.56z" />
              </svg>
              Party
            </h3>
            <span>Real-time collaborative listening party</span>
          </div>
          <button
            type="button"
            class="room-close-btn"
            onclick={props.onClose}
            aria-label="Close"
          >
            <i class="ri-close-large-line"></i>
          </button>
        </header>

        <div class="room-modal-content">
          <Show when={isInRoom()} fallback={
            <>
              <div class="room-tabs">
                <button
                  type="button"
                  class="room-tab-btn"
                  classList={{ active: tab() === "create" }}
                  onclick={() => setTab("create")}
                >
                  Create Party
                </button>
                <button
                  type="button"
                  class="room-tab-btn"
                  classList={{ active: tab() === "join" }}
                  onclick={() => setTab("join")}
                >
                  Join Party
                </button>
              </div>

              <div class="room-field">
                <label>Your Nickname</label>
                <input
                  type="text"
                  class="room-input"
                  placeholder="Enter your name"
                  value={username()}
                  oninput={(e) => setUsername(e.currentTarget.value)}
                  maxlength="32"
                />
              </div>

              <Show when={tab() === "create"}>
                <button
                  type="button"
                  class="room-btn-primary"
                  onclick={handleCreateRoom}
                  disabled={isSubmitting() || !username().trim()}
                >
                  <Show when={isSubmitting()} fallback={<><i class="ri-add-circle-line"></i> Start Party</>}>
                    <i class="ri-loader-3-line loading-spinner"></i> Starting Party...
                  </Show>
                </button>
              </Show>

              <Show when={tab() === "join"}>
                <div class="room-field">
                  <label>Party Code</label>
                  <input
                    type="text"
                    class="room-input code-input"
                    placeholder="e.g. AB12CD34"
                    value={roomCodeInput()}
                    oninput={(e) => setRoomCodeInput(e.currentTarget.value.toUpperCase())}
                    maxlength="16"
                  />
                </div>

                <button
                  type="button"
                  class="room-btn-primary"
                  onclick={handleJoinRoom}
                  disabled={isSubmitting() || !roomCodeInput().trim() || !username().trim()}
                >
                  <Show when={isSubmitting()} fallback={<><i class="ri-login-circle-line"></i> Join Party</>}>
                    <i class="ri-loader-3-line loading-spinner"></i> Connecting...
                  </Show>
                </button>
              </Show>
            </>
          }>
            {/* Active Room View */}
            <div class="room-status-box">
              <div class="room-meta-tags">
                <span class="room-tag connected">
                  <i class="ri-checkbox-circle-fill"></i> In Party
                </span>
                <span class="room-tag" classList={{ host: roomStore.isHost, guest: !roomStore.isHost }}>
                  <i class={roomStore.isHost ? "ri-vip-crown-fill" : "ri-headphones-fill"}></i>
                  {roomStore.isHost ? "Host" : "Guest"}
                </span>
                <Show when={roomStore.pingMs > 0}>
                  <span class="room-tag latency">
                    <i class="ri-pulse-line"></i> {roomStore.pingMs}ms
                  </span>
                </Show>
              </div>

              <div class="room-code-shelf">
                <span class="room-code-num">{roomStore.roomCode}</span>
                <button type="button" class="room-copy-btn" onclick={handleCopyCode}>
                  <i class={copied() ? "ri-check-line" : "ri-file-copy-line"}></i>
                  {copied() ? "Copied" : "Copy Invite"}
                </button>
              </div>
            </div>


            {/* Host: Join Requests */}
            <Show when={roomStore.isHost && roomStore.joinRequests.length > 0}>
              <div class="room-sub-header">
                <span>Join Requests</span>
                <span class="room-badge">{roomStore.joinRequests.length}</span>
              </div>
              <div class="room-items-list">
                <For each={roomStore.joinRequests}>
                  {(req: JoinRequest) => (
                    <div class="room-request-row">
                      <div class="room-row-info">
                        <span class="room-row-main">
                          <i class="ri-user-follow-line"></i>
                          {req.username}
                        </span>
                      </div>
                      <div class="room-row-actions">
                        <button
                          type="button"
                          class="btn-act-allow"
                          onclick={() => metroClient.approveJoin(req.userId)}
                        >
                          <i class="ri-check-line"></i> Allow
                        </button>
                        <button
                          type="button"
                          class="btn-act-deny"
                          onclick={() => metroClient.rejectJoin(req.userId)}
                        >
                          <i class="ri-close-line"></i>
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Host: Song Suggestions */}
            <Show when={roomStore.isHost && roomStore.suggestions.length > 0}>
              <div class="room-sub-header">
                <span>Track Suggestions</span>
                <span class="room-badge">{roomStore.suggestions.length}</span>
              </div>
              <div class="room-items-list">
                <For each={roomStore.suggestions}>
                  {(sug: SongSuggestion) => (
                    <div class="room-suggestion-row">
                      <div class="room-row-info">
                        <span class="room-row-main">{sug.trackInfo.title}</span>
                        <span class="room-row-sub">
                          {sug.trackInfo.author} • from {sug.fromUsername}
                        </span>
                      </div>
                      <div class="room-row-actions">
                        <button
                          type="button"
                          class="btn-act-allow"
                          onclick={() => metroClient.approveSuggestion(sug.suggestionId)}
                        >
                          <i class="ri-play-list-add-line"></i>
                        </button>
                        <button
                          type="button"
                          class="btn-act-deny"
                          onclick={() => metroClient.rejectSuggestion(sug.suggestionId)}
                        >
                          <i class="ri-close-line"></i>
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Users list */}
            <div class="room-sub-header">
              <span>Participants</span>
              <span class="room-badge">{Math.max(1, roomStore.users.length)}</span>
            </div>
            <div class="room-items-list">
              <Show when={roomStore.users.length > 0} fallback={
                <div class="room-user-row">
                  <span class="room-row-main">
                    <i class={roomStore.isHost ? "ri-vip-crown-fill" : "ri-user-line"}></i>
                    {roomStore.username || "You"} (You)
                  </span>
                  <span class="room-tag" classList={{ host: roomStore.isHost, guest: !roomStore.isHost }}>
                    {roomStore.isHost ? "Host" : "Guest"}
                  </span>
                </div>
              }>
                <For each={roomStore.users}>
                  {(u: RoomUser) => (
                    <div class="room-user-row">
                      <span class="room-row-main">
                        <i class={u.isHost ? "ri-vip-crown-fill" : "ri-user-line"}></i>
                        {u.username} {u.userId === roomStore.userId ? "(You)" : ""}
                        <Show when={u.isDisconnected}>
                          <span style={{ color: "#eab308", "font-size": "0.75rem" }}>(offline)</span>
                        </Show>
                      </span>
                      <span class="room-tag" classList={{ host: u.isHost, guest: !u.isHost }}>
                        {u.isHost ? "Host" : "Guest"}
                      </span>
                    </div>
                  )}
                </For>
              </Show>
            </div>

            <button
              type="button"
              class="room-leave-btn"
              onclick={() => {
                metroClient.leaveRoom();
                props.onClose();
              }}
            >
              <i class="ri-logout-box-r-line"></i> Leave Party
            </button>

          </Show>
        </div>
      </div>
    </dialog>
  );
}
