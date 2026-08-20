import {
  roomStore,
  setRoomStore,
  resetRoomStore,
  RoomUser,
  JoinRequest,
  SongSuggestion,
  playerStore,
  setPlayerStore,
  setQueueStore,
  addToQueue,
  setStore
} from "@stores";
import { convertSStoHHMMSS, player } from "@utils";

const DEFAULT_WS_URL = "wss://velamhere-image.hf.space/ws";
const LOCAL_WS_URL = "ws://localhost:7860/ws";

export function getWsUrl(): string {
  if (typeof window !== "undefined" && window.location.hostname === "localhost" && window.location.port === "7860") {
    return LOCAL_WS_URL;
  }
  return DEFAULT_WS_URL;
}

interface MessageEnvelope<T = Record<string, unknown>> {
  type: string;
  payload?: T;
}

export interface TrackInfoPayload {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number; // duration in ms
  thumbnail?: string;
}

export interface PlaybackActionPayload {
  action:
    | "play"
    | "pause"
    | "seek"
    | "change_track"
    | "queue_add"
    | "queue_remove"
    | "queue_clear"
    | "set_volume";
  track_id?: string;
  position?: number; // in ms
  captured_at_server_time?: number;
  track_info?: TrackInfoPayload;
  insert_next?: boolean;
  volume?: number;
}

