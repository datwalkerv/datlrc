<div align="center">

<img src="./app/icon.svg" width="10%" alt="datlrc" />

# datlrc

**Every lyric, in sync.**

An open library of synced lyrics, made to feed [datlyrics](https://lyrics.datwalkerv.app).

</div>

## ✨ Features

- **🎤 Tap-to-sync editor** (`/sync`): pick a YouTube song, paste the lyrics, and press Space as each line starts. Preview it karaoke-style, then publish.
- **📄 A page for every song** (`/lyrics/<artist>-<title>-<id>`): clean lyrics on the song's cover colors, a "Sing along on datlyrics" link and an `.lrc` download.
- **🔌 Free API**: LRCLIB-compatible, with CORS open. Callers need a free key from the "Generate API key" button on `/api-docs`; datlrc's own pages don't. It falls back to LRCLIB for songs not in the library yet. See `/api-docs`.
- **🔑 No accounts**: publishing is limited to 10 per hour per IP, and only a salted hash of the IP is stored.

## 🛠️ Setup

```bash
cp .env.example .env.local   # set MONGODB_URI and ADMIN_TOKEN
pnpm install
pnpm dev                     # http://localhost:3001
pnpm test
```

To remove a submission:

```bash
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" https://<host>/api/lyrics/<id>
```

## 🔗 Using it from datlyrics

Set `LYRICS_API=https://<datlrc host>/api` and `LYRICS_API_KEY=<key from /api-docs>` in datlyrics' environment.

## 🛠️ Stack

Next.js 16, React 19, Tailwind CSS v4, Motion, MongoDB, Vitest, Geist. The design is shared with datlyrics.
