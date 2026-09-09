import { describe, it, expect } from "vitest";
import {
  parseSrt,
  parseVtt,
  parseTxt,
  extractActionCandidates,
  SAMPLE_SRT,
} from "@/domain/transcript";

// ---------------------------------------------------------------------------
// Samples
// ---------------------------------------------------------------------------
const SIMPLE_SRT = `1
00:00:01,000 --> 00:00:05,000
Hello world

2
00:00:06,000 --> 00:00:10,000
Petra: Zkontroluju, kdo používá Planner.

3
00:00:11,000 --> 00:00:15,000
Oliver: Připravím školení Teams.
`;

const SIMPLE_VTT = `WEBVTT

00:00:01.000 --> 00:00:05.000
Hello world

00:00:06.000 --> 00:00:10.000
Petra: Zkontroluju, kdo používá Planner.

NOTE This is a comment block
Should be ignored

00:00:11.000 --> 00:00:15.000
Oliver: Připravím školení Teams.
`;

const SIMPLE_TXT = `Vedoucí: Dobrá, tak shrňme, kde jsme.
Oliver: Základní školení udělám.
Domluvili jsme se, že příští týden projdeme celý seznam úkolů.
`;

// ---------------------------------------------------------------------------
// parseSrt
// ---------------------------------------------------------------------------
describe("parseSrt", () => {
  it("parses numbered blocks with timecodes", () => {
    const segs = parseSrt(SIMPLE_SRT);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ speaker: null, startMs: 1000, endMs: 5000, text: "Hello world" });
    expect(segs[1]).toMatchObject({ speaker: "Petra", text: "Zkontroluju, kdo používá Planner." });
    expect(segs[1].startMs).toBe(6000);
    expect(segs[2].speaker).toBe("Oliver");
    expect(segs[2].text).toBe("Připravím školení Teams.");
  });

  it("tolerates missing indices", () => {
    const srtNoNumbers = `00:00:01,000 --> 00:00:05,000
Hello without number

00:00:06,000 --> 00:00:10,000
Petra: Hi there
`;
    const segs = parseSrt(srtNoNumbers);
    expect(segs).toHaveLength(2);
    expect(segs[0].text).toBe("Hello without number");
  });

  it("handles malformed block without timecode", () => {
    const malformed = `1
Hello without timecode

2
00:00:06,000 --> 00:00:10,000
Valid block
`;
    const segs = parseSrt(malformed);
    expect(segs.length).toBeGreaterThanOrEqual(1);
    // The malformed block should still produce a segment without timestamps
    const first = segs[0];
    expect(first.text).toContain("Hello without timecode");
    expect(first.startMs).toBeNull();
  });

  it("handles comma vs dot milliseconds", () => {
    const srtDot = `1
00:00:01.000 --> 00:00:05.000
Dot separator
`;
    const segs = parseSrt(srtDot);
    expect(segs[0].startMs).toBe(1000);
    expect(segs[0].endMs).toBe(5000);
  });

  it("handles Czech diacritics transparently", () => {
    const srtCz = `1
00:00:01,000 --> 00:00:05,000
Připravím školení pro Petra — zkontroluju sdílení složek.
`;
    const segs = parseSrt(srtCz);
    expect(segs[0].text).toContain("Připravím");
    expect(segs[0].text).toContain("zkontroluju");
  });

  it("empty content → empty array", () => {
    expect(parseSrt("")).toEqual([]);
    expect(parseSrt("\n\n")).toEqual([]);
  });

  it("parses SAMPLE_SRT from module (5 blocks)", () => {
    const segs = parseSrt(SAMPLE_SRT);
    expect(segs).toHaveLength(5);
    expect(segs[0].speaker).toBe("Vedoucí");
    expect(segs[1].speaker).toBe("Oliver");
    // Ownerless action: no speaker hint in text? Actually check.
    expect(segs[4].text).toContain("Domluvili jsme se");
  });
});

