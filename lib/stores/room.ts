import { createStore } from "solid-js/store";

export type RoomConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface RoomUser {
  userId: string;
  username: string;
  isHost?: boolean;
  isDisconnected?: boolean;
}

export interface JoinRequest {
  userId: string;
  username: string;
  timestamp: number;
}

export interface SongSuggestion {
  suggestionId: string;
  fromUserId: string;
  fromUsername: string;
  trackInfo: TrackItem;
  timestamp: number;
}

export interface RoomState {
  status: RoomConnectionStatus;
  roomCode: string;
  userId: string;
  username: string;
  sessionToken: string;
  isHost: boolean;
  users: RoomUser[];
  joinRequests: JoinRequest[];
  suggestions: SongSuggestion[];
  pingMs: number;
  serverTimeOffset: number;
  isBufferWaiting: boolean;
  waitingForUsers: string[];
  isApplyingRemoteSync: boolean;
  showModal: boolean;
  errorMessage: string;
}

const initialRoomState: RoomState = {
  status: 'disconnected',
  roomCode: '',
  userId: '',
  username: localStorage.getItem('metro_username') || '',
  sessionToken: localStorage.getItem('metro_session_token') || '',
  isHost: false,
  users: [],
  joinRequests: [],
  suggestions: [],
  pingMs: 0,
  serverTimeOffset: 0,
  isBufferWaiting: false,
  waitingForUsers: [],
  isApplyingRemoteSync: false,
  showModal: false,
  errorMessage: ''
};

export const [roomStore, setRoomStore] = createStore<RoomState>(initialRoomState);

export function resetRoomStore() {
  setRoomStore({
    status: 'disconnected',
    roomCode: '',
    userId: '',
    sessionToken: '',
    isHost: false,
    users: [],
    joinRequests: [],
    suggestions: [],
    pingMs: 0,
    serverTimeOffset: 0,
    isBufferWaiting: false,
    waitingForUsers: [],
    isApplyingRemoteSync: false,
    errorMessage: ''
  });
  localStorage.removeItem('metro_session_token');
  localStorage.removeItem('metro_room_code');
  localStorage.removeItem('metro_is_host');
}
