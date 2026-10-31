import { describe, expect, it } from "vitest";
import { formatLrcTime, parseLrc, parseLrcTags, toLrc } from "../lrc";
import { idFromSlug, pickLoose, pickOwn, slugFor, validateNeed, validateSubmission } from "../record";

describe("lrc", () => {
  it("formats LRC times", () => {
    expect(formatLrcTime(0)).toBe("00:00.00");
    expect(formatLrcTime(83.456)).toBe("01:23.46");
    expect(formatLrcTime(59.999)).toBe("01:00.00");
  });

  it("reads LRC header tags", () => {
    expect(parseLrcTags("[ti: Shake It Off ]\n[AR:Taylor Swift]\n[length:03:39]\n[00:01.00]hi")).toEqual({
      title: "Shake It Off",
      artist: "Taylor Swift",
      album: undefined,
    });
  });

  it("round-trips through parseLrc", () => {
    const lines = [
      { time: 1.5, text: "first" },
      { time: 62.25, text: "second" },
    ];
    expect(parseLrc(toLrc(lines))).toEqual(lines);
  });
});

describe("validateSubmission", () => {
  const ok = { trackName: "Song", artistName: "Artist", duration: 200, syncedLyrics: "[00:01.00]a\n[00:02.00]b" };

  it("accepts a synced submission, normalises it and derives the plain text", () => {
    expect(validateSubmission({ ...ok, duration: 199.6, albumName: " " })).toMatchObject({ duration: 200, albumName: null, videoId: null, plainLyrics: "a\nb" });
  });

  it("rejects plain-only lyrics: the library is synced only", () => {
    expect(validateSubmission({ ...ok, syncedLyrics: "", plainLyrics: "a\nb" })).toMatch(/syncedLyrics are required/);
  });

  it("rejects bad input", () => {
    expect(validateSubmission(null)).toBeTypeOf("string");
    expect(validateSubmission({ ...ok, trackName: "" })).toMatch(/required/);
    expect(validateSubmission({ ...ok, artistName: "x".repeat(201) })).toMatch(/200/);
    expect(validateSubmission({ ...ok, duration: 0 })).toMatch(/duration/);
    expect(validateSubmission({ ...ok, duration: "abc" })).toMatch(/duration/);
    expect(validateSubmission({ ...ok, videoId: "<script>" })).toMatch(/videoId/);
    expect(validateSubmission({ ...ok, plainLyrics: "x".repeat(20_001) })).toMatch(/20000/);
    expect(validateSubmission({ ...ok, syncedLyrics: "no tags" })).toMatch(/timed/);
    expect(validateSubmission({ ...ok, syncedLyrics: "[05:00.00]late" })).toMatch(/past/);
    expect(validateSubmission({ ...ok, syncedLyrics: "" })).toMatch(/syncedLyrics are required/);
  });

  it("cleans up the contributor name", () => {
    expect(validateSubmission({ ...ok, contributor: "  dat   walker " })).toMatchObject({ contributor: "dat walker" });
    expect(validateSubmission({ ...ok, contributor: "" })).toMatchObject({ contributor: null });
    expect(validateSubmission({ ...ok, contributor: 42 })).toMatchObject({ contributor: null });
    expect(validateSubmission({ ...ok, contributor: "x".repeat(41) })).toMatch(/contributor/);
  });

  it("allows instrumentals without lyrics", () => {
    expect(validateSubmission({ ...ok, syncedLyrics: "", instrumental: true })).toMatchObject({ instrumental: true, plainLyrics: null, syncedLyrics: null });
  });
});

describe("slugs", () => {
  const _id = { toHexString: () => "6720ab12cd34ef5678901234" };

  it("builds readable slugs whose id survives parsing", () => {
    const slug = slugFor({ _id, artistName: "Beyoncé", trackName: "Crazy in Love (feat. Jay-Z)" });
    expect(slug).toBe("beyonce-crazy-in-love-6720ab12cd34ef5678901234");
    expect(idFromSlug(slug)).toBe("6720ab12cd34ef5678901234");
    expect(idFromSlug("6720ab12cd34ef5678901234")).toBe("6720ab12cd34ef5678901234");
    expect(idFromSlug("nope")).toBeNull();
  });
});

describe("pickOwn", () => {
  const at = (n: number) => new Date(2026, 0, n);

  it("prefers synced, then newest, within 2s of the duration", () => {
    const docs = [
      { id: "plain-new", duration: 200, syncedLyrics: null, createdAt: at(3) },
      { id: "synced-old", duration: 201, syncedLyrics: "[00:01.00]a", createdAt: at(1) },
      { id: "synced-new", duration: 199, syncedLyrics: "[00:01.00]a", createdAt: at(2) },
      { id: "too-long", duration: 230, syncedLyrics: "[00:01.00]a", createdAt: at(4) },
    ];
    expect(pickOwn(docs, 200)?.id).toBe("synced-new");
    expect(pickOwn(docs, 300)).toBeNull();
    expect(pickOwn(docs, 0)?.id).toBe("too-long");
  });
});

describe("pickLoose", () => {
  const doc = (id: string, trackName: string, duration: number, synced = true) => ({
    id,
    trackName,
    artistName: "Beyoncé",
    duration,
    syncedLyrics: synced ? "[00:01.00]a" : null,
    createdAt: new Date(2026, 0, 1),
  });

  it("matches looser names and lengths, closest length first", () => {
    const docs = [doc("far", "Crazy in Love", 240), doc("close", "Crazy in Love (Remastered)", 230), doc("plain", "Crazy in Love", 225, false)];
    expect(pickLoose(docs, "beyonce", "Crazy in Love feat. Jay-Z", 225)?.id).toBe("close");
  });

  it("skips plain-only records, other songs and lengths over 45s off", () => {
    const docs = [doc("plain", "Halo", 200, false), doc("other", "Halo", 200), doc("long", "Halo", 300)];
    expect(pickLoose(docs.slice(0, 1), "Beyoncé", "Halo", 200)).toBeNull();
    expect(pickLoose(docs.slice(1, 2), "Beyoncé", "Single Ladies", 200)).toBeNull();
    expect(pickLoose(docs.slice(2), "Beyoncé", "Halo", 200)).toBeNull();
  });
});

describe("validateNeed", () => {
  const ok = { trackName: "Song", artistName: "Artist", duration: 200.4 };

  it("accepts a report with album, cover and video", () => {
    const cover = "https://is1-ssl.mzstatic.com/image/thumb/Music/x/1000x1000bb.jpg";
    expect(validateNeed({ ...ok, albumName: "Album", artworkUrl: cover, videoId: "dQw4w9WgXcQ" })).toEqual({
      trackName: "Song",
      artistName: "Artist",
      albumName: "Album",
      duration: 200,
      artworkUrl: cover,
      videoId: "dQw4w9WgXcQ",
    });
    expect(validateNeed({ ...ok, artworkUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" })).toMatchObject({ albumName: null, videoId: null });
  });

  it("rejects missing names, bad videos and covers from other hosts", () => {
    expect(validateNeed({ ...ok, trackName: "" })).toMatch(/required/);
    expect(validateNeed({ ...ok, videoId: "nope" })).toMatch(/videoId/);
    for (const artworkUrl of ["http://is1-ssl.mzstatic.com/a.jpg", "https://evil.example/a.jpg", "https://mzstatic.com.evil.example/a.jpg", "javascript:alert(1)"])
      expect(validateNeed({ ...ok, artworkUrl })).toMatch(/artworkUrl/);
  });
});

