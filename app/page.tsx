import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { recentLyrics } from "@/lib/library";
import { LibrarySearch } from "@/components/LibrarySearch";

export default function Home() {
  return (
    <main className="relative">
      <section className="relative px-5 pb-24 pt-10 lg:pt-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h1 className="text-[clamp(3rem,7vw,5.5rem)] font-extrabold leading-[0.95] tracking-[-0.05em]">
            Every lyric,
            <br />
            <span className="text-white/40">in sync.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-white/55">
            An open library of synced lyrics. Find a song, or tap along to one and add it for everyone.
          </p>
          <LibrarySearch />
          <Link
            href="/sync"
            className="mt-8 flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-neutral-950 transition hover:scale-[1.03] hover:bg-white/90"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Sync a song
          </Link>
        </div>
      </section>

      <section className="px-5 pb-20" aria-labelledby="recent">
        <div className="mx-auto max-w-6xl">
          <h2 id="recent" className="text-xs font-medium uppercase tracking-[0.2em] text-white/30 max-sm:text-center">
            Recently added
          </h2>
          <Suspense fallback={<div className="mt-6 h-40" />}>
            <Recent />
          </Suspense>
        </div>
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/10 sm:grid-cols-3">
          {[
            ["Tap to sync", "Play the song, press Space as each line starts. Nudge, preview karaoke-style, publish."],
            ["Free API", "LRCLIB-compatible endpoints with a free key. Falls back to LRCLIB when we don't have a song yet."],
            ["Sing along", "Every song links straight to datlyrics, the synced lyrics player for the big screen."],
          ].map(([title, body]) => (
            <div key={title} className="bg-neutral-950 p-7">
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

async function Recent() {
  // Rendered per request, not at build time when the database may be out of reach.
  await connection();
  // A database outage shows an empty shelf instead of failing the page.
  const items = await recentLyrics().catch(() => []);
  if (!items.length) return <p className="mt-6 text-white/40 max-sm:text-center">Nothing yet. Be the first to sync a song.</p>;
  return (
    <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((r) => (
        <li key={r.slug}>
          <Link href={`/lyrics/${r.slug}`} className="group block">
            <span className="relative block aspect-square overflow-hidden rounded-2xl bg-white/[0.06] shadow-lg shadow-black/40 ring-1 ring-white/10">
              {r.artworkUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.artworkUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              )}
              {r.synced && (
                <span className="absolute left-2 top-2">
                  <SyncedBadge />
                </span>
              )}
            </span>
            <span className="mt-2.5 block truncate text-sm font-semibold">{r.trackName}</span>
            <span className="block truncate text-sm text-white/50">{r.artistName}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SyncedBadge() {
  return (
    <span className="shrink-0 rounded-full bg-neutral-950/60 px-2 py-0.5 text-[11px] font-semibold text-white/85 ring-1 ring-white/15 backdrop-blur-md">
      Synced
    </span>
  );
}
