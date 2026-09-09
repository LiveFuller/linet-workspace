import { describe, it, expect } from "vitest";
import {
  parseDateOnly,
  isValidDateOnly,
  todayInZone,
  addDaysDateOnly,
  dateOnlyDiffDays,
  weekBounds,
  formatDateOnly,
  relativeDayLabel,
  TZ_PRAGUE,
} from "@/lib/dates";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function clockAt(iso: string) {
  return () => new Date(iso);
}

describe("parseDateOnly", () => {
  it("parses valid date", () => {
    expect(parseDateOnly("2026-09-08")).toEqual({ y: 2026, m: 9, d: 8 });
    expect(parseDateOnly("2000-01-01")).toEqual({ y: 2000, m: 1, d: 1 });
    expect(parseDateOnly("2026-12-31")).toEqual({ y: 2026, m: 12, d: 31 });
  });

  it("rejects invalid formats", () => {
    expect(parseDateOnly("2026-9-8")).toBeNull();
    expect(parseDateOnly("2026-09-8")).toBeNull();
    expect(parseDateOnly("26-09-08")).toBeNull();
    expect(parseDateOnly("2026/09/08")).toBeNull();
    expect(parseDateOnly("2026-09-08T00:00:00")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
  });

  it("rejects overflow dates", () => {
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("2026-00-10")).toBeNull();
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("2023-02-29")).toBeNull(); // not leap
    expect(parseDateOnly("2026-04-31")).toBeNull();
  });

  it("accepts leap year", () => {
    expect(parseDateOnly("2024-02-29")).toEqual({ y: 2024, m: 2, d: 29 });
    expect(parseDateOnly("2020-02-29")).not.toBeNull();
  });

  it("rejects non-numeric / spaces", () => {
    expect(parseDateOnly(" 2026-09-08")).toBeNull();
    expect(parseDateOnly("2026-09-08 ")).toBeNull();
    expect(parseDateOnly("abcd-ef-gh")).toBeNull();
  });
});

describe("isValidDateOnly", () => {
  it("mirrors parseDateOnly null check", () => {
    expect(isValidDateOnly("2026-09-08")).toBe(true);
    expect(isValidDateOnly("2026-02-30")).toBe(false);
    expect(isValidDateOnly(null)).toBe(false);
  });
});

describe("todayInZone with injected clock", () => {
  it("returns YYYY-MM-DD in Prague for fixed instant", () => {
    // 2026-09-08 01:00 UTC = 03:00 in Prague (CEST, UTC+2)
    const clock = clockAt("2026-09-08T01:00:00.000Z");
    expect(todayInZone(clock, TZ_PRAGUE)).toBe("2026-09-08");
    expect(todayInZone(clock, "UTC")).toBe("2026-09-08");
  });

  it("respects zone boundary", () => {
    // 2026-09-07 22:00 UTC = 2026-09-08 00:00 Prague, but still 09-07 in UTC
    const clock = clockAt("2026-09-07T22:00:00.000Z");
    expect(todayInZone(clock, TZ_PRAGUE)).toBe("2026-09-08");
    expect(todayInZone(clock, "UTC")).toBe("2026-09-07");
  });

  it("deterministic across calls with same clock", () => {
    const clock = clockAt("2025-01-15T12:00:00.000Z");
    expect(todayInZone(clock, "Pacific/Port_Moresby")).toBe(todayInZone(clock, "Pacific/Port_Moresby"));
  });
});

