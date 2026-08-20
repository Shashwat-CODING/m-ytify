import { setStore } from "@stores";

export const MUZO_BASE_URL = "https://m-ytify.muzo.dpdns.org";

export interface MuzoUser {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  avatar_url?: string;
  has_password?: boolean;
  has_google?: boolean;
}

export interface AuthState {
  token: string | null;
  user: MuzoUser | null;
  isGuest: boolean;
}

export function getAuthToken(): string | null {
  return localStorage.getItem("muzo_token");
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem("muzo_token", token);
  } else {
    localStorage.removeItem("muzo_token");
  }
}

export function getStoredUser(): MuzoUser | null {
  const user = localStorage.getItem("muzo_user");
  if (!user) return null;
  try {
    return JSON.parse(user);
  } catch {
    return null;
  }
}

export function setStoredUser(user: MuzoUser | null) {
  if (user) {
    localStorage.setItem("muzo_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("muzo_user");
  }
}

export function isGuestUser(): boolean {
  return localStorage.getItem("muzo_guest") === "true";
}

export function setGuestUser(isGuest: boolean) {
  if (isGuest) {
    localStorage.setItem("muzo_guest", "true");
  } else {
    localStorage.removeItem("muzo_guest");
  }
}

export function hasSeenOnboarding(): boolean {
  return localStorage.getItem("muzo_onboarded") === "true" || Boolean(getAuthToken());
}

export function setSeenOnboarding(seen: boolean) {
  if (seen) {
    localStorage.setItem("muzo_onboarded", "true");
  } else {
    localStorage.removeItem("muzo_onboarded");
  }
}

export async function muzoFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http") ? path : `${MUZO_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  return fetch(url, {
    ...options,
    headers,
  });
}

export async function loginWithEmail(email: string, password: string): Promise<{ token: string; user: MuzoUser }> {
  const res = await muzoFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Login failed");
  }

  setAuthToken(data.token);
  setStoredUser(data.user);
  setGuestUser(false);
  setSeenOnboarding(true);

  return data;
}

export async function signUpWithEmail(username: string, email: string, password: string): Promise<{ token: string; user: MuzoUser }> {
  const res = await muzoFetch("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Signup failed");
  }

  setAuthToken(data.token);
  setStoredUser(data.user);
  setGuestUser(false);
  setSeenOnboarding(true);

  return data;
}

export async function fetchUserProfile(): Promise<MuzoUser | null> {
  if (!getAuthToken()) return null;
  try {
    const res = await muzoFetch("/api/user/profile");
    if (!res.ok) {
      if (res.status === 401) {
        logout();
      }
      return null;
    }
    const user: MuzoUser = await res.json();
    setStoredUser(user);
    return user;
  } catch {
    return null;
  }
}

export function logout() {
  setAuthToken(null);
  setStoredUser(null);
  setGuestUser(true);
  setStore("syncState", undefined);
}
