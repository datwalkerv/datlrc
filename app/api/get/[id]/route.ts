import { authorize, lrclib, parseId, toRecord } from "@/lib/library";
import { lyrics } from "@/lib/db";
import { notFound, KEYED, preflight } from "@/lib/http";
import type { LrcRecord } from "@/lib/record";

/** "lrc_<objectId>" is ours; a plain number is an LRCLIB id. */
export async function GET(req: Request, { params }: RouteContext<"/api/get/[id]">) {
  const denied = await authorize(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    if (/^\d{1,12}$/.test(id)) {
      const r = await lrclib<LrcRecord>(`/get/${id}`, {});
      return r ? Response.json(r, { headers: KEYED }) : notFound();
    }
    const _id = parseId(id);
    const doc = _id && (await lyrics.findOne({ _id }));
    return doc ? Response.json(toRecord(doc), { headers: KEYED }) : notFound();
  } catch {
    return Response.json({ error: "lyrics lookup failed" }, { status: 502 });
  }
}

export const OPTIONS = preflight;
