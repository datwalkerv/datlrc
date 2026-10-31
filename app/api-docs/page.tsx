import type { Metadata } from "next";
import { ApiKey } from "@/components/ApiKey";

export const metadata: Metadata = { title: "API · datlrc", description: "Free synced lyrics API." };

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/api/get?artist_name=&track_name=&duration=", "Best match in the library: the same song within 2 seconds of the duration, else a close synced match. 404 if we don't have it."],
  ["GET", "/api/get/{id}", "One record by its lrc_ id."],
  ["GET", "/api/search?q=", "Songs in the library. Also takes track_name and artist_name."],
  [
    "POST",
    "/api/needs",
    "Report a song with no synced lyrics, so it shows on the Needs lyrics shelf. JSON with trackName, artistName and duration; albumName, videoId (YouTube) and artworkUrl (an iTunes or YouTube image) are optional. Repeat reports count up.",
  ],
  ["POST", "/api/publish", "JSON with trackName, artistName, duration and syncedLyrics (LRC). albumName, videoId and contributor are optional; instrumental: true needs no lyrics. Up to 10 per hour per IP."],
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
          Free, with CORS open. Generate a key below and send it as the <code className="font-mono text-white/80">x-api-key</code> header.
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
