// Waygo domain — Prague hand-picked experiences: hotel distribution via QR slugs.
// Single source of truth for IndexedDB (local) and Supabase (live).

export type WaygoHotelStatus =
  | "prospect"
  | "contacted"
  | "meeting"
  | "loi"
  | "installed"
  | "live"
  | "churned";

export type WaygoArea =
  | "Praha 1"
  | "Praha 2"
  | "Praha 3"
  | "Praha 4"
  | "Praha 5"
  | "Praha 6"
  | "Praha 7"
  | "Praha 8"
  | "Celá Praha";

export interface WaygoHotel {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  slug: string; // url-safe, unique: e.g. hotel-miramare-praha1
  address: string;
  area: WaygoArea;
  stars: number | null; // 3-5 or null
  rooms: number | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: WaygoHotelStatus;
  commissionHotelPct: number; // 8-15 typical
  commissionReceptionPct: number; // personal reward
  slugQr: string; // full slug used in /r/:slug -> e.g. miramare-p1-042
  ownerId: string | null; // Person id responsible
  notes: string | null;
  // denormalized counters (updated on scan/booking)
  scansTotal: number;
  bookingsTotal: number;
  revenueCzkTotal: number;
  createdAt: string;
  updatedAt: string;
  installedAt: string | null;
  liveAt: string | null;
}

export interface WaygoReceptionCode {
  id: string;
  hotelId: string;
  code: string; // short: e.g. R42, A1
  displayName: string; // "Reception desk" or "Petra - reception"
  slug: string; // e.g. miramare-p1-042-r42
  type: "hotel_shared" | "personal";
  personName: string | null;
  scansTotal: number;
  bookingsTotal: number;
  revenueCzkTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface WaygoScan {
  id: string;
  hotelId: string;
  codeId: string | null;
  slug: string; // resolved slug
  scannedAt: string; // ISO
  // hashed privacy
  ipHash: string | null;
  userAgent: string | null;
  referrer: string | null;
  convertedToBooking: boolean;
  // optional geo
  country: string | null;
}

export type WaygoBookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface WaygoBooking {
  id: string;
  hotelId: string;
  codeId: string | null;
  slug: string;
  experienceSlug: string | null;
  experienceTitle: string;
  amountCzk: number;
  commissionCzk: number;
  guestCountry: string | null;
  status: WaygoBookingStatus;
  bookedAt: string;
  createdAt: string;
}

export type OutreachKind = "email" | "call" | "visit" | "follow_up" | "note";

export interface WaygoOutreach {
  id: string;
  hotelId: string;
  kind: OutreachKind;
  subject: string;
  body: string;
  // AI generated helpers
  aiDraft: string | null;
  outcome: string | null; // "no answer", "meeting booked", etc
  nextFollowUpAt: string | null; // date
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WaygoProvider {
  id: string;
  businessName: string;
  ico: string | null;
  category: string;
  address: string;
  area: WaygoArea;
  priceCzk: number | null;
  commissionPct: number | null;
  email: string;
  phone: string | null;
  status: "applied" | "vetting" | "approved" | "rejected" | "paused";
  createdAt: string;
  updatedAt: string;
}

// Aggregated stats for owner dashboard
export interface WaygoHotelStats {
  hotelId: string;
  slug: string;
  name: string;
  status: WaygoHotelStatus;
  scans7d: number;
  scans30d: number;
  bookings7d: number;
  bookings30d: number;
  conv7d: number; // bookings/scans %
  conv30d: number;
  revenue7d: number;
  revenue30d: number;
}

// Slug helpers re-exported from lib for convenience
export const WAYGO_STATUSES: { value: WaygoHotelStatus; cs: string; en: string; color: string }[] = [
  { value: "prospect", cs: "Prospekt", en: "Prospect", color: "#6b7280" },
  { value: "contacted", cs: "Kontaktován", en: "Contacted", color: "#3b82f6" },
  { value: "meeting", cs: "Schůzka", en: "Meeting", color: "#8b5cf6" },
  { value: "loi", cs: "LOI / dohoda", en: "LOI", color: "#f59e0b" },
  { value: "installed", cs: "QR instalován", en: "Installed", color: "#06b6d4" },
  { value: "live", cs: "Live", en: "Live", color: "#10b981" },
  { value: "churned", cs: "Churn", en: "Churned", color: "#ef4444" },
];

export const WAYGO_AREAS: WaygoArea[] = [
  "Praha 1",
  "Praha 2",
  "Praha 3",
  "Praha 4",
  "Praha 5",
  "Praha 6",
  "Praha 7",
  "Praha 8",
  "Celá Praha",
];