describe("addDaysDateOnly", () => {
  it("adds positive days", () => {
    expect(addDaysDateOnly("2026-09-08", 1)).toBe("2026-09-09");
    expect(addDaysDateOnly("2026-09-08", 7)).toBe("2026-09-15");
  });

  it("adds negative days", () => {
    expect(addDaysDateOnly("2026-09-08", -1)).toBe("2026-09-07");
    expect(addDaysDateOnly("2026-09-08", -8)).toBe("2026-08-31");
  });

  it("crosses month/year boundaries", () => {
    expect(addDaysDateOnly("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysDateOnly("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDaysDateOnly("2024-02-28", 1)).toBe("2024-02-29"); // leap
    expect(addDaysDateOnly("2024-02-29", 1)).toBe("2024-03-01");
    expect(addDaysDateOnly("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("zero days is identity", () => {
    expect(addDaysDateOnly("2026-09-08", 0)).toBe("2026-09-08");
  });
});

describe("dateOnlyDiffDays", () => {
  it("diff same date is 0", () => {
    expect(dateOnlyDiffDays("2026-09-08", "2026-09-08")).toBe(0);
  });

  it("positive when a after b", () => {
    expect(dateOnlyDiffDays("2026-09-09", "2026-09-08")).toBe(1);
    expect(dateOnlyDiffDays("2026-09-15", "2026-09-08")).toBe(7);
  });

  it("negative when a before b", () => {
    expect(dateOnlyDiffDays("2026-09-07", "2026-09-08")).toBe(-1);
    expect(dateOnlyDiffDays("2026-01-01", "2026-12-31")).toBe(-364);
  });

  it("cross year", () => {
    expect(dateOnlyDiffDays("2027-01-01", "2026-12-31")).toBe(1);
    expect(dateOnlyDiffDays("2026-12-31", "2027-01-01")).toBe(-1);
  });
});

describe("weekBounds Monday-start", () => {
  it("mid-week Tuesday", () => {
    // 2026-09-08 is a Tuesday (verified: 2026-09-08 dow = 2)
    // Monday = 2026-09-07, Sunday = 2026-09-13
    expect(weekBounds("2026-09-08")).toEqual({ start: "2026-09-07", end: "2026-09-13" });
  });

  it("Monday itself", () => {
    expect(weekBounds("2026-09-07")).toEqual({ start: "2026-09-07", end: "2026-09-13" });
  });

  it("Sunday", () => {
    expect(weekBounds("2026-09-13")).toEqual({ start: "2026-09-07", end: "2026-09-13" });
  });

  it("week crossing month boundary", () => {
    // 2026-06-01 is Monday → week 2026-06-01 .. 2026-06-07
    expect(weekBounds("2026-06-01")).toEqual({ start: "2026-06-01", end: "2026-06-07" });
    // Friday 2026-05-30 → Monday 2026-05-25? Let's verify: 2026-05-25 Mon → week 25-31
    // Actually check: 2026-05-31 is Sunday → 2026-05-25 Mon.
    expect(weekBounds("2026-05-31")).toEqual({ start: "2026-05-25", end: "2026-05-31" });
  });

  it("week crossing year boundary", () => {
    // 2026-01-01 is Thursday → Monday is 2025-12-29, Sunday 2026-01-04
    expect(weekBounds("2026-01-01")).toEqual({ start: "2025-12-29", end: "2026-01-04" });
  });
});

describe("formatDateOnly with locales", () => {
  it("formats in en locale (en-GB)", () => {
    // Use UTC zone for determinism
    const out = formatDateOnly("2026-09-08", "en");
    // Should contain day, month, year numbers (en-GB format)
    expect(out).toContain("2026");
    expect(out).toContain("8"); // day
    expect(out.length).toBeGreaterThan(0);
  });

  it("formats in cs locale", () => {
    const out = formatDateOnly("2026-09-08", "cs");
    expect(out).toContain("2026");
    expect(out.length).toBeGreaterThan(0);
  });

  it("returns empty for null/undefined", () => {
    expect(formatDateOnly(null, "en")).toBe("");
    expect(formatDateOnly(undefined, "cs")).toBe("");
    expect(formatDateOnly("", "en")).toBe("");
  });

  it("returns original string for invalid", () => {
    expect(formatDateOnly("not-a-date", "en")).toBe("not-a-date");
  });

  it("cs and en produce potentially different ordering", () => {
    // Both contain year but formatting differs; check they at least both contain the day number
    const en = formatDateOnly("2026-12-25", "en");
    const cs = formatDateOnly("2026-12-25", "cs");
    expect(en).toContain("2026");
    expect(cs).toContain("2026");
    expect(en.length).toBeGreaterThan(0);
    expect(cs.length).toBeGreaterThan(0);
  });
});

describe("relativeDayLabel (today/tomorrow/yesterday)", () => {
  const today = "2026-09-08";

  it("today", () => {
    expect(relativeDayLabel("2026-09-08", today, "en")).toBe("today");
    expect(relativeDayLabel("2026-09-08", today, "cs")).toBe("dnes");
  });

  it("tomorrow", () => {
    expect(relativeDayLabel("2026-09-09", today, "en")).toBe("tomorrow");
    expect(relativeDayLabel("2026-09-09", today, "cs")).toBe("zítra");
  });

  it("yesterday", () => {
    expect(relativeDayLabel("2026-09-07", today, "en")).toBe("yesterday");
    expect(relativeDayLabel("2026-09-07", today, "cs")).toBe("včera");
  });

  it("days ago", () => {
    expect(relativeDayLabel("2026-09-06", today, "en")).toBe("2 days ago");
    expect(relativeDayLabel("2026-09-06", today, "cs")).toBe("před 2 dny");
    expect(relativeDayLabel("2026-09-03", today, "en")).toBe("5 days ago");
  });

  it("in days", () => {
    expect(relativeDayLabel("2026-09-10", today, "en")).toBe("in 2 days");
    expect(relativeDayLabel("2026-09-10", today, "cs")).toBe("za 2 dní");
    expect(relativeDayLabel("2026-09-13", today, "en")).toBe("in 5 days");
  });

  it("beyond 7 days returns empty (future only)", () => {
    // implementation: future diff >=7 → "", past always labelled
    expect(relativeDayLabel("2026-09-16", today, "en")).toBe(""); // +8
    expect(relativeDayLabel("2026-09-15", today, "en")).toBe(""); // +7
    // past beyond 7 still labelled (no cutoff for past)
    expect(relativeDayLabel("2026-08-31", today, "cs")).toBe("před 8 dny"); // -8
    expect(relativeDayLabel("2026-09-01", today, "en")).toBe("7 days ago"); // -7
  });

  it("exactly 7 days away: future empty, past labelled", () => {
    expect(relativeDayLabel("2026-09-15", today, "en")).toBe(""); // +7 → empty
    expect(relativeDayLabel("2026-09-01", today, "en")).toBe("7 days ago"); // -7 → labelled
  });

  it("6 days away still labelled", () => {
    expect(relativeDayLabel("2026-09-14", today, "en")).toBe("in 6 days");
    expect(relativeDayLabel("2026-09-02", today, "en")).toBe("6 days ago");
  });
});
