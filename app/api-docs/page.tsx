import type { Metadata } from "next";
import { ApiKey } from "@/components/ApiKey";

export const metadata: Metadata = { title: "API · datlrc", description: "Free, LRCLIB-compatible synced lyrics API." };

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/api/get?artist_name=&track_name=&duration=", "Best match for a song: our own lyrics within 2 seconds of the duration, otherwise LRCLIB's. 404 if neither has it."],
  ["GET", "/api/get/{id}", "One record. Ids starting with lrc_ are ours, plain numbers are LRCLIB's."],
  ["GET", "/api/search?q=", "Our matches first, then LRCLIB's. Also takes track_name and artist_name. Add own=1 for ours only."],
  ["POST", "/api/publish", "JSON with trackName, artistName, duration, and plainLyrics and/or syncedLyrics. albumName, videoId and instrumental are optional. Up to 10 per hour per IP."],
];

const EXAMPLE = `{
  "id": "lrc_6720ab12cd34ef5678901234",
  "trackName": "Shake It Off",
  "artistName": "Taylor Swift",
  "albumName": "1989",
  "duration": 219,
  "instrumental": false,
  "plainLyrics": "I stay out too late…",
  "syncedLyrics": "[00:12.30]I stay out too late…"
}`;

export default function ApiDocs() {
  return (
    <main className="px-5 pb-16 pt-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-tight tracking-[-0.04em]">API</h1>
        <p className="mt-3 max-w-2xl text-lg text-white/55">
          Free, with CORS open. Generate a key below and send it as the <code className="font-mono text-white/80">x-api-key</code> header. The responses
          use LRCLIB&apos;s shape, so an LRCLIB client only has to change its base URL and add the header.
        </p>
        <ApiKey />
        <dl className="mt-10 flex flex-col gap-px overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/10">
          {ENDPOINTS.map(([method, path, body]) => (
            <div key={path} className="bg-neutral-950 p-6">
              <dt className="flex flex-wrap items-center gap-3 font-mono text-sm">
                <span className="rounded-md bg-white/10 px-2 py-1 font-semibold">{method}</span>
                <span className="break-all text-white/85">{path}</span>
              </dt>
              <dd className="mt-3 text-white/55">{body}</dd>
            </div>
          ))}
        </dl>
        <h2 className="mt-12 text-2xl font-extrabold tracking-[-0.03em]">Response</h2>
        <pre className="mt-4 overflow-x-auto rounded-3xl bg-white/[0.04] p-6 font-mono text-sm text-white/75 ring-1 ring-white/10">{EXAMPLE}</pre>
      </div>
    </main>
  );
}
