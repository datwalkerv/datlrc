import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { getLyrics, type LyricsView } from "@/lib/library";
import { idFromSlug } from "@/lib/record";
import { DATLYRICS_URL } from "@/lib/site";

type Props = PageProps<"/lyrics/[slug]">;

async function load(params: Props["params"]) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const lyrics = id ? await getLyrics(id) : null;
  if (!lyrics) notFound();
  // Bare ids (from search) and renamed slugs land on the one canonical URL.
  if (slug !== lyrics.slug) permanentRedirect(`/lyrics/${lyrics.slug}`);
  return lyrics;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const l = id ? await getLyrics(id).catch(() => null) : null;
  if (!l) return { title: "datlrc" };
  const art = l.artworkUrl;
  const title = `${l.trackName} lyrics · ${l.artistName}`;
  const description = l.plainLyrics?.split("\n").filter(Boolean).slice(0, 2).join(" / ") ?? `${l.trackName} by ${l.artistName}`;
  return {
    title: `${title} · datlrc`,
    description,
    alternates: { canonical: `/lyrics/${l.slug}` },
    openGraph: { title, description, images: art ? [art] : undefined },
  };
}

export default function LyricsPage({ params }: Props) {
  return (
    <main className="relative">
      <Suspense fallback={<div className="min-h-[70vh]" />}>
        <Lyrics params={params} />
      </Suspense>
    </main>
  );
}

async function Lyrics({ params }: { params: Props["params"] }) {
  const l = await load(params);
  const art = l.artworkUrl;
  const playHref = l.videoId ? `${DATLYRICS_URL}/play?v=${l.videoId}` : DATLYRICS_URL;
  const stanzas = (l.plainLyrics ?? "").split(/\n\s*\n/).map((s) => s.split("\n").filter((x) => x.trim()));

  return (
    <>
      {art && (
        // The cover's colors bleed into the page, like datlyrics' backdrop.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -top-60 left-1/2 w-[1400px] max-w-none -translate-x-1/2 opacity-30 blur-[100px]"
        />
      )}
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-6 lg:grid-cols-[22rem_1fr] lg:gap-20">
        <aside className="flex flex-col gap-6 lg:sticky lg:top-8 lg:self-start">
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={art}
              alt={`${l.trackName} cover`}
              width={600}
              height={600}
              className="aspect-square w-full max-w-80 rounded-2xl object-cover shadow-2xl shadow-black/60 ring-1 ring-white/10 max-lg:mx-auto"
            />
          ) : (
            <div className="aspect-square w-full max-w-80 rounded-2xl bg-white/[0.06] ring-1 ring-white/10 max-lg:mx-auto" />
          )}
          <div className="max-lg:text-center">
            <h1 className="text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-[1.05] tracking-[-0.04em]">{l.trackName}</h1>
            <p className="mt-2 text-lg text-white/60">{l.artistName}</p>
            {l.albumName && <p className="text-sm text-white/40">{l.albumName}</p>}
            {l.contributor && (
              <p className="mt-3 text-sm text-white/40">
                {l.syncedLyrics ? "Synced" : "Added"} by <span className="font-semibold text-white/70">{l.contributor}</span>
              </p>
            )}
          </div>

          <a
            href={playHref}
            className="group flex flex-col gap-4 rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10 backdrop-blur-2xl transition hover:bg-white/[0.1]"
          >
            <span>
              <span className="block text-xl font-extrabold tracking-[-0.03em]">Sing along on datlyrics</span>
              <span className="mt-1 block text-sm text-white/55">
                {l.syncedLyrics ? "Watch the words light up line by line, made for the big screen." : "Play it with the lyrics on the big screen."}
              </span>
            </span>
            <span className="flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 font-semibold text-neutral-950 transition group-hover:scale-[1.03]">
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
              </svg>
              {l.videoId ? "Play on datlyrics" : "Open datlyrics"}
            </span>
          </a>

          <Download l={l} />
        </aside>

        <article className="flex flex-col gap-[clamp(1.5rem,3vh,2.5rem)]">
          {l.instrumental ? (
            <p className="text-[clamp(1.5rem,2.6vw,2.25rem)] font-bold text-white/50">Instrumental</p>
          ) : (
            stanzas.map((lines, i) => (
              <p key={i} className="text-balance text-[clamp(1.4rem,2.4vw,2.1rem)] font-bold leading-[1.3] tracking-tight">
                {lines.map((line, j) => (
                  <span key={j} className="block">
                    {line}
                  </span>
                ))}
              </p>
            ))
          )}
        </article>
      </div>
    </>
  );
}

function Download({ l }: { l: LyricsView }) {
  const text = l.syncedLyrics ?? l.plainLyrics;
  if (!text) return null;
  const ext = l.syncedLyrics ? "lrc" : "txt";
  return (
    <a
      href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
      download={`${l.artistName} - ${l.trackName}.${ext}`}
      className="flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white/60 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white max-lg:mx-auto"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Download .{ext}
    </a>
  );
}
