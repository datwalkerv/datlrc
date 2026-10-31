import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { leaderboard } from "@/lib/library";

export const metadata: Metadata = { title: "Leaderboard · datlrc", description: "The people syncing lyrics for everyone." };

export default function LeaderboardPage() {
  return (
    <main className="px-5 pb-16 pt-4">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-tight tracking-[-0.04em]">Leaderboard</h1>
        <p className="mt-2 text-white/55">The people syncing lyrics for everyone. Add your name when you sync a song to show up here.</p>
        <Suspense fallback={<div className="mt-10 h-60" />}>
          <Board />
        </Suspense>
      </div>
    </main>
  );
}

async function Board() {
  // Rendered per request, not at build time when the database may be out of reach.
  await connection();
  const rows = await leaderboard().catch(() => null);
  if (!rows) return <p className="mt-10 text-white/40">The leaderboard can&apos;t load right now. Try again in a bit.</p>;
  if (!rows.length)
    return (
      <p className="mt-10 text-white/40">
        No one yet.{" "}
        <Link href="/sync" className="font-semibold text-white underline-offset-4 hover:underline">
          Sync a song
        </Link>{" "}
        and take first place.
      </p>
    );
  return (
    <ol className="mt-10 flex flex-col gap-px overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/10">
      {rows.map((r, i) => (
        <li key={r.name} className="flex items-center gap-5 bg-neutral-950 px-6 py-4">
          <span className={`w-8 text-right text-2xl font-extrabold tabular-nums tracking-[-0.04em] ${i < 3 ? "text-white" : "text-white/30"}`}>
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-lg font-semibold">{r.name}</span>
          <span className="text-right text-sm tabular-nums text-white/50">
            <span className="block text-lg font-bold text-white">{r.total}</span>
            {r.synced} synced
          </span>
        </li>
      ))}
    </ol>
  );
}
