"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LrcRecord } from "@/lib/record";

/** Searches our own library (not LRCLIB): these are the songs with a page here. */
export function LibrarySearch() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ q: string; results: LrcRecord[] } | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?${new URLSearchParams({ q, own: "1" })}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<LrcRecord[]>) : []))
        .then((results) => setData({ q, results }))
        .catch((e) => {
          if (e.name !== "AbortError") setData({ q, results: [] });
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const results = q.length >= 2 ? (data?.results ?? []) : [];
  const done = data?.q === q;

  return (
    <div className="relative mt-12 h-[68px] w-full max-w-2xl">
      <div className="absolute inset-x-0 top-0 z-20 overflow-hidden rounded-3xl bg-neutral-900/80 text-left shadow-lg shadow-black/20 ring-1 ring-white/10 backdrop-blur-2xl transition focus-within:ring-white/25">
        <label className="flex h-[68px] items-center gap-4 px-6">
          <svg viewBox="0 0 24 24" className="size-6 shrink-0 text-white/40" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the library"
            aria-label="Search the library"
            className="h-full w-full bg-transparent text-lg font-medium text-white outline-none placeholder:text-white/35"
          />
        </label>
        {q.length >= 2 && done && (
          <ul className="no-scrollbar max-h-[min(56vh,32rem)] overflow-y-auto border-t border-white/10 p-2">
            {results.length ? (
              results.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/lyrics/${String(r.id).replace(/^lrc_/, "")}`}
                    className="flex items-center justify-between gap-4 rounded-2xl px-4 py-3 transition hover:bg-white/10"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{r.trackName}</span>
                      <span className="block truncate text-sm text-white/50">{r.artistName}</span>
                    </span>
                    {r.syncedLyrics && <span className="shrink-0 text-xs font-semibold text-white/50">Synced</span>}
                  </Link>
                </li>
              ))
            ) : (
              <li className="px-4 py-3 text-white/50">
                Not here yet.{" "}
                <Link href="/sync" className="font-semibold text-white underline-offset-4 hover:underline">
                  Sync it yourself
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
