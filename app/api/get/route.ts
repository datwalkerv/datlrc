import type { NextRequest } from "next/server";
import { authorize, findOwn, lrclib, toRecord } from "@/lib/library";
import { notFound, KEYED, preflight } from "@/lib/http";
import type { LrcRecord } from "@/lib/record";

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
    const r = await lrclib<LrcRecord>("/get", params);
    return r ? Response.json(r, { headers: KEYED }) : notFound();
  } catch {
    return Response.json({ error: "lyrics lookup failed" }, { status: 502 });
  }
}

export const OPTIONS = preflight;
