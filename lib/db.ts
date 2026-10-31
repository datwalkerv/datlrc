import { MongoClient, type ObjectId } from "mongodb";

export type LyricsDoc = {
  _id: ObjectId;
  trackName: string;
  artistName: string;
  albumName: string | null;
  /** Normalised with `norm()` for exact lookups. */
  trackKey: string;
  artistKey: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
  videoId: string | null;
  /** Saved at publish: the iTunes cover, else the YouTube thumbnail. */
  artworkUrl: string | null;
  contributor: string | null;
  createdAt: Date;
  ipHash: string;
};

/** A song datlyrics found no synced lyrics for, waiting for a contributor. */
export type NeedDoc = {
  _id: ObjectId;
  trackName: string;
  artistName: string;
  albumName: string | null;
  trackKey: string;
  artistKey: string;
  duration: number;
  /** The cover datlyrics showed for it. */
  artworkUrl: string | null;
  /** The YouTube video datlyrics was playing, so the sync editor can open on it. */
  videoId: string | null;
  /** How many lookups asked for it: the most wanted come first. */
  requests: number;
  createdAt: Date;
  lastRequestedAt: Date;
};

type RateDoc = { _id: string; count: number; expiresAt: Date };

/** Keys are stored as sha256 hashes; the plaintext is only ever shown to its owner. */
type ApiKeyDoc = { _id: string; createdAt: Date; ipHash: string };

/** One client per function instance, reused across invocations and hot reloads; it connects lazily. */
const g = globalThis as unknown as { __mongo?: MongoClient; __indexes?: Promise<unknown> };
const client = (g.__mongo ??= new MongoClient(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017", {
  appName: "datlrc",
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 8_000,
}));
const db = client.db(process.env.MONGODB_DB_NAME ?? "datlrc");

export const lyrics = db.collection<LyricsDoc>("lyrics");
export const ratelimit = db.collection<RateDoc>("ratelimit");
export const apikeys = db.collection<ApiKeyDoc>("apikeys");
export const needs = db.collection<NeedDoc>("needs");

export function ensureIndexes() {
  return (g.__indexes ??= Promise.all([
    lyrics.createIndex({ artistKey: 1, trackKey: 1 }),
    lyrics.createIndex({ trackName: "text", artistName: "text", albumName: "text" }),
    lyrics.createIndex({ createdAt: -1 }),
    ratelimit.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    needs.createIndex({ artistKey: 1, trackKey: 1 }, { unique: true }),
    needs.createIndex({ requests: -1, lastRequestedAt: -1 }),
  ]).catch((e) => {
    g.__indexes = undefined;
    throw e;
  }));
}
