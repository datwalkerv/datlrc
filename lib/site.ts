export const GITHUB_URL = "https://github.com/datwalkerv/datlrc";
export const DATLYRICS_URL = "https://lyrics.datwalkerv.app";

export const DONATE = [
  { coin: "BTC", address: "bc1qf2pnd0uglrq58h0vnvh5p0rajz8w8lgdey00zc" },
  { coin: "SOL", address: "DNf9BRzBXEfudCw8g6JXQ3wJjZ5Su1ddfL5Pchkcyaf5" },
];

/** Opens the sync editor on a wanted song: the video datlyrics played if known, else a prefilled search. */
export function syncHref(n: { trackName: string; artistName: string; albumName: string | null; videoId: string | null }) {
  return `/sync?${new URLSearchParams({
    ...(n.videoId ? { v: n.videoId } : { q: `${n.artistName} ${n.trackName}` }),
    track: n.trackName,
    artist: n.artistName,
    ...(n.albumName && { album: n.albumName }),
  })}`;
}
