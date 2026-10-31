// YouTube Music's web client: keyless and unofficial, so every field is optional and parsing is defensive.
const API = "https://music.youtube.com/youtubei/v1";

export async function call(endpoint: "search" | "browse", body: object): Promise<unknown> {
  const res = await fetch(`${API}/${endpoint}?prettyPrint=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://music.youtube.com" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20250101.01.00", hl: "en" } },
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`YouTube Music ${endpoint} ${res.status}`);
  return res.json();
}

type Runs = { runs?: { text: string }[] };
type Obj = Record<string, unknown>;

export const text = (r: unknown) => ((r as Runs | undefined)?.runs ?? []).map((x) => x.text).join("");

export function findAll(node: unknown, key: string, out: Obj[] = []): Obj[] {
  if (Array.isArray(node)) {
    for (const x of node) findAll(x, key, out);
  } else if (node && typeof node === "object") {
    const o = node as Obj;
    if (key in o) out.push(o[key] as Obj);
    else for (const v of Object.values(o)) findAll(v, key, out);
  }
  return out;
}
