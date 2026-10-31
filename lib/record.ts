import { withoutFeat } from "./clean-title";
import { parseLrc } from "./lrc";

/** A lyrics record as the API returns it. Ids are "lrc_<objectId>". */
export type LrcRecord = {
  id: number | string;
  trackName: string;
  artistName: string;
  albumName: string | null;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

export type Submission = {
  trackName: string;
  artistName: string;
  albumName: string | null;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
  videoId: string | null;
  /** Free-text credit, shown on the page and the leaderboard. Not verified: there are no accounts. */
  contributor: string | null;
};

export const norm = (s: string) =>
  withoutFeat(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const MAX_NAME = 200;
const MAX_LYRICS = 20_000;
const MAX_CONTRIBUTOR = 40;

/** Checks a publish body from the outside world. Returns the clean submission or an error message. */
export function validateSubmission(body: unknown): Submission | string {
  if (!body || typeof body !== "object") return "body must be a JSON object";
  const b = body as Record<string, unknown>;
  const str = (k: string, max: number) => (typeof b[k] === "string" ? (b[k] as string).trim() : "").slice(0, max + 1);

  const trackName = str("trackName", MAX_NAME);
  const artistName = str("artistName", MAX_NAME);
  const albumName = str("albumName", MAX_NAME) || null;
  if (!trackName || !artistName) return "trackName and artistName are required";
  if (trackName.length > MAX_NAME || artistName.length > MAX_NAME || (albumName?.length ?? 0) > MAX_NAME)
    return `names must be at most ${MAX_NAME} characters`;

  const duration = Number(b.duration);
  if (!Number.isFinite(duration) || duration < 1 || duration > 3600) return "duration must be 1–3600 seconds";

  const videoId = b.videoId == null || b.videoId === "" ? null : String(b.videoId);
  if (videoId !== null && !/^[\w-]{11}$/.test(videoId)) return "videoId is not a YouTube video id";

  const contributor = str("contributor", MAX_CONTRIBUTOR).replace(/\s+/g, " ") || null;
  if ((contributor?.length ?? 0) > MAX_CONTRIBUTOR) return `contributor must be at most ${MAX_CONTRIBUTOR} characters`;

  const instrumental = b.instrumental === true;
  let plainLyrics = str("plainLyrics", MAX_LYRICS) || null;
  const syncedLyrics = str("syncedLyrics", MAX_LYRICS) || null;
  if ((plainLyrics?.length ?? 0) > MAX_LYRICS || (syncedLyrics?.length ?? 0) > MAX_LYRICS)
    return `lyrics must be at most ${MAX_LYRICS} characters`;

  if (syncedLyrics) {
    const lines = parseLrc(syncedLyrics);
    if (!lines.length) return "syncedLyrics has no timed lines";
    if (lines.at(-1)!.time > duration + 1) return "syncedLyrics runs past the song's duration";
    plainLyrics ??= lines.map((l) => l.text).join("\n").trim() || null;
  }
  // A synced lyrics library: words without timing aren't accepted (an instrumental has no words to time).
  if (!instrumental && !syncedLyrics) return "syncedLyrics are required unless the song is instrumental";

  return {
    trackName,
    artistName,
    albumName,
    duration: Math.round(duration),
    instrumental,
    plainLyrics: instrumental ? null : plainLyrics,
    syncedLyrics: instrumental ? null : syncedLyrics,
    videoId,
    contributor,
  };
}

const kebab = (s: string) => norm(s).replace(/\s+/g, "-").slice(0, 60);

/** "/lyrics/taylor-swift-shake-it-off-<objectId>": readable, and the id at the end is what counts. */
export const slugFor = (r: { _id: { toHexString(): string }; artistName: string; trackName: string }) =>
  [kebab(r.artistName), kebab(r.trackName), r._id.toHexString()].filter(Boolean).join("-");

export const idFromSlug = (slug: string) => slug.match(/(?:^|-)([a-f\d]{24})$/)?.[1] ?? null;

/** Among same-song records, the best one for a given length: within 2s, synced first, newest first. */
export function pickOwn<T extends { duration: number; syncedLyrics: string | null; createdAt: Date }>(
  docs: T[],
  duration: number,
): T | null {
  const fits = duration > 0 ? docs.filter((d) => Math.abs(d.duration - duration) <= 2) : docs;
  return (
    fits.toSorted((a, b) => Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics) || +b.createdAt - +a.createdAt)[0] ?? null
  );
}

/** Either name contains the other, after `norm()` ("Song (Remastered)" matches "Song"). */
const near = (x: string, y: string) => !!x && !!y && (x.includes(y) || y.includes(x));
const sameSong = (r: { trackName: string; artistName: string }, artist: string, title: string) =>
  near(norm(r.trackName), norm(title)) && near(norm(r.artistName), norm(artist));

/**
 * The closest synced record by name, up to 45s off in length (any length when `duration` is 0),
 * closest length first. Plain-only records don't count.
 */
export function pickLoose<T extends { trackName: string; artistName: string; duration: number; syncedLyrics: string | null; createdAt?: Date }>(
  docs: T[],
  artist: string,
  title: string,
  duration: number,
): T | null {
  const off = (d: T) => (duration > 0 ? Math.abs(d.duration - duration) : 0);
  return (
    docs
      .filter((d) => d.syncedLyrics && sameSong(d, artist, title) && off(d) <= 45)
      .toSorted((x, y) => off(x) - off(y) || +(y.createdAt ?? 0) - +(x.createdAt ?? 0))[0] ?? null
  );
}

/** A song reported to the "Needs lyrics" shelf, as datlyrics sends it. */
export type NeedReport = {
  trackName: string;
  artistName: string;
  albumName: string | null;
  duration: number;
  artworkUrl: string | null;
  videoId: string | null;
};

// Covers are shown on the home page, so only the image hosts datlyrics uses (iTunes, YouTube) are accepted.
const ARTWORK_HOST = /^(?:[\w-]+\.)*mzstatic\.com$|^i\.ytimg\.com$/;

/** Checks a needs report from the outside world. Returns the clean report or an error message. */
export function validateNeed(body: unknown): NeedReport | string {
  if (!body || typeof body !== "object") return "body must be a JSON object";
  const b = body as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");

  const trackName = str("trackName");
  const artistName = str("artistName");
  const albumName = str("albumName") || null;
  if (!trackName || !artistName) return "trackName and artistName are required";
  if (trackName.length > MAX_NAME || artistName.length > MAX_NAME || (albumName?.length ?? 0) > MAX_NAME)
    return `names must be at most ${MAX_NAME} characters`;

  const duration = Number(b.duration ?? 0);
  if (!Number.isFinite(duration) || duration < 0 || duration > 3600) return "duration must be 0–3600 seconds";

  const videoId = str("videoId") || null;
  if (videoId !== null && !/^[\w-]{11}$/.test(videoId)) return "videoId is not a YouTube video id";

  const artworkUrl = str("artworkUrl") || null;
  if (artworkUrl !== null) {
    let url: URL | null = null;
    try {
      url = new URL(artworkUrl);
    } catch {}
    if (!url || url.protocol !== "https:" || !ARTWORK_HOST.test(url.hostname) || artworkUrl.length > 500)
      return "artworkUrl must be an https iTunes (mzstatic.com) or YouTube (i.ytimg.com) image";
  }

  return { trackName, artistName, albumName, duration: Math.round(duration), artworkUrl, videoId };
}
