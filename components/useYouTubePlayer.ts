"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

/** A clock that smooths the player's coarse currentTime between its updates (ticks ~20×/s). */
export type PlayerClock = {
  subscribe: (fn: () => void) => () => void;
  getTime: () => number;
};

// From datlyrics' player: a 20 Hz timer instead of rAF, and only notifies when time moved.
function createClock(playerRef: React.RefObject<YT.Player | null>, playingRef: React.RefObject<boolean>): PlayerClock {
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastRaw = -1;
  let lastAt = 0;
  let t = 0;
  let notified = -1;
  const tick = () => {
    const now = performance.now();
    const p = playerRef.current;
    if (p && typeof p.getCurrentTime === "function") {
      const raw = p.getCurrentTime() || 0;
      if (raw !== lastRaw) {
        lastRaw = raw;
        lastAt = now;
      }
      let next = raw;
      if (playingRef.current) {
        const rate = p.getPlaybackRate?.() || 1;
        next = raw + Math.min((now - lastAt) / 1000, 1) * rate;
        // Ignore tiny backwards corrections from the coarse reported time.
        if (next < t && t - next < 0.3) next = t;
      }
      t = next;
    }
    if (t !== notified) {
      notified = t;
      listeners.forEach((fn) => fn());
    }
  };
  return {
    subscribe(fn) {
      listeners.add(fn);
      notified = -1;
      if (listeners.size === 1) timer = setInterval(tick, 50);
      return () => {
        listeners.delete(fn);
        if (!listeners.size) clearInterval(timer);
      };
    },
    getTime: () => t,
  };
}

/** Subscribe to a derived value of the clock; re-renders only when the selected value changes. */
export function useClock<T>(clock: PlayerClock, select: (t: number) => T): T {
  return useSyncExternalStore(
    clock.subscribe,
    () => select(clock.getTime()),
    () => select(0),
  );
}

let apiReady: Promise<void> | null = null;
function loadApi(): Promise<void> {
  return (apiReady ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    const w = window as Window & { onYouTubeIframeAPIReady?: () => void };
    w.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }));
}

export type PlayerState = { ready: boolean; playing: boolean; duration: number; error: number | null };

/** A visible YouTube embed for one video, with a smooth clock for syncing. */
export function useYouTubePlayer(mountRef: React.RefObject<HTMLDivElement | null>, videoId: string | null) {
  const playerRef = useRef<YT.Player | null>(null);
  const playingRef = useRef(false);
  // The clock only reads the refs inside its timer, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [clock] = useState(() => createClock(playerRef, playingRef));
  const [state, setState] = useState<PlayerState>({ ready: false, playing: false, duration: 0, error: null });

  useEffect(() => {
    const mount = mountRef.current;
    if (!videoId || !mount) return;
    let cancelled = false;
    const el = document.createElement("div");
    mount.appendChild(el);
    loadApi().then(() => {
      if (cancelled) return;
      playerRef.current = new YT.Player(el, {
        videoId,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e) => setState((s) => ({ ...s, ready: true, duration: e.target.getDuration() })),
          onStateChange: (e) => {
            playingRef.current = e.data === YT.PlayerState.PLAYING;
            // Duration is only reliable once playback has started.
            setState((s) => ({ ...s, playing: playingRef.current, duration: e.target.getDuration() || s.duration }));
          },
          onError: (e) => setState((s) => ({ ...s, error: e.data })),
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      playingRef.current = false;
      mount.replaceChildren();
      setState({ ready: false, playing: false, duration: 0, error: null });
    };
  }, [mountRef, videoId]);

  const controls = useMemo(
    () => ({
      toggle: () => {
        const p = playerRef.current;
        if (!p) return;
        if (playingRef.current) p.pauseVideo();
        else p.playVideo();
      },
      seek: (t: number) => playerRef.current?.seekTo(Math.max(t, 0), true),
      play: () => playerRef.current?.playVideo(),
      /** YouTube supports 0.25–2 in quarter steps. */
      setRate: (r: number) => playerRef.current?.setPlaybackRate(r),
    }),
    [],
  );

  return { state, clock, controls };
}
