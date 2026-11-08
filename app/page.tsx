import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { needsLyrics, recentLyrics } from "@/lib/library";
import { LibrarySearch } from "@/components/LibrarySearch";
import { syncHref } from "@/lib/site";

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

      <Suspense fallback={null}>
        <Needs />
      </Suspense>

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
            ["Free API", "Every synced lyric in the library, through a simple JSON API with a free key."],
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
    <Shelf
      items={items.map((r) => ({
        key: r.slug,
        href: `/lyrics/${r.slug}`,
        art: r.artworkUrl,
        title: r.trackName,
        artist: r.artistName,
        badge: r.synced ? "Synced" : null,
      }))}
    />
  );
}

/** Songs nobody has synced lyrics for yet, most wanted first; each opens the sync editor. */
async function Needs() {
  await connection();
  const items = await needsLyrics().catch(() => []);
  if (!items.length) return null;
  return (
    <section className="px-5 pb-14" aria-labelledby="needs">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 max-sm:justify-center">
          <h2 id="needs" className="text-xs font-medium uppercase tracking-[0.2em] text-white/30">
            Needs lyrics
          </h2>
          <p className="text-sm text-white/40">People want to sing these, but nobody has synced them yet. Pick one and be the first.</p>
        </div>
        <Shelf
          items={items.map((n) => ({
            key: n.id,
            href: syncHref(n),
            art: n.artworkUrl,
            title: n.trackName,
            artist: n.artistName,
            album: n.albumName,
            badge: n.requests > 1 ? `${n.requests}× wanted` : null,
          }))}
        />
      </div>
    </section>
  );
}

type ShelfItem = { key: string; href: string; art: string | null; title: string; artist: string; album?: string | null; badge: string | null };

/** A row of covers: six across on desktop, scrolling sideways when there are more. */
function Shelf({ items }: { items: ShelfItem[] }) {
  return (
    <ul className="no-scrollbar -mx-5 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2">
      {items.map((r) => (
        <li key={r.key} className="w-[42%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-5rem)/6)]">
          <Link href={r.href} className="group block">
            <span className="relative block aspect-square overflow-hidden rounded-2xl bg-white/[0.06] shadow-lg shadow-black/40 ring-1 ring-white/10">
              {r.art && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.art} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              )}
              {r.badge && (
                <span className="absolute left-2 top-2 rounded-full bg-neutral-950/60 px-2 py-0.5 text-[11px] font-semibold text-white/85 ring-1 ring-white/15 backdrop-blur-md">
                  {r.badge}
                </span>
              )}
            </span>
            <span className="mt-2.5 block truncate text-sm font-semibold">{r.title}</span>
            <span className="block truncate text-sm text-white/50">{r.artist}</span>
            {r.album && <span className="block truncate text-xs text-white/30">{r.album}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
