import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { needsLyrics } from "@/lib/library";
import { syncHref } from "@/lib/site";

export const metadata: Metadata = { title: "Needs lyrics · datlrc", description: "Songs people want to sing that nobody has synced yet." };

export default function NeedsPage() {
  return (
    <main className="px-5 pb-16 pt-4">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-tight tracking-[-0.04em]">Needs lyrics</h1>
        <p className="mt-2 text-white/55">People want to sing these, but nobody has synced them yet. Pick one and be the first.</p>
        <Suspense fallback={<div className="mt-10 h-60" />}>
          <All />
        </Suspense>
      </div>
    </main>
  );
}

async function All() {
  // Rendered per request, not at build time when the database may be out of reach.
  await connection();
  // shortcut: limit 0 loads every wanted song in one page, add pagination if the list grows into the thousands.
  const items = await needsLyrics(0).catch(() => null);
  if (!items) return <p className="mt-10 text-white/40">This list can&apos;t load right now. Try again in a bit.</p>;
  if (!items.length) return <p className="mt-10 text-white/40">Nothing wanted right now. Every requested song has synced lyrics.</p>;
  return (
    <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((n) => (
        <li key={n.id}>
          <Link href={syncHref(n)} className="group block">
            <span className="relative block aspect-square overflow-hidden rounded-2xl bg-white/[0.06] shadow-lg shadow-black/40 ring-1 ring-white/10">
              {n.artworkUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.artworkUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              )}
              {n.requests > 1 && (
                <span className="absolute left-2 top-2 rounded-full bg-neutral-950/60 px-2 py-0.5 text-[11px] font-semibold text-white/85 ring-1 ring-white/15 backdrop-blur-md">
                  {n.requests}× wanted
                </span>
              )}
            </span>
            <span className="mt-2.5 block truncate text-sm font-semibold">{n.trackName}</span>
            <span className="block truncate text-sm text-white/50">{n.artistName}</span>
            {n.albumName && <span className="block truncate text-xs text-white/30">{n.albumName}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
