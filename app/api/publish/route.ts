import { revalidateTag } from "next/cache";
import { authorize, clientIpHash, insertLyrics, takeSlot, toRecord } from "@/lib/library";
import { KEYED, preflight } from "@/lib/http";
import { slugFor, validateSubmission } from "@/lib/record";

export async function POST(req: Request) {
  const denied = await authorize(req);
  if (denied) return denied;
  // 64 KB is far more than two 20k-character lyrics plus names.
  const raw = await req.text();
  if (raw.length > 64_000) return Response.json({ error: "body too large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const s = validateSubmission(body);
  if (typeof s === "string") return Response.json({ error: s }, { status: 400 });

  const ipHash = clientIpHash(req);
  try {
    if (!(await takeSlot(`publish:${ipHash}`, 10)))
      return Response.json({ error: "too many submissions, try again in an hour" }, { status: 429 });
    const doc = await insertLyrics(s, ipHash);
    revalidateTag("lyrics", "max");
    if (doc.syncedLyrics) revalidateTag("needs", "max");
    return Response.json({ ...toRecord(doc), slug: slugFor(doc) }, { status: 201, headers: KEYED });
  } catch {
    return Response.json({ error: "could not save, try again" }, { status: 503 });
  }
}

export const OPTIONS = preflight;
