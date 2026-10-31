import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { DATLYRICS_URL, DONATE, GITHUB_URL } from "@/lib/site";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "datlrc",
  description: "An open library of synced lyrics. Search, sync and share LRC files.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full bg-neutral-950 antialiased`}>
      <body className="flex min-h-full flex-col overflow-x-hidden text-white">
        <header className="relative z-30 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:py-7">
          <Link href="/" className="text-xl font-extrabold tracking-[-0.04em]">
            datlrc
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/leaderboard"
              className="rounded-full px-3 py-2 text-sm font-medium text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              Leaderboard
            </Link>
            <Link
              href="/sync"
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/15 transition hover:bg-white/20 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Sync a song
            </Link>
            <Link
              href="/api-docs"
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/15 transition hover:bg-white/20 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="m8 7-5 5 5 5M16 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              API
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="datlrc on GitHub"
              className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <GitHubIcon className="size-5" />
              <span className="max-sm:hidden">GitHub</span>
            </a>
          </nav>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="flex flex-col items-center gap-3 px-5 pb-20 pt-10 text-center text-sm text-white/30">
          <p>No accounts, no analytics. Submissions are public and free to use.</p>
          <p>
            Sing along on{" "}
            <a href={DATLYRICS_URL} className="underline-offset-4 hover:text-white/60 hover:underline">
              datlyrics
            </a>{" "}
            · More lyrics from{" "}
            <a href="https://lrclib.net" target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-white/60 hover:underline">
              LRCLIB
            </a>{" "}
            ·{" "}
            <Link href="/api-docs" className="underline-offset-4 hover:text-white/60 hover:underline">
              API
            </Link>{" "}
            ·{" "}
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-white/60 hover:underline">
              Source on GitHub
            </a>
          </p>
          <div className="mt-2 flex flex-col items-center gap-1 text-xs">
            <p className="font-semibold uppercase tracking-[0.16em]">Donate</p>
            {DONATE.map(({ coin, address }) => (
              <p key={coin} className="break-all">
                {coin}: <span className="select-all font-mono text-white/50">{address}</span>
              </p>
            ))}
          </div>
        </footer>
      </body>
    </html>
  );
}

function GitHubIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}
