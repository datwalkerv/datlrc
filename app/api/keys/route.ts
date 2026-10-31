import { clientIpHash, createApiKey, isSameOrigin, takeSlot } from "@/lib/library";

/** Issues a key to the "Generate API key" button on /api-docs. */
export async function POST(req: Request) {
  // Only from our own page, so scripts have to go through a browser to mint keys.
  if (!isSameOrigin(req)) return Response.json({ error: "generate a key at /api-docs" }, { status: 403 });
  const ipHash = clientIpHash(req);
  try {
    if (!(await takeSlot(`keys:${ipHash}`, 3, 24 * 60 * 60 * 1000)))
      return Response.json({ error: "too many keys today, try again tomorrow" }, { status: 429 });
    return Response.json({ key: await createApiKey(ipHash) }, { status: 201 });
  } catch {
    return Response.json({ error: "could not create a key, try again" }, { status: 503 });
  }
}