class MetroClient {
  private ws: WebSocket | null = null;
  private pingIntervalId: number | null = null;
  private reconnectTimeoutId: number | null = null;
  private pingSequence = 0;
  private intentionalDisconnect = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  public connect(sessionTokenToResume?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanup();
      this.intentionalDisconnect = false;

      const url = getWsUrl();
      setRoomStore("status", sessionTokenToResume ? "reconnecting" : "connecting");
      setRoomStore("errorMessage", "");

      try {
        this.ws = new WebSocket(url);
      } catch (err: unknown) {
        const error = err as Error;
        setRoomStore("status", "disconnected");
        setRoomStore("errorMessage", error?.message || "Failed to initialize WebSocket");
        reject(error);
        return;
      }

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.startPingInterval();

        if (sessionTokenToResume) {
          this.send("reconnect", { session_token: sessionTokenToResume });
        }
        resolve();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as MessageEnvelope<any>;
          this.handleEvent(data.type, data.payload);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e, event.data);
        }
      };

      this.ws.onerror = (event) => {
        console.warn("Metroserver WebSocket error:", event);
      };

      this.ws.onclose = () => {
        this.stopPingInterval();
        if (!this.intentionalDisconnect) {
          const token = roomStore.sessionToken || localStorage.getItem("metro_session_token");
          if (token && this.reconnectAttempts < this.maxReconnectAttempts) {
            setRoomStore("status", "reconnecting");
            const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
            this.reconnectAttempts++;
            this.reconnectTimeoutId = window.setTimeout(() => {
              this.connect(token).catch(console.error);
            }, delay);
          } else {
            resetRoomStore();
          }
        } else {
          resetRoomStore();
        }
      };
    });
  }

  public send(type: string, payload?: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send message, WebSocket not connected:", type);
      return;
    }
    const envelope: MessageEnvelope = {
      type,
      ...(payload !== undefined ? { payload } : {})
    };
    this.ws.send(JSON.stringify(envelope));
  }

  public async createRoom(username: string): Promise<void> {
    const cleanUsername = username.trim() || "Host";
    setRoomStore("username", cleanUsername);
    localStorage.setItem("metro_username", cleanUsername);

    if (!this.isConnected()) {
      await this.connect();
    }
    this.send("create_room", { username: cleanUsername });
  }

  public async joinRoom(roomCode: string, username: string): Promise<void> {
    const cleanUsername = username.trim() || "Guest";
    const cleanRoomCode = roomCode.trim().toUpperCase();
    setRoomStore("username", cleanUsername);
    setRoomStore("roomCode", cleanRoomCode);
    localStorage.setItem("metro_username", cleanUsername);

    if (!this.isConnected()) {
      await this.connect();
    }
    this.send("join_room", { room_code: cleanRoomCode, username: cleanUsername });
    // Close modal and show pending status immediately — server has no "join_pending" ack event
    setRoomStore("showModal", false);
    setStore("snackbar", "Join request sent! Waiting for host approval...");
  }

  public approveJoin(userId: string): void {
    this.send("approve_join", { user_id: userId });
    setRoomStore("joinRequests", (reqs: JoinRequest[]) => reqs.filter((r: JoinRequest) => r.userId !== userId));
  }

  public rejectJoin(userId: string, reason = "Join request declined"): void {
    this.send("reject_join", { user_id: userId, reason });
    setRoomStore("joinRequests", (reqs: JoinRequest[]) => reqs.filter((r: JoinRequest) => r.userId !== userId));
  }

  public leaveRoom(): void {
    this.intentionalDisconnect = true;
    this.currentSyncedTrackId = null;
    this.abortSyncLoad();
    if (this.isConnected()) {
      this.send("leave_room");
    }
    this.cleanup();
    resetRoomStore();
    setStore("snackbar", "Left party");
  }


  public sendPlaybackAction(payload: PlaybackActionPayload): void {
    if (!this.isConnected() || !roomStore.isHost || roomStore.isApplyingRemoteSync) {
      return;
    }
    this.send("playback_action", payload as unknown as Record<string, unknown>);
  }

  public sendBufferReady(trackId: string): void {
    if (!this.isConnected()) return;
    this.send("buffer_ready", { track_id: trackId });
  }

  public suggestTrack(track: TrackItem): void {
    if (!this.isConnected() || roomStore.isHost) return;
    let durationMs = 0;
    if (track.duration) {
      const parts = track.duration.split(":").map(Number);
      if (parts.length === 2) durationMs = (parts[0] * 60 + parts[1]) * 1000;
      else if (parts.length === 3) durationMs = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
    this.send("suggest_track", {
      track_info: {
        id: track.id,
        title: track.title,
        artist: track.author?.replace(" - Topic", "") || "Unknown Artist",
        duration: durationMs
      }
    });
    setStore("snackbar", "Suggestion sent to host");
  }

  public approveSuggestion(suggestionId: string): void {
    const sug = roomStore.suggestions.find((s: SongSuggestion) => s.suggestionId === suggestionId);
    this.send("approve_suggestion", { suggestion_id: suggestionId });
    setRoomStore("suggestions", (s: SongSuggestion[]) => s.filter((item: SongSuggestion) => item.suggestionId !== suggestionId));
    if (sug) {
      addToQueue([{ ...sug.trackInfo, context: { src: "", id: Date.now().toString() } }]);
      setStore("snackbar", `Approved: ${sug.trackInfo.title}`);
    }
  }

  public rejectSuggestion(suggestionId: string, reason = "Declined by host"): void {
    this.send("reject_suggestion", { suggestion_id: suggestionId, reason });
    setRoomStore("suggestions", (s: SongSuggestion[]) => s.filter((item: SongSuggestion) => item.suggestionId !== suggestionId));
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingIntervalId = window.setInterval(() => {
      if (this.isConnected()) {
        this.pingSequence++;
        this.send("ping", {
          client_time: Date.now(),
          sequence: this.pingSequence
        });
      }
    }, 10000);
  }

  private stopPingInterval(): void {
    if (this.pingIntervalId !== null) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private cleanup(): void {
    this.stopPingInterval();
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.onopen = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  private handleEvent(type: string, payload?: any): void {
    switch (type) {
      case "room_created": {
        const { room_code, user_id, session_token } = payload || {};
        setRoomStore({
          status: "connected",
          showModal: false,
          roomCode: room_code || "",
          userId: user_id || "",
          sessionToken: session_token || "",
          isHost: true,
          users: [{ userId: user_id, username: roomStore.username || "Host", isHost: true }],
          joinRequests: [],
          suggestions: []
        });
        localStorage.setItem("metro_session_token", session_token || "");
        localStorage.setItem("metro_room_code", room_code || "");
        localStorage.setItem("metro_is_host", "true");
        setStore("snackbar", `Party created! Code: ${room_code}`);
        break;
      }

      case "join_request": {
        const { user_id, username } = payload || {};
        if (user_id) {
          const req: JoinRequest = {
            userId: user_id,
            username: username || "Guest",
            timestamp: Date.now()
          };
          setRoomStore("joinRequests", (reqs: JoinRequest[]) => {
            if (reqs.some((r: JoinRequest) => r.userId === user_id)) return reqs;
            return [...reqs, req];
          });
          setStore("snackbar", `Join request from ${username || "Guest"}`);
        }
        break;
      }


      case "join_approved": {
        const { room_code, user_id, session_token, state } = payload || {};
        setRoomStore({
          status: "connected",
          showModal: false,
          roomCode: room_code || roomStore.roomCode,
          userId: user_id || "",
          sessionToken: session_token || "",
          isHost: false,
          joinRequests: [],
          suggestions: []
        });
        localStorage.setItem("metro_session_token", session_token || "");
        localStorage.setItem("metro_room_code", room_code || "");
        localStorage.setItem("metro_is_host", "false");
        setStore("snackbar", `Joined party ${room_code}! Synced with host.`);

        if (state) {
          this.applySyncState(state);
        }
        break;
      }

      case "join_rejected": {
        const reason = payload?.reason || "Join request declined by host";
        setRoomStore({
          status: "disconnected",
          showModal: false,
          errorMessage: reason
        });
        setStore("snackbar", reason);
        this.cleanup();
        resetRoomStore();
        break;
      }


      case "user_joined": {
        const { user_id, username } = payload || {};
        if (user_id) {
          setRoomStore("users", (users: RoomUser[]) => {
            const filtered = users.filter((u: RoomUser) => u.userId !== user_id);
            return [...filtered, { userId: user_id, username: username || "Guest", isHost: false }];
          });
          setStore("snackbar", `${username || "User"} joined`);
        }
        break;
      }

      case "user_left": {
        const { user_id, username } = payload || {};
        if (user_id) {
          setRoomStore("users", (users: RoomUser[]) => users.filter((u: RoomUser) => u.userId !== user_id));
          setRoomStore("joinRequests", (reqs: JoinRequest[]) => reqs.filter((r: JoinRequest) => r.userId !== user_id));
          setStore("snackbar", `${username || "User"} left`);
        }
        break;
      }

      case "user_disconnected": {
        const { user_id } = payload || {};
        if (user_id) {
          setRoomStore("users", (users: RoomUser[]) =>
            users.map((u: RoomUser) => (u.userId === user_id ? { ...u, isDisconnected: true } : u))
          );
        }
        break;
      }

      case "user_reconnected": {
        const { user_id } = payload || {};
        if (user_id) {
          setRoomStore("users", (users: RoomUser[]) =>
            users.map((u: RoomUser) => (u.userId === user_id ? { ...u, isDisconnected: false } : u))
          );
        }
        break;
      }

      case "sync_playback": {
        if (!roomStore.isHost) {
          this.applySyncPlayback(payload);
        }
        break;
      }

      case "sync_state": {
        if (!roomStore.isHost) {
          this.applySyncState(payload);
        }
        break;
      }

      case "buffer_wait": {
        const { waiting_for } = payload || {};
        setRoomStore({
          isBufferWaiting: true,
          waitingForUsers: Array.isArray(waiting_for) ? waiting_for : []
        });
        break;
      }

      case "buffer_complete": {
        setRoomStore({
          isBufferWaiting: false,
          waitingForUsers: []
        });
        if (roomStore.isHost && playerStore.playbackState === "paused") {
          playerStore.audio.play().catch(() => {});
        }

        break;
      }

      case "host_changed": {
        const { new_host_id, new_host_name } = payload || {};
        const isSelfNowHost = new_host_id === roomStore.userId;
        setRoomStore("isHost", isSelfNowHost);
        localStorage.setItem("metro_is_host", isSelfNowHost ? "true" : "false");
        setRoomStore("users", (users: RoomUser[]) =>
          users.map((u: RoomUser) => ({
            ...u,
            isHost: u.userId === new_host_id
          }))
        );
        setStore("snackbar", `Host changed to ${new_host_name || "new host"}`);
        break;
      }

      case "kicked": {
        const reason = payload?.reason || "You have been removed from the room";
        setStore("snackbar", reason);
        this.leaveRoom();
        break;
      }

      case "suggestion_received": {
        const { suggestion_id, from_user_id, from_username, track_info } = payload || {};
        if (suggestion_id && track_info) {
          const trackItem: TrackItem = {
            id: track_info.id,
            title: track_info.title || "Suggested Song",
            author: track_info.artist || "Unknown Artist",
            authorId: "",
            duration: track_info.duration
              ? convertSStoHHMMSS(Math.floor(track_info.duration / 1000))
              : "0:00",
            img: track_info.thumbnail || `https://i.ytimg.com/vi/${track_info.id}/mqdefault.jpg`
          };
          const item: SongSuggestion = {
            suggestionId: suggestion_id,
            fromUserId: from_user_id,
            fromUsername: from_username || "Guest",
            trackInfo: trackItem,
            timestamp: Date.now()
          };
          setRoomStore("suggestions", (sugs: SongSuggestion[]) => [...sugs, item]);
          setStore("snackbar", `Song suggestion from ${from_username}: ${trackItem.title}`);
        }
        break;
      }

      case "suggestion_approved": {
        const { track_info } = payload || {};
        setStore("snackbar", `Your suggestion "${track_info?.title || "song"}" was approved!`);
        break;
      }

      case "suggestion_rejected": {
        const reason = payload?.reason ? `: ${payload.reason}` : "";
        setStore("snackbar", `Your suggestion was declined${reason}`);
        break;
      }

      case "reconnected": {
        const { room_code, user_id, state, is_host } = payload || {};
        setRoomStore({
          status: "connected",
          roomCode: room_code || roomStore.roomCode,
          userId: user_id || roomStore.userId,
          isHost: Boolean(is_host)
        });
        setStore("snackbar", `Reconnected to room ${room_code}`);
        if (state && !is_host) {
          this.applySyncState(state);
        }
        break;
      }

      case "pong": {
        const { client_time, server_receive_time, server_send_time } = payload || {};
        if (client_time) {
          const now = Date.now();
          const rtt = Math.max(0, now - client_time);
          const pingMs = Math.round(rtt / 2);
          const serverMid = ((server_receive_time || now) + (server_send_time || now)) / 2;
          const clientMid = client_time + rtt / 2;
          const offset = Math.round(serverMid - clientMid);

          setRoomStore({
            pingMs,
            serverTimeOffset: offset
          });
        }
        break;
      }

      case "error": {
        const errMsg = payload?.message || `Server error (${payload?.code || "unknown"})`;
        setRoomStore("errorMessage", errMsg);
        setStore("snackbar", errMsg);
        break;
      }

      default:
        console.log("Unhandled Metroserver event:", type, payload);
    }
  }

  private currentSyncedTrackId: string | null = null;
  private syncAbortController: AbortController | null = null;

  private abortSyncLoad(): void {
    if (this.syncAbortController) {
      this.syncAbortController.abort();
      this.syncAbortController = null;
    }
  }

  private async loadSyncTrack(trackId: string): Promise<void> {
    this.abortSyncLoad();
    this.syncAbortController = new AbortController();
    const signal = this.syncAbortController.signal;

    try {
      const { fetchPrimaryStream, playPrimaryStream } = await import('../modules/primaryStream');
      if (signal.aborted) return;
      const primaryData = await fetchPrimaryStream(trackId, signal);
      if (primaryData && !signal.aborted) {
        await playPrimaryStream(primaryData);
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      // primary stream failed — fall through to full player() outside sync scope
    }

    if (signal.aborted) return;

    // Fallback via player() — call it without passing our signal so it uses its own
    // abort controller. This is intentional: player() manages its own lifecycle.
    await player(trackId);
  }

  private async applySyncPlayback(payload: any): Promise<void> {
    if (!payload || !payload.action) return;
    const { action, track_id, position, track_info, queue, volume, server_time } = payload;

    setRoomStore("isApplyingRemoteSync", true);

    try {
      // --- Volume ---
      if (volume !== undefined && typeof volume === "number") {
        playerStore.audio.volume = Math.max(0, Math.min(1, volume));
        setPlayerStore("volume", playerStore.audio.volume);
      }

      // --- Full queue snapshot (piggy-backed on any event) ---
      if (Array.isArray(queue)) {
        const mappedQueue: TrackItem[] = queue.map((q: any) => ({
          id: q.id,
          title: q.title || "Song",
          author: q.artist || "",
          authorId: "",
          duration: q.duration ? convertSStoHHMMSS(Math.floor(q.duration / 1000)) : "0:00",
          img: q.thumbnail || `https://i.ytimg.com/vi/${q.id}/mqdefault.jpg`
        }));
        setQueueStore("list", mappedQueue);
      }

      // --- Pure volume: no further work ---
      if (action === "set_volume") return;

      // --- Queue mutations: synchronous, return immediately ---
      if (action === "queue_add" && track_info?.id) {
        const item: TrackItem = {
          id: track_info.id,
          title: track_info.title || "Song",
          author: track_info.artist || "",
          authorId: "",
          duration: track_info.duration ? convertSStoHHMMSS(Math.floor(track_info.duration / 1000)) : "0:00",
          img: track_info.thumbnail || `https://i.ytimg.com/vi/${track_info.id}/mqdefault.jpg`
        };
        setQueueStore("list", (list: TrackItem[]) => [...list, item]);
        return;
      }
      if (action === "queue_remove" && track_id) {
        setQueueStore("list", (list: TrackItem[]) => list.filter((t: TrackItem) => t.id !== track_id));
        return;
      }
      if (action === "queue_clear") {
        setQueueStore("list", []);
        return;
      }

      // --- Track change: async load, keep flag set until after play starts ---
      if (action === "change_track") {
        const targetTrackId = track_id || track_info?.id;
        if (targetTrackId) {
          this.currentSyncedTrackId = targetTrackId;
          setPlayerStore("stream", {
            id: targetTrackId,
            title: track_info?.title || playerStore.stream.title || "Now Playing",
            author: track_info?.artist || playerStore.stream.author || "",
            authorId: "",
            duration: track_info?.duration
              ? convertSStoHHMMSS(Math.floor(track_info.duration / 1000))
              : playerStore.stream.duration || "0:00",
            img: track_info?.thumbnail || `https://i.ytimg.com/vi/${targetTrackId}/mqdefault.jpg`
          });
          await this.loadSyncTrack(targetTrackId);
          this.sendBufferReady(targetTrackId);
          // Seek + play after load — position from server_time-corrected offset
          let seekPosSec = (position || 0) / 1000;
          if (server_time && roomStore.serverTimeOffset) {
            const elapsed = Math.max(0, (Date.now() + roomStore.serverTimeOffset - server_time) / 1000);
            seekPosSec += elapsed;
          }
          if (seekPosSec > 0) {
            playerStore.audio.currentTime = seekPosSec;
            setPlayerStore("currentTime", Math.floor(seekPosSec));
          }
          playerStore.audio.play().catch(() => {});
        }
        return; // finally will reset flag
      }

      // --- Play: seek if needed, then play ---
      if (action === "play") {
        let seekPosSec = (position || 0) / 1000;
        if (server_time && roomStore.serverTimeOffset) {
          const elapsed = Math.max(0, (Date.now() + roomStore.serverTimeOffset - server_time) / 1000);
          seekPosSec += elapsed;
        }
        if (Math.abs(playerStore.audio.currentTime - seekPosSec) > 1.5) {
          playerStore.audio.currentTime = seekPosSec;
          setPlayerStore("currentTime", Math.floor(seekPosSec));
        }
        playerStore.audio.play().catch(() => {});
        return;
      }

      // --- Pause ---
      if (action === "pause") {
        playerStore.audio.currentTime = (position || 0) / 1000;
        setPlayerStore("currentTime", Math.floor((position || 0) / 1000));
        playerStore.audio.pause();
        return;
      }

      // --- Seek ---
      if (action === "seek") {
        playerStore.audio.currentTime = (position || 0) / 1000;
        setPlayerStore("currentTime", Math.floor((position || 0) / 1000));
      }
    } finally {
      // Reset sync flag: immediately for fast actions, slight delay to cover
      // the onplaying event that fires async after audio.play() is called.
      const delay = action === "change_track" ? 2000 : 150;
      setTimeout(() => {
        setRoomStore("isApplyingRemoteSync", false);
      }, delay);
    }
  }



  private async applySyncState(state: any): Promise<void> {
    if (!state) return;
    const { current_track, is_playing, position, queue, volume, last_update } = state;

    setRoomStore("isApplyingRemoteSync", true);

    try {
      if (volume !== undefined && typeof volume === "number") {
        playerStore.audio.volume = Math.max(0, Math.min(1, volume));
        setPlayerStore("volume", playerStore.audio.volume);
      }

      if (Array.isArray(queue)) {
        const mappedQueue: TrackItem[] = queue.map((q: any) => ({
          id: q.id,
          title: q.title || "Song",
          author: q.artist || "",
          authorId: "",
          duration: q.duration ? convertSStoHHMMSS(Math.floor(q.duration / 1000)) : "0:00",
          img: q.thumbnail || `https://i.ytimg.com/vi/${q.id}/mqdefault.jpg`
        }));
        setQueueStore("list", mappedQueue);
      }

      if (current_track && current_track.id) {
        if (current_track.id !== this.currentSyncedTrackId && current_track.id !== playerStore.stream.id) {
          this.currentSyncedTrackId = current_track.id;
          const trackItem: TrackItem = {
            id: current_track.id,
            title: current_track.title || "Now Playing",
            author: current_track.artist || "",
            authorId: "",
            duration: current_track.duration
              ? convertSStoHHMMSS(Math.floor(current_track.duration / 1000))
              : "0:00",
            img: current_track.thumbnail || `https://i.ytimg.com/vi/${current_track.id}/mqdefault.jpg`
          };
          setPlayerStore("stream", trackItem);
          await this.loadSyncTrack(current_track.id);
          this.sendBufferReady(current_track.id);
        }

        let seekPosSec = (position || 0) / 1000;
        if (is_playing && last_update) {
          const now = Date.now() + roomStore.serverTimeOffset;
          const elapsed = Math.max(0, (now - last_update) / 1000);
          seekPosSec += elapsed;
        }

        playerStore.audio.currentTime = seekPosSec;
        setPlayerStore("currentTime", Math.floor(seekPosSec));

        if (is_playing) {
          playerStore.audio.play().catch(() => {});
        } else {
          playerStore.audio.pause();
        }
      }
    } finally {
      setTimeout(() => {
        setRoomStore("isApplyingRemoteSync", false);
      }, 1500);
    }
  }

}

export const metroClient = new MetroClient();
