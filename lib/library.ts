import { createHash, randomBytes } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { ObjectId } from "mongodb";
import { findArtwork } from "./artwork-source";
import { apikeys, ensureIndexes, lyrics, ratelimit, type LyricsDoc } from "./db";
import { KEYED } from "./http";
import { norm, pickOwn, slugFor, type LrcRecord, type Submission } from "./record";

const LRCLIB = "https://lrclib.net/api";
const UA = "datlrc/0.1 (https://github.com/datwalkerv/datlrc)";

export const toRecord = (d: LyricsDoc): LrcRecord => ({
  id: `lrc_${d._id.toHexString()}`,
  trackName: d.trackName,
  artistName: d.artistName,
  albumName: d.albumName,
  duration: d.duration,
  instrumental: d.instrumental,
  plainLyrics: d.plainLyrics,
  syncedLyrics: d.syncedLyrics,
});

/** Accepts "lrc_<objectId>" or a bare objectId. */
export function parseId(id: string): ObjectId | null {
  const hex = id.replace(/^lrc_/, "");
  return /^[a-f\d]{24}$/.test(hex) ? new ObjectId(hex) : null;
}

export async function lrclib<T>(path: string, params: Record<string, string>): Promise<T | null> {
  "use cache";
  cacheLife("days");

  const res = await fetch(`${LRCLIB}${path}?${new URLSearchParams(params)}`, {
    headers: { "User-Agent": UA, "Lrclib-Client": UA },
  });
  if (res.status === 404) return null;
  // Throw on other failures so a transient outage isn't cached as "no lyrics".
  if (!res.ok) throw new Error(`LRCLIB ${path} ${res.status}`);
  return (await res.json()) as T;
}

export async function findOwn(artist: string, title: string, duration: number): Promise<LyricsDoc | null> {
  const docs = await lyrics.find({ artistKey: norm(artist), trackKey: norm(title) }).limit(50).toArray();
  return pickOwn(docs, duration);
}

export async function searchOwn(q: string, limit = 20): Promise<LyricsDoc[]> {
  if (!q.trim()) return [];
  await ensureIndexes();
  return lyrics
    .find({ $text: { $search: q } }, { projection: { score: { $meta: "textScore" } } })
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .toArray();
}

export type LyricsView = Omit<LyricsDoc, "_id" | "ipHash" | "trackKey" | "artistKey"> & { id: string; slug: string };

/** Cached results must be plain data, so the ObjectId becomes a hex string. */
export async function getLyrics(id: string): Promise<LyricsView | null> {
  "use cache";
  cacheLife("max");
  cacheTag(`lyrics-${id}`);

  const _id = parseId(id);
  const d = _id && (await lyrics.findOne({ _id }, { projection: { ipHash: 0, trackKey: 0, artistKey: 0 } }));
  if (!d) return null;
  const { _id: oid, ...rest } = d;
  return { ...rest, id: oid.toHexString(), slug: slugFor(d) };
}

export type LeaderboardRow = { name: string; total: number; synced: number };

/** Contributors by number of songs, names matched case-insensitively. */
export async function leaderboard(limit = 50): Promise<LeaderboardRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("lyrics");

  return lyrics
    .aggregate<LeaderboardRow>([
      { $match: { contributor: { $type: "string" } } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: { $toLower: "$contributor" },
          name: { $last: "$contributor" }, // their most recent spelling
          total: { $sum: 1 },
          synced: { $sum: { $cond: [{ $ne: ["$syncedLyrics", null] }, 1, 0] } },
        },
      },
      { $sort: { total: -1, synced: -1, name: 1 } },
      { $limit: limit },
      { $project: { _id: 0, name: 1, total: 1, synced: 1 } },
    ])
    .toArray();
}

export async function recentLyrics(
  limit = 6,
): Promise<(Pick<LyricsDoc, "trackName" | "artistName" | "artworkUrl"> & { slug: string; synced: boolean })[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("lyrics");

  const docs = await lyrics
    .find({}, { projection: { trackName: 1, artistName: 1, syncedLyrics: 1, artworkUrl: 1 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => ({
    trackName: d.trackName,
    artistName: d.artistName,
    artworkUrl: d.artworkUrl ?? null,
    slug: slugFor(d),
    synced: !!d.syncedLyrics,
  }));
}

/** Salted so stored hashes can't be reversed by hashing every IPv4 address. */
export const hashIp = (ip: string) =>
  createHash("sha256").update(`${process.env.ADMIN_TOKEN ?? ""}:${ip}`).digest("hex").slice(0, 32);

/** Vercel sets x-forwarded-for; its first entry is the client. */
export const clientIpHash = (req: Request) => hashIp(req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown");

/** Fixed-window counter in MongoDB (serverless instances share no memory). True if allowed. */
export async function takeSlot(key: string, limit: number, windowMs = 60 * 60 * 1000): Promise<boolean> {
  await ensureIndexes();
  const doc = await ratelimit.findOneAndUpdate(
    { _id: key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + windowMs) } },
    { upsert: true, returnDocument: "after" },
  );
  return (doc?.count ?? 0) <= limit;
}

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export async function createApiKey(ipHash: string): Promise<string> {
  const key = `dlrc_${randomBytes(24).toString("base64url")}`;
  await apikeys.insertOne({ _id: hashKey(key), createdAt: new Date(), ipHash });
  return key;
}

/** Browsers set Sec-Fetch-Site and page scripts can't change it, so this means "our own pages". */
export const isSameOrigin = (req: Request) => req.headers.get("sec-fetch-site") === "same-origin";

/**
 * Our own pages pass; everyone else needs an `x-api-key` from /api-docs.
 * Returns the response to send when the caller isn't allowed, or null.
 */
export async function authorize(req: Request): Promise<Response | null> {
  if (isSameOrigin(req)) return null;
  const key = req.headers.get("x-api-key")?.trim();
  if (!key || key.length > 100) return Response.json({ error: "API key required, get one at /api-docs" }, { status: 401, headers: KEYED });
  try {
    if (await apikeys.findOne({ _id: hashKey(key) }, { projection: { _id: 1 } })) return null;
  } catch {
    return Response.json({ error: "could not check API key, try again" }, { status: 503, headers: KEYED });
  }
  return Response.json({ error: "invalid API key" }, { status: 401, headers: KEYED });
}

/** iTunes' album cover when it knows the song, else the video's thumbnail (maxres only exists for HD uploads). */
async function artworkFor(s: Submission): Promise<string | null> {
  const itunes = await findArtwork(s.artistName, s.trackName).catch(() => null);
  if (itunes || !s.videoId) return itunes;
  const maxres = `https://i.ytimg.com/vi/${s.videoId}/maxresdefault.jpg`;
  const ok = await fetch(maxres, { method: "HEAD" }).then((r) => r.ok, () => false);
  return ok ? maxres : `https://i.ytimg.com/vi/${s.videoId}/hqdefault.jpg`;
}

export async function insertLyrics(s: Submission, ipHash: string): Promise<LyricsDoc> {
  const [, artworkUrl] = await Promise.all([ensureIndexes(), artworkFor(s)]);
  const doc: LyricsDoc = {
    _id: new ObjectId(),
    ...s,
    artworkUrl,
    trackKey: norm(s.trackName),
    artistKey: norm(s.artistName),
    createdAt: new Date(),
    ipHash,
  };
  await lyrics.insertOne(doc);
  return doc;
}
