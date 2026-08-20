# ytify - Routes & Usage Guide

Comprehensive documentation for all routes, parameters, views, and setup instructions for [ytify](https://github.com/n-ce/ytify).

---

## 1. URL Routes & Query Parameters

ytify is a Single Page Application (SPA) built with SolidJS that dynamically manages navigation and playback through URL query parameters and paths.

| Route / Parameter | Example | Description |
| :--- | :--- | :--- |
| `/s/:id` or `/?s=<video_id>` | `/?s=dQw4w9WgXcQ` | Directly loads and plays a YouTube track/stream by its ID. |
| `/?s=<video_id>&t=<seconds>` | `/?s=dQw4w9WgXcQ&t=45` | Starts playback of a track at a specific timestamp (in seconds). |
| `/?q=<query>&f=<filter>` | `/?q=coldplay&f=songs` | Opens search with the given query and filter (`all`, `songs`, `videos`, `albums`, `artists`, `playlists`). |
| `/?playlist=<playlist_id>` | `/?playlist=PL...` | Opens a YouTube playlist in the List view. |
| `/?album=<album_id>` | `/?album=MPREb_...` | Opens a YouTube Music album in the List view. |
| `/?artist=<browse_or_channel_id>` | `/?artist=UC...` | Opens an artist page in the List view. |
| `/?channel=<channel_id>` | `/?channel=UC...` | Opens a channel page in the List view. |
| `/?collection=<collection_id>` | `/?collection=my-list` | Loads a custom local collection/playlist. |
| `/?si=<share_id>` | `/?si=abc123xyz` | Imports a shared collection via Cloudflare / Netlify storage. |
| `/?url=<shared_link>` / `/?text=<text>` | PWA share target | Handles shared links when launched via Android / PWA share sheet. |

---

## 2. Main Views & Panels

Navigation is managed dynamically via `navStore`:

### Main Views (`navStore.active`)
- **Search (`search`)**: YouTube and YouTube Music search with live autocomplete suggestions and filter categories.
- **Library (`library`)**: Local playback history, saved favorites, custom playlists/collections, and subscription feeds.
- **List (`list`)**: Dedicated display for playlists, albums, artist tracks, and collections.
- **Settings (`settings`)**: App configuration (audio quality, backend instance/proxy, UI theming, PWA share actions, import/export, and language preferences).

### Side Panels / Overlays
- **Player (`player`)**: Fullscreen music player with synchronized lyrics (LRCLIB), audio scrubber, and queue shortcuts.
- **Queue (`queue`)**: Drag-and-drop playlist queue with reordering, track removal, and radio mode toggle.
- **MiniPlayer**: Docked player bar at the bottom for persistent controls across navigation.

---

## 3. How to Run Locally

### Prerequisites
- Node.js (v18+)
- npm

### Installation & Execution
```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev -- --open

# 3. Build for production
npm run build

# 4. Preview the production build
npm run preview
```

---

## 4. How to Use

1. **Search & Stream**: Enter a song or artist name in the Search bar, or paste a YouTube video/playlist link directly. Click any track to start playback.
2. **Bottom Navigation**: Switch between **Search**, **Library**, **List**, and toggle the **Queue** using the bottom navigation bar.
3. **Lyrics & Full Player**: Click on the MiniPlayer at the bottom to open the full player with time-synced lyrics.
4. **PWA Mode**: Install ytify as a Progressive Web App on mobile or desktop for background playback and share target integration.
