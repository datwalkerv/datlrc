import type { NextRequest } from "next/server";
import { authorize, lrclib, searchOwn, toRecord } from "@/lib/library";
import { KEYED, preflight } from "@/lib/http";
import { pickLoose, type LrcRecord } from "@/lib/record";

/** LRCLIB-compatible /search (q, or track_name + artist_name). Ours first; `own=1` skips LRCLIB. */
export async function GET(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;
  const sp = req.nextUrl.searchParams;
  const get = (k: string) => sp.get(k)?.trim().slice(0, 200) ?? "";
  const q = get("q");
  const track = get("track_name");
  const artist = get("artist_name");
  if (!q && !track) return Response.json({ error: "q or track_name required" }, { status: 400 });

  try {
    const docs = await searchOwn(q || `${track} ${artist}`);
    const own = docs.map(toRecord);
    if (sp.get("own") === "1") return Response.json(own, { headers: KEYED });
    const params: Record<string, string> = q ? { q } : { track_name: track, ...(artist && { artist_name: artist }) };
    const theirs =
      (await lrclib<LrcRecord[]>("/search", params).catch((e) => {
        // LRCLIB is down. Ours alone are a safe answer only if one of our synced songs matches by
        // name (as /get's fallback would); otherwise fail, so callers don't cache a partial result.
        // q searches always fail: callers like datlyrics only send them after /get found nothing synced.
        if (!q && pickLoose(docs, artist, track, 0)) return null;
        throw e;
      })) ?? [];
    return Response.json([...own, ...theirs], { headers: KEYED });
  } catch {
    return Response.json({ error: "search failed" }, { status: 502 });
  }
}

export const OPTIONS = preflight;
