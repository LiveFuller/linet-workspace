import type { WaygoHotel, WaygoScan, WaygoBooking } from "@/domain/waygo";

export function calcConversion(scans: number, bookings: number): number {
  if (!scans) return 0;
  return Math.round((bookings / scans) * 1000) / 10; // 1 decimal
}

export function statsForHotel(hotel: WaygoHotel, scans: WaygoScan[], bookings: WaygoBooking[], days: number) {
  const cutoff = Date.now() - days * 24 * 3600_000;
  const s = scans.filter((x) => x.hotelId === hotel.id && new Date(x.scannedAt).getTime() >= cutoff);
  const b = bookings.filter((x) => x.hotelId === hotel.id && new Date(x.bookedAt).getTime() >= cutoff);
  const rev = b.reduce((acc, x) => acc + x.commissionCzk, 0);
  return { scans: s.length, bookings: b.length, revenue: rev, conv: calcConversion(s.length, b.length) };
}

export function outreachTemplate(kind: "first" | "followup" | "meeting", hotelName: string, contactName: string | null): { subject: string; body: string } {
  const name = contactName ? `pane ${contactName.split(" ")[0]}` : "dobrý den";
  if (kind === "first") {
    return {
      subject: `Waygo pro ${hotelName} — 12% z každé rezervace hosta`,
      body: `Dobrý den ${name},\n\nVaši hosté denně hledají co dělat v Praze. Waygo jim dá kurátorský katalog (procházky, lodě, gastronomie) přímo do telefonu — bez práce pro recepci.\n\nStačí QR stojánek na pult. Vy inkasujete podíl od první rezervace, host platí poskytovateli až na místě.\n\nMůžeme ukázat live 15 minut — třeba v úterý v 11:00 u vás na recepci? Stačí odpověď „ano 11:00“ a přijdeme.\n\nS pozdravem\nWaygo — Václavské náměstí 57, Praha 1\nwaygo.cz · +420 775 868 571`,
    };
  }
  if (kind === "followup") {
    return {
      subject: `Re: Waygo pro ${hotelName}`,
      body: `Dobrý den ${name},\n\njen připomínám Waygo — host scanuje, vybírá a rezervuje sám. Recepce nevolá, neřeší ceny ani dostupnost.\n\nMá smysl krátká ukázka (10 min) tento týden? Úterý/čtvrtek 11:00 u vás.\n\nWaygo`,
    };
  }
  return {
    subject: `Potvrzení schůzky — Waygo × ${hotelName}`,
    body: `Dobrý den ${name},\n\npotvrzuji schůzku k Waygo zítra v 11:00 u vás na recepci. Přineseme QR stojánek + ukázku katalogu, domluvíme provizi a spustíme do 48 h.\n\nTěšíme se!\nWaygo`,
  };
}

export function statusBadge(status: WaygoHotel["status"]): { label: string; bg: string; fg: string } {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    prospect: { label: "Prospekt", bg: "#f3f4f6", fg: "#374151" },
    contacted: { label: "Kontaktován", bg: "#dbeafe", fg: "#1e40af" },
    meeting: { label: "Schůzka", bg: "#ede9fe", fg: "#6d28d9" },
    loi: { label: "LOI", bg: "#fef3c7", fg: "#92400e" },
    installed: { label: "Instalován", bg: "#cffafe", fg: "#155e75" },
    live: { label: "Live", bg: "#d1fae5", fg: "#065f46" },
    churned: { label: "Churn", bg: "#fee2e2", fg: "#991b1b" },
  };
  return map[status] ?? map.prospect;
}
