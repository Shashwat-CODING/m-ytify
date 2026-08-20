import { playerStore, setPlayerStore } from "@stores";
import { config, generateImageUrl } from "@utils";


export default async function(data: TrackItem) {

  setPlayerStore('stream', data);

  // remove ' - Topic' from author name if it exists

  let music = false;
  let authorText = playerStore.stream.author || '';
  if (data.author?.endsWith(' - Topic')) {
    music = true;
    authorText = data.author.slice(0, -8);
  }

  setPlayerStore('isMusic', music);

  const metadataObj: MediaMetadataInit = {
    title: data.title,
    artist: authorText,
    album: playerStore.context.src
  };

  let img = generateImageUrl((data as any).img || '', 'maxres', music);

  // Emergency fallback: If no thumbnail URL exists anywhere, query search metadata API
  if (!img && data.id) {
    try {
      const cleanId = data.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 11);
      const res = await fetch(`https://api.muzo.dpdns.org/api/search?q=${encodeURIComponent(cleanId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.results && Array.isArray(json.results) && json.results.length > 0) {
          const first = json.results[0];
          const foundThumb = first.thumbnails?.[first.thumbnails.length - 1]?.url || first.thumbnails?.[0]?.url;
          if (foundThumb) {
            img = foundThumb;
          }
        }
      }
    } catch {
      // Emergency query failure is non-blocking
    }
  }

  // Increase resolution for googleusercontent images to 500x500 for player
  if (img && img.includes('googleusercontent.com')) {
    img = img.replace(/=w\d+-h\d+[^?#]*/, '=w500-h500-l90-rj');
    if (!img.includes('=w500-h500')) {
      img = img.replace(/=s\d+[^?#]*/, '=s500-c-k-c0x00ffffff-no-rj');
    }
  }

  if (config.loadImage) {
    setPlayerStore('mediaArtwork', img);

    metadataObj.artwork = [
      { src: img, sizes: '96x96' },
      { src: img, sizes: '128x128' },
      { src: img, sizes: '192x192' },
      { src: img, sizes: '256x256' },
      { src: img, sizes: '384x384' },
      { src: img, sizes: '512x512' },
    ]
  }

  document.title = data.title + ' - m-ytify';


  if ('mediaSession' in navigator) {
    import('@modules/mediaSession').then(m => {
      m.updateMediaSessionPosition();
      navigator.mediaSession.metadata = new MediaMetadata(metadataObj);
    });
  }

}
