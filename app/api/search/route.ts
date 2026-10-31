import type { NextRequest } from "next/server";
import { authorize, searchOwn, toRecord } from "@/lib/library";
import { KEYED, preflight } from "@/lib/http";

/** Searches the library (q, or track_name + artist_name). */
export async function GET(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;
  const sp = req.nextUrl.searchParams;
  const get = (k: string) => sp.get(k)?.trim().slice(0, 200) ?? "";
  const q = get("q") || `${get("track_name")} ${get("artist_name")}`.trim();
  if (!q) return Response.json({ error: "q or track_name required" }, { status: 400 });

  try {
    return Response.json((await searchOwn(q)).map(toRecord), { headers: KEYED });
  } catch {
    return Response.json({ error: "search failed" }, { status: 502 });
  }
}

export const OPTIONS = preflight;
