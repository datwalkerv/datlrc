import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { lyrics } from "@/lib/db";
import { parseId } from "@/lib/library";

function isAdmin(req: Request) {
  const token = process.env.ADMIN_TOKEN;
  const got = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const want = Buffer.from(token ?? "");
  return !!token && got.length === want.length && timingSafeEqual(got, want);
}

/** Admin-only removal: `curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" /api/lyrics/<id>`. */
export async function DELETE(req: Request, { params }: RouteContext<"/api/lyrics/[id]">) {
  if (!isAdmin(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const _id = parseId(id);
  if (!_id) return Response.json({ error: "bad id" }, { status: 400 });
  const { deletedCount } = await lyrics.deleteOne({ _id });
  revalidateTag(`lyrics-${_id.toHexString()}`, { expire: 0 });
  revalidateTag("lyrics", { expire: 0 });
  return Response.json({ deleted: deletedCount });
}
