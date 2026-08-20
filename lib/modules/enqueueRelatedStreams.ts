import { enqueueRelatedSongs } from "./relatedQueue";
import { playerStore } from "@stores";

export default function enqueueRelatedStreams(_fallbackData?: any[]) {
  if (playerStore.stream.id) {
    enqueueRelatedSongs(playerStore.stream.id, { silent: true });
  }
}
