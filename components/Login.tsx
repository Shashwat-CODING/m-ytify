import { createSignal, Show } from "solid-js";
import AuthModal from "./AuthModal";

export default function Login() {
  const [open, setOpen] = createSignal(true);

  return (
    <Show when={open()}>
      <AuthModal onClose={() => setOpen(false)} />
    </Show>
  );
}
