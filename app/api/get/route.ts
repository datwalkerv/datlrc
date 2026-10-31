import type { NextRequest } from "next/server";
import { authorize, findOwn, searchOwn, toRecord } from "@/lib/library";
import { notFound, KEYED, preflight } from "@/lib/http";
import { pickLoose } from "@/lib/record";

/** The library's best match for a song: same song within 2s, else a looser synced match. */
export async function GET(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;
  const sp = req.nextUrl.searchParams;
  const artist = sp.get("artist_name")?.trim().slice(0, 200) ?? "";
  const title = sp.get("track_name")?.trim().slice(0, 200) ?? "";
  const duration = Number(sp.get("duration")) || 0;
  if (!artist || !title) return Response.json({ error: "artist_name and track_name required" }, { status: 400 });

  try {
    const own = (await findOwn(artist, title, duration)) ?? pickLoose(await searchOwn(`${artist} ${title}`), artist, title, duration);
    return own ? Response.json(toRecord(own), { headers: KEYED }) : notFound();
  } catch {
    return Response.json({ error: "lyrics lookup failed" }, { status: 502 });
  }
}

export const OPTIONS = preflight;
