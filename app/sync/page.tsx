import type { Metadata } from "next";
import { Suspense } from "react";
import { SyncEditor } from "./SyncEditor";

export const metadata: Metadata = {
  title: "Sync a song · datlrc",
  description: "Tap along to a song to make synced lyrics, then add them to the library.",
};

export default function SyncPage() {
  return (
    <main className="px-5 pb-16 pt-4">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-tight tracking-[-0.04em]">Sync a song</h1>
        <p className="mt-2 max-w-xl text-white/55">
          Pick the song, paste its lyrics, then press Space as each line starts. Preview it, and publish it for everyone.
        </p>
        {/* It reads the URL (a "Needs lyrics" card prefills the search), so it renders per request. */}
        <Suspense fallback={<div className="mt-10 h-[68px] max-w-2xl rounded-3xl bg-white/[0.04] ring-1 ring-white/10" />}>
          <SyncEditor />
        </Suspense>
      </div>
    </main>
  );
}
