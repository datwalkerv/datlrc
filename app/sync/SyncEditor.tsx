"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { SyncedLyrics } from "@/components/SyncedLyrics";
import { useClock, useYouTubePlayer } from "@/components/useYouTubePlayer";
import { cleanTitle } from "@/lib/clean-title";
import { formatLrcTime, parseLrc, parseLrcTags, toLrc } from "@/lib/lrc";
import { parseYouTubeUrl } from "@/lib/parse-youtube-url";
import type { LrcRecord } from "@/lib/record";
import type { SearchResult } from "@/lib/search-source";

/** `track`/`artist` come from a "Needs lyrics" card and beat guessing from the video title. */
type Video = { id: string; title: string; channel: string; track?: string; artist?: string; album?: string };
type Line = { text: string; time: number | null };
type Tab = "lyrics" | "sync" | "preview";

const NUDGE = 0.1;
/** People tap a little after they hear a line start; stamps are moved back by this much. */
const REACTION = 0.15;
const RATES = [0.5, 0.75, 1];
/** Remembered so regular contributors don't retype their name. */
const NAME_KEY = "datlrc:contributor";

export function SyncEditor() {
  const sp = useSearchParams();
  const known = {
    track: sp.get("track")?.slice(0, 200) || undefined,
    artist: sp.get("artist")?.slice(0, 200) || undefined,
    album: sp.get("album")?.slice(0, 200) || undefined,
  };
  // A "Needs lyrics" card links the exact video datlyrics played: open the editor on it right away.
  const v = sp.get("v");
  const [video, setVideo] = useState<Video | null>(v && /^[\w-]{11}$/.test(v) ? { id: v, title: "", channel: "", ...known } : null);
  return video ? (
    <Editor key={video.id} video={video} onChange={() => setVideo(null)} />
  ) : (
    <SongPicker initialQuery={sp.get("q")?.slice(0, 200) ?? ""} onPick={(v) => setVideo({ ...v, ...known })} />
  );
}

function SongPicker({ initialQuery, onPick }: { initialQuery: string; onPick: (v: Video) => void }) {
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState<{ q: string; results: SearchResult[]; failed: boolean } | null>(null);
  const q = query.trim();
  const link = parseYouTubeUrl(q);
  const isWords = q.length >= 2 && !link?.videoId;

  useEffect(() => {
    if (!isWords) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/youtube?${new URLSearchParams({ q })}`, { signal: ctrl.signal })
        .then((r) => r.json() as Promise<{ results: SearchResult[]; error?: string }>)
        .then((r) => setData({ q, results: r.results, failed: !!r.error }))
        .catch((e) => {
          if (e.name !== "AbortError") setData({ q, results: [], failed: true });
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, isWords]);

  const results = isWords && data?.q === q ? data.results : [];

  return (
    <div className="mt-10 max-w-2xl">
      <div className="overflow-hidden rounded-3xl bg-neutral-900/80 ring-1 ring-white/10 backdrop-blur-2xl focus-within:ring-white/25">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && link?.videoId) onPick({ id: link.videoId, title: "", channel: "" });
          }}
          placeholder="Search a song, or paste a YouTube link"
          aria-label="Search a song, or paste a YouTube link"
          className="h-[68px] w-full bg-transparent px-6 text-lg font-medium outline-none placeholder:text-white/35"
        />
        {link?.videoId && (
          <button
            onClick={() => onPick({ id: link.videoId!, title: "", channel: "" })}
            className="w-full border-t border-white/10 px-6 py-4 text-left font-semibold transition hover:bg-white/10"
          >
            Use this video ↵
          </button>
        )}
        {results.length > 0 && (
          <ul className="no-scrollbar max-h-[min(56vh,32rem)] overflow-y-auto border-t border-white/10 p-2">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => onPick(r)}
                  className="flex w-full items-center gap-4 rounded-2xl px-3 py-2.5 text-left transition hover:bg-white/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://i.ytimg.com/vi/${r.id}/default.jpg`} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.title}</span>
                    <span className="block truncate text-sm text-white/50">{r.channel}</span>
                  </span>
                  <span className="text-sm tabular-nums text-white/40">{r.duration}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {isWords && data?.q === q && data.failed && <p className="border-t border-white/10 px-6 py-4 text-white/50">Search failed, try again.</p>}
      </div>
    </div>
  );
}

