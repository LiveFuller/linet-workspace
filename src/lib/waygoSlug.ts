// Waygo slug + QR engine — pure utils, no side effects.

/** Slugify hotel name → url-safe slug fragment */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 40) || "hotel";
}

export function generateHotelSlug(name: string, area: string, existing: Set<string>): string {
  const base = `${slugify(name)}-${slugify(area)}`;
  let slug = base;
  let i = 2;
  while (existing.has(slug)) {
    slug = `${base}-${i}`;
    i++;
  }
  return slug;
}

export function generateReceptionCode(existingCodes: Set<string>): string {
  // R + 2-3 alphanum: R42, A7, K12
  const letters = "ABCDEFGHKLMPRSTXYZ";
  for (let attempt = 0; attempt < 100; attempt++) {
    const l = letters[Math.floor(Math.random() * letters.length)];
    const n = Math.floor(Math.random() * 90) + 10;
    const code = `${l}${n}`;
    if (!existingCodes.has(code)) return code;
  }
  return `R${Date.now().toString().slice(-4)}`;
}

export function hotelQrSlug(hotelSlug: string, suffix?: string): string {
  // short shareable: miramare-praha1-x42  (keeps < 24 chars)
  const short = hotelSlug.slice(0, 18).replace(/-$/, "");
  const tail = suffix ? `-${slugify(suffix).slice(0, 6)}` : `-${Math.random().toString(36).slice(2,5)}`;
  return `${short}${tail}`;
}

/** Build public URL that QR encodes. e.g. https://waygo.cz/r/miramare-p1-x42  */
export function buildQrUrl(origin: string, slug: string): string {
  const o = origin.replace(/\/$/, "");
  return `${o}/r/${slug}`;
}

/** Build tracking UTM link for redirect destination */
export function buildRedirectTarget(baseDiscoverUrl: string, hotelSlug: string, codeSlug: string): string {
  const u = new URL(baseDiscoverUrl);
  u.searchParams.set("src", hotelSlug);
  u.searchParams.set("via", codeSlug);
  u.searchParams.set("utm_source", "hotel");
  u.searchParams.set("utm_medium", "qr");
  u.searchParams.set("utm_campaign", hotelSlug);
  return u.toString();
}

/** Validate slug format */
export function isValidWaygoSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/.test(s) && s.length >= 6 && s.length <= 40;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    prospect: "#6b7280",
    contacted: "#3b82f6",
    meeting: "#8b5cf6",
    loi: "#f59e0b",
    installed: "#06b6d4",
    live: "#10b981",
    churned: "#ef4444",
  };
  return map[status] ?? "#6b7280";
}
