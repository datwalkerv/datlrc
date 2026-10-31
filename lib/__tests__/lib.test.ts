import { describe, expect, it } from "vitest";
import { formatLrcTime, parseLrc, parseLrcTags, toLrc } from "../lrc";
import { idFromSlug, pickOwn, slugFor, validateSubmission } from "../record";

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
  const ok = { trackName: "Song", artistName: "Artist", duration: 200, plainLyrics: "a\nb" };

  it("accepts a plain submission and normalises it", () => {
    expect(validateSubmission({ ...ok, duration: 199.6, albumName: " " })).toMatchObject({ duration: 200, albumName: null, syncedLyrics: null, videoId: null });
  });

  it("derives plain lyrics from synced ones", () => {
    const s = validateSubmission({ ...ok, plainLyrics: "", syncedLyrics: "[00:01.00]a\n[00:02.00]b" });
    expect(typeof s !== "string" && s.plainLyrics).toBe("a\nb");
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
    expect(validateSubmission({ ...ok, plainLyrics: "" })).toMatch(/lyrics are required/);
  });

  it("cleans up the contributor name", () => {
    expect(validateSubmission({ ...ok, contributor: "  dat   walker " })).toMatchObject({ contributor: "dat walker" });
    expect(validateSubmission({ ...ok, contributor: "" })).toMatchObject({ contributor: null });
    expect(validateSubmission({ ...ok, contributor: 42 })).toMatchObject({ contributor: null });
    expect(validateSubmission({ ...ok, contributor: "x".repeat(41) })).toMatch(/contributor/);
  });

  it("allows instrumentals without lyrics", () => {
    expect(validateSubmission({ ...ok, plainLyrics: "", instrumental: true })).toMatchObject({ instrumental: true, plainLyrics: null });
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
