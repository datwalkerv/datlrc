import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { lyrics, needs } from "@/lib/db";
import { parseId } from "@/lib/library";

function isAdmin(req: Request) {
  const token = process.env.ADMIN_TOKEN;
  const got = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const want = Buffer.from(token ?? "");
  return !!token && got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Admin-only removal of a submission or a "Needs lyrics" entry (e.g. spam):
 * `curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" /api/lyrics/<id>`.
 */
export async function DELETE(req: Request, { params }: RouteContext<"/api/lyrics/[id]">) {
  if (!isAdmin(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const _id = parseId(id);
  if (!_id) return Response.json({ error: "bad id" }, { status: 400 });
  const [a, b] = await Promise.all([lyrics.deleteOne({ _id }), needs.deleteOne({ _id })]);
  revalidateTag(`lyrics-${_id.toHexString()}`, { expire: 0 });
  revalidateTag("lyrics", { expire: 0 });
  revalidateTag("needs", { expire: 0 });
  return Response.json({ deleted: a.deletedCount + b.deletedCount });
}