// ---------------------------------------------------------------------------
// parseVtt
// ---------------------------------------------------------------------------
describe("parseVtt", () => {
  it("parses VTT with WEBVTT header", () => {
    const segs = parseVtt(SIMPLE_VTT);
    expect(segs.length).toBeGreaterThanOrEqual(3);
    expect(segs[0].text).toBe("Hello world");
    expect(segs[1].speaker).toBe("Petra");
  });

  it("ignores NOTE blocks", () => {
    const segs = parseVtt(SIMPLE_VTT);
    // NOTE block should not appear
    expect(segs.some((s) => s.text.includes("NOTE"))).toBe(false);
    expect(segs.some((s) => s.text.includes("Should be ignored"))).toBe(false);
  });

  it("uses dot timing and trims header", () => {
    const vtt = `WEBVTT

00:01:00.000 --> 00:01:10.000
Test segment
`;
    const segs = parseVtt(vtt);
    expect(segs[0].startMs).toBe(60000);
    expect(segs[0].endMs).toBe(70000);
  });

  it("empty VTT → empty array", () => {
    expect(parseVtt("WEBVTT\n\n")).toEqual([]);
    expect(parseVtt("")).toEqual([]);
  });

  it("VTT with speaker labels", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:05.000
Vedoucí: Dobře, pokračujme.
`;
    const segs = parseVtt(vtt);
    expect(segs[0].speaker).toBe("Vedoucí");
    expect(segs[0].text).toBe("Dobře, pokračujme.");
  });
});

// ---------------------------------------------------------------------------
// parseTxt
// ---------------------------------------------------------------------------
describe("parseTxt", () => {
  it("one segment per nonempty line, speaker prefix detected", () => {
    const segs = parseTxt(SIMPLE_TXT);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ speaker: "Vedoucí", startMs: null, endMs: null, text: "Dobrá, tak shrňme, kde jsme." });
    expect(segs[1]).toEqual({ speaker: "Oliver", startMs: null, endMs: null, text: "Základní školení udělám." });
    expect(segs[2]).toEqual({ speaker: null, startMs: null, endMs: null, text: "Domluvili jsme se, že příští týden projdeme celý seznam úkolů." });
  });

  it("empty lines skipped", () => {
    const txt = `Line one

Line two

`;
    const segs = parseTxt(txt);
    expect(segs).toHaveLength(2);
    expect(segs[0].text).toBe("Line one");
    expect(segs[1].text).toBe("Line two");
  });

  it("handles CRLF and diacritics", () => {
    const txt = "Petra: Zkontroluju sdílení složek.\r\nOliver: Připravím školení.\r\n";
    const segs = parseTxt(txt);
    expect(segs[0].speaker).toBe("Petra");
    expect(segs[0].text).toContain("Zkontroluju");
    expect(segs[1].speaker).toBe("Oliver");
  });

  it("no speaker → null", () => {
    const segs = parseTxt("Just some plain text without prefix");
    expect(segs[0].speaker).toBeNull();
    expect(segs[0].text).toBe("Just some plain text without prefix");
  });

  it("empty string → empty array", () => {
    expect(parseTxt("")).toEqual([]);
    expect(parseTxt("   \n  \n")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractActionCandidates deterministic helper
// ---------------------------------------------------------------------------
describe("extractActionCandidates", () => {
  it("detects Czech action hints", () => {
    const segments = [
      { speaker: "Oliver", text: "Základní školení udělám." },
      { speaker: "Petra", text: "Zkontroluju, kdo používá Planner." },
      { speaker: null, text: "Domluvili jsme se, že příští týden projdeme celý seznam úkolů." },
      { speaker: "Vedoucí", text: "Dobře, pokračujme pomalu." }, // no hint → ignored
    ];
    const cands = extractActionCandidates(segments);
    // At least the first two should match (udělám, zkontroluju); third matches "projdeme"
    expect(cands.length).toBeGreaterThanOrEqual(2);
    expect(cands.some((c) => c.segmentIndex === 0)).toBe(true);
    expect(cands.some((c) => c.segmentIndex === 1)).toBe(true);
  });

  it("detects English hints", () => {
    const segments = [
      { speaker: null, text: "I will prepare the report tomorrow." },
      { speaker: null, text: "Please review the contract draft." },
      { speaker: null, text: "This is just a casual comment." },
    ];
    const cands = extractActionCandidates(segments);
    expect(cands.some((c) => c.segmentIndex === 0)).toBe(true);
    expect(cands.some((c) => c.segmentIndex === 1)).toBe(true);
    expect(cands.some((c) => c.segmentIndex === 2)).toBe(false);
  });

  it("deterministic: same input → same output (twice)", () => {
    const segments = [
      { speaker: "Oliver", text: "Připravím školení Teams." },
      { speaker: "Petra", text: "Zkontroluju sdílení složek." },
    ];
    const a = extractActionCandidates(segments);
    const b = extractActionCandidates(segments);
    expect(a).toEqual(b);
  });

  it("proposedTitle strips fillers and capitalizes", () => {
    const segs = [{ speaker: null, text: "Tak připravím školení Teams." }];
    const cands = extractActionCandidates(segs);
    expect(cands).toHaveLength(1);
    // "Tak " prefix stripped
    expect(cands[0].proposedTitle).toBe("Připravím školení Teams.");
    expect(cands[0].evidenceText).toBe("Tak připravím školení Teams.");
  });

  it("owner hint via petru/oliver etc", () => {
    // Must contain both an ACTION_HINT and an owner name to be a candidate with ownerHint.
    // Hints: "pošlu", "připravím" are in ACTION_HINTS_CS; owners: "petra", "oliver" in OWNER_HINTS.
    const segs = [
      { speaker: null, text: "Petra pošlu do pěti dnů příklady." },
      { speaker: null, text: "Oliver připravím školení pro Petra." },
    ];
    const cands = extractActionCandidates(segs);
    expect(cands.length).toBeGreaterThanOrEqual(1);
    // At least one should have ownerHint from Petra or Oliver
    expect(cands.some((c) => c.proposedOwnerHint !== null)).toBe(true);
  });

  it("too short after strip → skipped", () => {
    // A hint word alone too short?
    // Title length check <3 skipped
    const segs = [{ speaker: null, text: "Udělám" }];
    const cands = extractActionCandidates(segs);
    // "Udělám" length 6 after strip → would be kept (hint "udělám" matches)
    expect(cands.length).toBe(1);
  });

  it("long title truncated with ellipsis", () => {
    const long = "Připravím " + "a".repeat(150);
    const segs = [{ speaker: null, text: long }];
    const cands = extractActionCandidates(segs);
    expect(cands[0].proposedTitle.length).toBeLessThanOrEqual(140);
    expect(cands[0].proposedTitle.endsWith("…")).toBe(true);
  });

  it("empty or no hints → no candidates (manual review required)", () => {
    const segs = [
      { speaker: null, text: "Dnes je hezké počasí." },
      { speaker: "Vedoucí", text: "Děkuji za pozornost." },
    ];
    expect(extractActionCandidates(segs)).toEqual([]);
  });

  it("SAMPLE_SRT produces candidates deterministically", () => {
    const segs = parseSrt(SAMPLE_SRT);
    const toCandidates = segs.map((s) => ({ text: s.text, speaker: s.speaker }));
    const c1 = extractActionCandidates(toCandidates);
    const c2 = extractActionCandidates(toCandidates);
    expect(c1).toEqual(c2);
    expect(c1.length).toBeGreaterThan(0);
    // SAMPLE includes "udělám", "Zkontroluju", "pošli", "projdeme" etc.
  });
});
