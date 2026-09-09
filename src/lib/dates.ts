// Date utilities. Key invariants:
// - Date-only deadlines are calendar dates ("YYYY-MM-DD"), never shifted across zones.
// - Actual instants are ISO strings and rendered in a selectable display zone.
// - Clock is injectable for deterministic tests.

export type Clock = () => Date;

export const DEFAULT_CLOCK: Clock = () => new Date();

export const TZ_PRAGUE = "Europe/Prague";
export const TZ_PORT_MORESBY = "Pacific/Port_Moresby";

/** Parse "YYYY-MM-DD" strictly. Rejects "2026-9-8" and overflow dates. */
export function parseDateOnly(s: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12) return null;
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d < 1 || d > daysInMonth) return null;
  return { y, m: mo, d };
}

export function isValidDateOnly(s: string | null | undefined): boolean {
  return parseDateOnly(s) !== null;
}

export function todayInZone(clock: Clock, timeZone: string): string {
  const now = clock();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(now); // en-CA gives YYYY-MM-DD
}

export function addDaysDateOnly(date: string, days: number): string {
  const { y, m, d } = parseDateOnly(date)!;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const y2 = dt.getUTCFullYear();
  const m2 = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d2 = String(dt.getUTCDate()).padStart(2, "0");
  return `${y2}-${m2}-${d2}`;
}

export function dateOnlyDiffDays(a: string, b: string): number {
  const pa = parseDateOnly(a)!, pb = parseDateOnly(b)!;
  const da = Date.UTC(pa.y, pa.m - 1, pa.d);
  const db = Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round((da - db) / 86400000);
}

/** Monday-start week. Returns [monday, sunday] as date-only strings. */
export function weekBounds(date: string): { start: string; end: string } {
  const { y, m, d } = parseDateOnly(date)!;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=Sun..6=Sat
  const daysFromMonday = (dow + 6) % 7;
  const monday = addDaysDateOnly(date, -daysFromMonday);
  const sunday = addDaysDateOnly(monday, 6);
  return { start: monday, end: sunday };
}

export function formatDateOnly(date: string | null | undefined, locale: string, timeZone?: string): string {
  if (!date) return "";
  const p = parseDateOnly(date);
  if (!p) return date;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
  const opts: Intl.DateTimeFormatOptions = timeZone
    ? { timeZone, year: "numeric", month: "numeric", day: "numeric" }
    : { year: "numeric", month: "numeric", day: "numeric" };
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "cs-CZ", opts).format(dt);
}

export function formatWeekdayDate(date: string, locale: string): string {
  const p = parseDateOnly(date)!;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "cs-CZ", {
    weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC",
  }).format(dt);
}

export function formatInstant(iso: string | null | undefined, locale: string, timeZone: string, withDate = true): string {
  if (!iso) return "";
  const dt = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = {
    timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
    ...(withDate ? { weekday: "short", day: "numeric", month: "numeric" } : {}),
  };
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "cs-CZ", opts).format(dt);
}

export function formatDateTimeForInput(iso: string, timeZone: string): string {
  const dt = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(dt);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function localInputToInstant(input: string, timeZone: string): string {
  // input "YYYY-MM-DDTHH:mm" interpreted in timeZone → ISO instant (UTC)
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(input);
  if (!m) return new Date(input).toISOString();
  const [, y, mo, d, h, mi] = m;
  // Compute offset of that wall time in the zone, then convert.
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  // Determine zone offset at that instant by probing.
  const probe = new Date(naive);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(probe);
  const pm = /(\d+)\/(\d+)\/(\d+), (\d+):(\d+)/.exec(fmt)!;
  const asUTC = Date.UTC(Number(pm[3]), Number(pm[1]) - 1, Number(pm[2]), Number(pm[4]) % 24, Number(pm[5]));
  const offset = asUTC - naive;
  return new Date(naive - offset).toISOString();
}

/** Monday-start week number, ISO 8601. */
export function isoWeekNumber(date: string): number {
  const { y, m, d } = parseDateOnly(date)!;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const fDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDayNum + 3);
  return 1 + Math.round((dt.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

/** Relative day label for date-only values, computed against "today" in the display zone. */
export function relativeDayLabel(date: string, today: string, locale: string): string {
  const diff = dateOnlyDiffDays(date, today);
  if (diff === 0) return locale === "en" ? "today" : "dnes";
  if (diff === 1) return locale === "en" ? "tomorrow" : "zítra";
  if (diff === -1) return locale === "en" ? "yesterday" : "včera";
  if (diff < 0) return locale === "en" ? `${-diff} days ago` : `před ${-diff} dny`;
  if (diff < 7) return locale === "en" ? `in ${diff} days` : `za ${diff} dní`;
  return "";
}
