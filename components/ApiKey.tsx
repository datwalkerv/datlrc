"use client";

import { useEffect, useState } from "react";

const STORAGE = "datlrc:apiKey";

/** Generates a key once and keeps it in this browser; the server only keeps its hash. */
export function ApiKey() {
  const [key, setKey] = useState<string | null>(null);
  const [state, setState] = useState<{ busy: boolean; error: string | null; copied: boolean }>({ busy: false, error: null, copied: false });

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
      setKey(localStorage.getItem(STORAGE));
    } catch {}
  }, []);

  async function generate() {
    setState({ busy: true, error: null, copied: false });
    const res = await fetch("/api/keys", { method: "POST" }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { key?: string; error?: string } | null;
    if (!body?.key) return setState({ busy: false, error: body?.error ?? "Couldn't create a key, try again.", copied: false });
    try {
      localStorage.setItem(STORAGE, body.key);
    } catch {}
    setKey(body.key);
    setState({ busy: false, error: null, copied: false });
  }

  async function copy() {
    if (!key) return;
    await navigator.clipboard.writeText(key).catch(() => {});
    setState((s) => ({ ...s, copied: true }));
  }

  return (
    <div className="mt-8 rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10">
      <h2 className="text-xl font-extrabold tracking-[-0.03em]">Your API key</h2>
      {key ? (
        <>
          <p className="mt-2 text-sm text-white/55">
            Send it as the <code className="font-mono text-white/80">x-api-key</code> header. It&apos;s saved in this browser only, so copy it somewhere safe.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 select-all break-all rounded-xl bg-black/40 px-4 py-3 font-mono text-sm text-white/85 ring-1 ring-white/10">{key}</code>
            <button
              onClick={copy}
              className="rounded-full bg-white px-5 py-2.5 font-semibold text-neutral-950 transition hover:scale-[1.03] hover:bg-white/90"
            >
              {state.copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-white/55">Every request outside this site needs a key. It&apos;s free and takes one click.</p>
          <button
            onClick={generate}
            disabled={state.busy}
            className="mt-4 rounded-full bg-white px-6 py-3 font-semibold text-neutral-950 transition hover:scale-[1.03] hover:bg-white/90 disabled:opacity-40"
          >
            {state.busy ? "Generating…" : "Generate API key"}
          </button>
        </>
      )}
      {state.error && <p className="mt-3 text-sm text-red-300/90">{state.error}</p>}
    </div>
  );
}
