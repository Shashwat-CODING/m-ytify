import { createSignal, Show } from "solid-js";
import { loginWithEmail, signUpWithEmail, setGuestUser, setSeenOnboarding, MuzoUser } from "@modules/muzoAuth";
import { pullMuzoUserData } from "@modules/muzoSync";
import { setStore, t } from "@stores";

export default function AuthModal(props: {
  onClose: () => void;
  initialMode?: "login" | "signup";
  isFirstLaunch?: boolean;
}) {
  const [mode, setMode] = createSignal<"login" | "signup">(props.initialMode || "login");
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  let dialogRef!: HTMLDialogElement;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (loading()) return;
    setError("");

    setLoading(true);
    setStore("snackbar", t("loading"));

    try {
      let result: { token: string; user: MuzoUser };
      if (mode() === "signup") {
        if (!username() || !email() || !password()) {
          throw new Error("Please fill all required fields");
        }
        result = await signUpWithEmail(username().trim(), email().trim(), password());
      } else {
        if (!email() || !password()) {
          throw new Error("Please provide email and password");
        }
        result = await loginWithEmail(email().trim(), password());
      }

      setStore("snackbar", `Welcome, ${result.user.username || result.user.email}!`);
      pullMuzoUserData();
      props.onClose();
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      setStore("snackbar", err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    setGuestUser(true);
    setSeenOnboarding(true);
    props.onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      class="displayer auth-modal"
      open
      style={{
        "position": "fixed",
        "top": "0",
        "left": "0",
        "width": "100dvw",
        "height": "100dvh",
        "max-width": "100dvw",
        "max-height": "100dvh",
        "background": "color-mix(in srgb, var(--trueBg) 95%, transparent)",
        "backdrop-filter": "blur(30px)",
        "-webkit-backdrop-filter": "blur(30px)",
        "display": "flex",
        "align-items": "center",
        "justify-content": "center",
        "z-index": "999",
        "padding": "var(--size-4)",
        "border": "none",
        "margin": "0"
      }}
    >
      <div class="auth-container" style={{
        display: "flex",
        "flex-direction": "column",
        gap: "var(--size-4)",
        width: "100%",
        "max-width": "390px",
        padding: "var(--size-6)",
        background: "rgba(255, 255, 255, 0.05)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        "border-radius": "1.5rem",
        "box-shadow": "0 24px 60px rgba(0, 0, 0, 0.6)"
      }}>
        
        <header style={{ display: "flex", "align-items": "center", "justify-content": "space-between" }}>
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            <h3 style={{
              margin: "0",
              "font-size": "1.5rem",
              "font-weight": "800",
              "letter-spacing": "-0.03em"
            }}>
              {mode() === "login" ? "Welcome Back" : "Create Account"}
            </h3>
            <span style={{ "font-size": "0.85rem", opacity: "0.7" }}>
              {mode() === "login"
                ? "Sign in to sync your playlists & history."
                : "Sign up to unlock real-time cloud sync."}
            </span>
          </div>
          <Show when={!props.isFirstLaunch}>
            <button
              type="button"
              class="ri-close-large-line"
              aria-label="Close"
              onclick={handleGuest}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                "font-size": "var(--font-size-2)",
                color: "inherit"
              }}
            />
          </Show>
        </header>

        <p style={{ margin: "0", "font-size": "var(--font-size-0)", opacity: "0.8" }}>
          {mode() === "login"
            ? "Sign in to sync your playlists, history, and favorites across devices."
            : "Sign up to unlock real-time cloud sync and backup your music library."}
        </p>

        <Show when={error()}>
          <div style={{
            color: "var(--red-5, #ff5555)",
            "font-size": "var(--font-size-0)",
            padding: "var(--size-1) var(--size-2)",
            background: "rgba(255, 80, 80, 0.1)",
            "border-radius": "var(--roundness)"
          }}>
            {error()}
          </div>
        </Show>

        <form onsubmit={handleSubmit} style={{ display: "flex", "flex-direction": "column", gap: "var(--size-2)" }}>
          <Show when={mode() === "signup"}>
            <input
              type="text"
              placeholder="Username"
              required
              disabled={loading()}
              value={username()}
              oninput={(e) => setUsername(e.target.value)}
              autocomplete="username"
            />
          </Show>

          <input
            type="email"
            placeholder="Email address"
            required
            disabled={loading()}
            value={email()}
            oninput={(e) => setEmail(e.target.value)}
            autocomplete="email"
          />

          <input
            type="password"
            placeholder="Password"
            required
            disabled={loading()}
            value={password()}
            oninput={(e) => setPassword(e.target.value)}
            autocomplete={mode() === "signup" ? "new-password" : "current-password"}
          />

          <button
            type="submit"
            disabled={loading()}
            style={{
              padding: "var(--size-2)",
              "margin-top": "var(--size-2)",
              "background-color": "var(--text)",
              "color": "var(--trueBg, #000)",
              "border-radius": "var(--roundness)",
              "font-weight": "600",
              cursor: "pointer",
              border: "none"
            }}
          >
            {loading()
              ? "Please wait..."
              : (mode() === "login" ? "Sign In" : "Sign Up")}
          </button>
        </form>

        <div style={{
          display: "flex",
          "justify-content": "space-between",
          "align-items": "center",
          "margin-top": "var(--size-1)",
          "font-size": "var(--font-size-0)"
        }}>
          <button
            type="button"
            onclick={() => setMode(mode() === "login" ? "signup" : "login")}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              "text-decoration": "underline",
              cursor: "pointer",
              padding: "0"
            }}
          >
            {mode() === "login"
              ? "Need an account? Sign up"
              : "Already have an account? Sign in"}
          </button>

          <button
            type="button"
            onclick={handleGuest}
            style={{
              background: "none",
              border: "none",
              opacity: "0.85",
              color: "inherit",
              cursor: "pointer",
              padding: "0"
            }}
          >
            Continue as Guest &rarr;
          </button>
        </div>

      </div>
    </dialog>
  );
}
