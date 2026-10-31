import { revalidateTag } from "next/cache";
import { authorize, recordNeed } from "@/lib/library";
import { KEYED, preflight } from "@/lib/http";
import { validateNeed } from "@/lib/record";

/**
 * Reports a song with no synced lyrics, for the home page's "Needs lyrics" shelf. Body:
 * { trackName, artistName, albumName?, duration, artworkUrl?, videoId? }. Repeat reports count up.
 */
export async function POST(req: Request) {
  const denied = await authorize(req);
  if (denied) return denied;
  const n = validateNeed(await req.json().catch(() => null));
  if (typeof n === "string") return Response.json({ error: n }, { status: 400, headers: KEYED });

  try {
    await recordNeed(n);
    revalidateTag("needs", "max");
    return Response.json({ ok: true }, { status: 202, headers: KEYED });
  } catch {
    return Response.json({ error: "could not save, try again" }, { status: 503, headers: KEYED });
  }
}

export const OPTIONS = preflight;
