import type { NextRequest } from "next/server";
import { authorize, findOwn, lrclib, searchOwn, toRecord } from "@/lib/library";
import { notFound, KEYED, preflight } from "@/lib/http";
import { pickLoose, type LrcRecord } from "@/lib/record";

/** LRCLIB-compatible /get: our own submissions first, then LRCLIB. */
export async function GET(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;
  const sp = req.nextUrl.searchParams;
  const artist = sp.get("artist_name")?.trim().slice(0, 200) ?? "";
  const title = sp.get("track_name")?.trim().slice(0, 200) ?? "";
  const duration = Number(sp.get("duration")) || 0;
  if (!artist || !title) return Response.json({ error: "artist_name and track_name required" }, { status: 400 });

  try {
    const own = await findOwn(artist, title, duration);
    if (own) return Response.json(toRecord(own), { headers: KEYED });
    const params: Record<string, string> = { artist_name: artist, track_name: title };
    if (duration) params.duration = String(Math.round(duration));
    const r = await lrclib<LrcRecord>("/get", params).catch(async (e) => {
      // LRCLIB is down: answer from a looser look at our own songs, or stay an error (never a
      // 404) so callers don't cache "no lyrics" for an outage.
      const loose = pickLoose(await searchOwn(`${artist} ${title}`), artist, title, duration);
      if (!loose) throw e;
      return toRecord(loose);
    });
    return r ? Response.json(r, { headers: KEYED }) : notFound();
  } catch {
    return Response.json({ error: "lyrics lookup failed" }, { status: 502 });
  }
}

export const OPTIONS = preflight;