function Editor({ video, onChange }: { video: Video; onChange: () => void }) {
  const router = useRouter();
  const mountRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { state, clock, controls } = useYouTubePlayer(mountRef, video.id);
  const guess = video.track
    ? { title: video.track, artist: video.artist ?? "" }
    : video.title
      ? cleanTitle(video.title, video.channel)
      : { artist: "", title: "" };
  const [trackName, setTrackName] = useState(guess.title);
  const [artistName, setArtistName] = useState(guess.artist);
  const [albumName, setAlbumName] = useState(video.album ?? "");
  const [contributor, setContributor] = useState("");
  // Read after mount: a "Needs lyrics" link renders the editor on the server, where storage doesn't exist.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
      setContributor(localStorage.getItem(NAME_KEY) ?? "");
    } catch {}
  }, []);
  const [text, setText] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [cursor, setCursor] = useState(0);
  const [rate, setRate] = useState(1);
  const [tab, setTab] = useState<Tab>("lyrics");
  const [status, setStatus] = useState<{ busy: boolean; error: string | null; note: string | null }>({ busy: false, error: null, note: null });

  const duration = state.duration;
  const stamped = lines.filter((l) => l.time !== null).length;
  const allStamped = lines.length > 0 && stamped === lines.length;
  const sortedLines = () => lines.map((l) => ({ text: l.text, time: l.time! })).sort((a, b) => a.time - b.time);

  // Changing the text keeps times for lines that are still there, in order.
  const linesFor = (t: string, prev: Line[]): Line[] =>
    t
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s, i) => ({ text: s, time: prev[i]?.text === s ? prev[i].time : null }));

  const goTab = (t: Tab) => {
    if (t !== "lyrics") {
      const next = linesFor(text, lines);
      setLines(next);
      // Fully synced lyrics (imported or fetched) open on the "all done" view instead of re-tapping line 1.
      if (t === "sync") setCursor(next.some((l) => l.time === null) ? next.findIndex((l) => l.time === null) : next.length);
    }
    setTab(t);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Synced lines (from a file or the API) fill both the text and the times. */
  function loadLrc(raw: string, from: string) {
    const synced = parseLrc(raw).filter((l) => l.text);
    if (synced.length) {
      setText(synced.map((l) => l.text).join("\n"));
      setLines(synced.map((l) => ({ text: l.text, time: l.time })));
    } else setText(raw.trim());
    setStatus({
      busy: false,
      error: null,
      note: synced.length ? `${from}: ${synced.length} synced lines. Check them against your video.` : `${from}: plain lyrics, ready to sync.`,
    });
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 200_000) return setStatus({ busy: false, error: null, note: "That file is too big for a lyrics file." });
    const raw = await file.text();
    const tags = parseLrcTags(raw);
    if (tags.title) setTrackName(tags.title);
    if (tags.artist) setArtistName(tags.artist);
    if (tags.album) setAlbumName(tags.album);
    loadLrc(raw, `Imported ${file.name}`);
  }

  async function fetchExisting() {
    setStatus({ busy: true, error: null, note: null });
    const params = new URLSearchParams({ artist_name: artistName, track_name: trackName });
    if (duration) params.set("duration", String(Math.round(duration)));
    const r = await fetch(`/api/get?${params}`).catch(() => null);
    const rec = r?.ok ? ((await r.json()) as LrcRecord) : null;
    if (!rec || (!rec.plainLyrics && !rec.syncedLyrics)) {
      setStatus({ busy: false, error: null, note: "No lyrics found for that title and artist. Paste them below." });
      return;
    }
    loadLrc(rec.syncedLyrics ?? rec.plainLyrics ?? "", "Found existing lyrics");
  }

  // Sync actions, shared by the keyboard and the on-screen buttons.
  const act = {
    tap: () => {
      if (!state.playing) return controls.play();
      if (cursor >= lines.length) return;
      const t = Math.max(clock.getTime() - REACTION, 0);
      const next = lines.map((l, i) => (i === cursor ? { ...l, time: t } : l));
      setLines(next);
      // Walk on line by line (that's how a redo flows); at the end, go back for any line still missing.
      const missed = next.findIndex((l) => l.time === null);
      setCursor(cursor + 1 < next.length || missed === -1 ? cursor + 1 : missed);
    },
    /** Jump to line i and play from just before the line ahead of it, so you hear the lead-in. */
    resyncFrom: (i: number) => {
      setCursor(i);
      const prev = lines[i - 1]?.time;
      controls.seek(prev != null ? prev - 1 : Math.max((lines[i]?.time ?? clock.getTime()) - 4, 0));
      controls.play();
    },
    undo: () => {
      if (cursor === 0) return;
      const i = cursor - 1;
      setLines((ls) => ls.map((l, j) => (j === i ? { ...l, time: null } : l)));
      act.resyncFrom(i);
    },
    seek: (d: number) => controls.seek(clock.getTime() + d),
    nudge: (i: number, d: number) =>
      setLines((ls) => ls.map((l, j) => (j === i && l.time !== null ? { ...l, time: Math.max(l.time + d, 0) } : l))),
    rate: (r: number) => {
      setRate(r);
      controls.setRate(r);
    },
  };

  // Sync keys, only on the sync tab and never while typing in a field.
  useEffect(() => {
    if (tab !== "sync") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
      const handlers: Record<string, () => void> = {
        " ": act.tap,
        Enter: act.tap,
        Backspace: act.undo,
        z: act.undo,
        k: controls.toggle,
        ArrowLeft: () => act.seek(e.shiftKey ? -5 : -1),
        ArrowRight: () => act.seek(e.shiftKey ? 5 : 1),
        "[": () => act.nudge(cursor - 1, -NUDGE),
        "]": () => act.nudge(cursor - 1, NUDGE),
        s: () => act.rate(RATES[(RATES.indexOf(rate) + 1) % RATES.length]),
      };
      const h = handlers[e.key.length === 1 ? e.key.toLowerCase() : e.key] ?? handlers[e.key];
      if (!h || e.repeat) return;
      e.preventDefault();
      h();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function publish() {
    setStatus({ busy: true, error: null, note: null });
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackName,
        artistName,
        albumName,
        contributor,
        duration,
        plainLyrics: text,
        syncedLyrics: toLrc(sortedLines()),
        videoId: video.id,
      }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { slug?: string; error?: string } | null;
    if (!res?.ok || !body?.slug) {
      setStatus({ busy: false, error: body?.error ?? "Couldn't publish, try again.", note: null });
      return;
    }
    router.push(`/lyrics/${body.slug}`);
  }

  const missing = !trackName.trim() ? "a title" : !artistName.trim() ? "an artist" : null;
  const canPublish = !status.busy && !missing && allStamped && duration > 0;

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[24rem_1fr]">
      <aside className="flex flex-col gap-5 lg:sticky lg:top-8 lg:self-start">
        {/* While syncing, the video can't take focus: clicks there would swallow the tap keys. */}
        <div
          ref={mountRef}
          className={`yt-mount relative aspect-video overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10 ${tab === "sync" ? "pointer-events-none" : ""}`}
        />
        {state.error !== null && (
          <p className="text-sm text-red-300/90">This video can&apos;t be played here. Try another upload of the song.</p>
        )}
        <button onClick={onChange} className="w-fit text-sm font-semibold text-white/50 underline-offset-4 hover:text-white hover:underline">
          Pick a different song
        </button>
        <Field label="Title" value={trackName} onChange={setTrackName} />
        <Field label="Artist" value={artistName} onChange={setArtistName} />
        <Field label="Album (optional)" value={albumName} onChange={setAlbumName} />
        <Field
          label="Contributor (optional)"
          placeholder="Your name"
          maxLength={40}
          value={contributor}
          onChange={(v) => {
            setContributor(v);
            try {
              localStorage.setItem(NAME_KEY, v);
            } catch {}
          }}
        />
        <p className="text-sm text-white/40">Length: {duration ? formatLrcTime(duration).slice(0, 5) : "loading…"}</p>
      </aside>

      <section className="min-w-0">
        <div className="flex flex-wrap items-center gap-2" role="tablist">
          {(["lyrics", "sync", "preview"] as const).map((t, i) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              disabled={(t === "sync" && !text.trim()) || (t === "preview" && !allStamped)}
              onClick={() => goTab(t)}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ring-1 transition disabled:opacity-40 ${
                tab === t ? "bg-white text-neutral-950 ring-white" : "text-white/70 ring-white/15 hover:bg-white/10 hover:text-white"
              }`}
            >
              {i + 1}. {t}
            </button>
          ))}
        </div>

        {tab === "lyrics" && (
          <div className="mt-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={fetchExisting}
                disabled={status.busy || !trackName.trim() || !artistName.trim()}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white/70 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                Fetch existing lyrics
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white/70 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white"
              >
                Import .lrc
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".lrc,.txt,text/plain"
                className="hidden"
                onChange={(e) => {
                  void importFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {status.note && <p className="text-sm text-white/50">{status.note}</p>}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void importFile(e.dataTransfer.files[0]);
              }}
              placeholder={"Paste the lyrics here, one line per line, or drop an .lrc file.\nLeave a blank line between verses."}
              aria-label="Lyrics"
              className="min-h-[55vh] w-full resize-y rounded-3xl bg-white/[0.04] p-6 text-lg leading-relaxed outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-white/25"
            />
          </div>
        )}

        {tab === "sync" && (
          <SyncStage
            lines={lines}
            cursor={cursor}
            clock={clock}
            playing={state.playing}
            rate={rate}
            stamped={stamped}
            act={act}
            onToggle={controls.toggle}
          />
        )}

        {tab === "preview" && (
          <div className="mt-5 h-[60vh] overflow-hidden rounded-3xl bg-white/[0.03] p-6 ring-1 ring-white/10">
            <SyncedLyrics lines={sortedLines()} clock={clock} duration={duration} offset={0} onSeek={controls.seek} />
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          {tab === "lyrics" && (
            <PrimaryButton onClick={() => goTab("sync")} disabled={!text.trim()}>
              Continue to sync
            </PrimaryButton>
          )}
          {tab === "sync" && (
            <PrimaryButton onClick={() => goTab("preview")} disabled={!allStamped}>
              {allStamped ? "Continue to preview" : `Continue to preview (${stamped}/${lines.length})`}
            </PrimaryButton>
          )}
          {tab === "preview" && (
            <>
              <PrimaryButton onClick={publish} disabled={!canPublish}>
                {status.busy ? "Publishing…" : "Publish synced lyrics"}
              </PrimaryButton>
              <button
                onClick={() => goTab("sync")}
                className="rounded-full px-5 py-3 font-semibold text-white/70 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white"
              >
                Back to sync
              </button>
              {missing && <p className="text-sm text-white/50">Add {missing} on the left to publish.</p>}
            </>
          )}
          {status.error && <p className="text-sm text-red-300/90">{status.error}</p>}
        </div>
      </section>
    </div>
  );
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-neutral-950 transition hover:scale-[1.03] hover:bg-white/90 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 200,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-white/50">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className="rounded-xl bg-white/[0.04] px-4 py-2.5 text-base text-white outline-none ring-1 ring-white/10 placeholder:text-white/30 focus:ring-white/25"
      />
    </label>
  );
}

type Actions = {
  tap: () => void;
  resyncFrom: (i: number) => void;
  undo: () => void;
  seek: (d: number) => void;
  nudge: (i: number, d: number) => void;
  rate: (r: number) => void;
};

/** The tap-along view: the line to tap big in the middle, with the one before and after around it. */
function SyncStage({
  lines,
  cursor,
  clock,
  playing,
  rate,
  stamped,
  act,
  onToggle,
}: {
  lines: Line[];
  cursor: number;
  clock: Parameters<typeof useClock>[0];
  playing: boolean;
  rate: number;
  stamped: number;
  act: Actions;
  onToggle: () => void;
}) {
  // Tenths are plenty for a readout, and re-render far less than the 20 Hz clock.
  const now = useClock(clock, (t) => Math.floor(t * 10) / 10);
  const done = cursor >= lines.length;
  const prev = lines[cursor - 1];
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    // Scroll only the list (scrollIntoView would drag the whole page down with it).
    const list = listRef.current;
    const row = list?.children[cursor] as HTMLElement | undefined;
    if (list && row) list.scrollTo({ top: row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2, behavior: "smooth" });
  }, [cursor]);

  // Buttons never keep focus, so Space always taps instead of re-clicking the last button.
  const noFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <motion.div className="h-full rounded-full bg-white" animate={{ width: `${(stamped / Math.max(lines.length, 1)) * 100}%` }} />
      </div>

      <div className="relative flex min-h-[19rem] flex-col justify-center gap-5 overflow-hidden rounded-3xl bg-white/[0.04] px-6 py-8 ring-1 ring-white/10 sm:px-10">
        {done ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
            <p className="text-5xl" aria-hidden>
              🎉
            </p>
            <p className="mt-4 text-[clamp(1.75rem,3.4vw,2.75rem)] font-extrabold tracking-[-0.04em]">Every line is synced.</p>
            <p className="mt-2 text-white/55">Watch it back in the preview, or click any line below to redo it.</p>
          </motion.div>
        ) : (
          <>
            <div className="flex min-h-7 items-center gap-3 text-white/40">
              {prev && prev.time !== null && (
                <>
                  <span className="font-mono text-sm tabular-nums">{formatLrcTime(prev.time)}</span>
                  <span className="truncate text-lg font-semibold">{prev.text}</span>
                  <span className="ml-auto flex shrink-0 gap-1">
                    <SmallButton onMouseDown={noFocus} onClick={() => act.nudge(cursor - 1, -NUDGE)} label="Move the last line 0.1s earlier">
                      −0.1s
                    </SmallButton>
                    <SmallButton onMouseDown={noFocus} onClick={() => act.nudge(cursor - 1, NUDGE)} label="Move the last line 0.1s later">
                      +0.1s
                    </SmallButton>
                  </span>
                </>
              )}
            </div>
            <motion.p
              key={cursor}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="text-balance text-[clamp(2rem,4.4vw,3.75rem)] font-extrabold leading-[1.1] tracking-[-0.03em]"
            >
              {lines[cursor]?.text}
            </motion.p>
            <p className="truncate text-xl font-semibold text-white/35">{lines[cursor + 1]?.text ?? " "}</p>
            {!playing && stamped === 0 && (
              <p className="text-sm text-white/50">Press Space to start the song, then press it again the moment each line begins.</p>
            )}
          </>
        )}
      </div>

      {!done && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onMouseDown={noFocus}
          onClick={act.tap}
          className="flex h-20 items-center justify-center gap-3 rounded-3xl bg-white text-xl font-extrabold tracking-[-0.02em] text-neutral-950 transition hover:bg-white/90"
        >
          {playing ? "Tap" : "Play"}
          <Kbd dark>Space</Kbd>
        </motion.button>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SmallButton onMouseDown={noFocus} onClick={() => act.seek(-1)} label="Back 1 second">
          −1s
        </SmallButton>
        <SmallButton onMouseDown={noFocus} onClick={onToggle} label={playing ? "Pause" : "Play"}>
          {playing ? "Pause" : "Play"} <Kbd>K</Kbd>
        </SmallButton>
        <SmallButton onMouseDown={noFocus} onClick={() => act.seek(1)} label="Forward 1 second">
          +1s
        </SmallButton>
        <SmallButton onMouseDown={noFocus} onClick={act.undo} label="Undo the last tap">
          Undo <Kbd>⌫</Kbd>
        </SmallButton>
        <span className="mx-1 h-6 w-px bg-white/10" aria-hidden />
        <span className="flex gap-1" role="group" aria-label="Playback speed">
          {RATES.map((r) => (
            <button
              key={r}
              onMouseDown={noFocus}
              onClick={() => act.rate(r)}
              aria-pressed={rate === r}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ring-1 transition ${
                rate === r ? "bg-white text-neutral-950 ring-white" : "text-white/60 ring-white/15 hover:bg-white/10 hover:text-white"
              }`}
            >
              {r}×
            </button>
          ))}
        </span>
        <span className="ml-auto font-mono text-sm tabular-nums text-white/60">{formatLrcTime(now)}</span>
      </div>
      <p className="text-sm text-white/40">
        <Kbd>←</Kbd> <Kbd>→</Kbd> 1s (with Shift 5s) · <Kbd>[</Kbd> <Kbd>]</Kbd> nudge the last line · <Kbd>S</Kbd> speed. Slow it down for fast verses.
      </p>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/30">All lines · click one to redo from there</p>
        <ol
          ref={listRef}
          className="no-scrollbar relative mt-3 flex max-h-[40vh] flex-col gap-1 overflow-y-auto rounded-3xl bg-white/[0.03] p-3 ring-1 ring-white/10"
        >
          {lines.map((l, i) => (
            <li
              key={i}
              className={`flex items-center gap-2 rounded-xl pr-2 transition hover:bg-white/10 ${i === cursor ? "bg-white/10 ring-1 ring-white/25" : ""}`}
            >
              <button
                onMouseDown={noFocus}
                onClick={() => act.resyncFrom(i)}
                className="flex min-w-0 flex-1 items-baseline gap-4 px-3 py-2 text-left"
              >
                <span className="w-16 shrink-0 font-mono text-sm tabular-nums text-white/45">{l.time === null ? "--:--.--" : formatLrcTime(l.time)}</span>
                <span className={`font-semibold ${l.time === null && i !== cursor ? "text-white/45" : "text-white"}`}>{l.text}</span>
              </button>
              {l.time !== null && (
                <span className="flex shrink-0 gap-1">
                  <IconButton onMouseDown={noFocus} onClick={() => act.nudge(i, -NUDGE)} label={`Move "${l.text}" 0.1s earlier`}>
                    <path d="M5 12h14" />
                  </IconButton>
                  <IconButton onMouseDown={noFocus} onClick={() => act.nudge(i, NUDGE)} label={`Move "${l.text}" 0.1s later`}>
                    <path d="M12 5v14M5 12h14" />
                  </IconButton>
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** A small round −/+ button; children are the icon's SVG paths. */
function IconButton({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className="grid size-7 place-items-center rounded-full bg-white/10 text-white/70 ring-1 ring-white/15 transition hover:bg-white/20 hover:text-white"
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

function SmallButton({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/85 ring-1 ring-white/15 transition hover:bg-white/20 hover:text-white"
    >
      {children}
    </button>
  );
}

function Kbd({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <kbd
      className={`min-w-7 rounded-md px-2 py-1 text-center font-sans text-xs font-semibold ring-1 ${
        dark ? "bg-neutral-950/10 text-neutral-950/70 ring-neutral-950/15" : "bg-white/[0.07] text-white/80 ring-white/15"
      }`}
    >
      {children}
    </kbd>
  );
}
