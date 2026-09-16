// Public redirect: /r/:slug — logs scan then forwards to waygo.cz discover with tracking.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useApp } from "@/app/AppProvider";
import { buildRedirectTarget } from "@/lib/waygoSlug";

export default function WaygoRedirectPage() {
  const { slug = "" } = useParams();
  const { repo, snapshot } = useApp();
  const [done, setDone] = useState(false);
  const [target, setTarget] = useState<string>("");

  useEffect(() => {
    if (!slug || !repo) return;
    const hotels = snapshot?.waygoHotels ?? [];
    const codes = snapshot?.waygoCodes ?? [];
    let hotel = hotels.find((h) => h.slugQr === slug || h.slug === slug);
    const code = codes.find((c) => c.slug === slug);
    if (code) hotel = hotels.find((h) => h.id === code!.hotelId) ?? hotel;
    if (!hotel && slug.includes("-")) {
      const base = slug.split("-").slice(0, -1).join("-");
      hotel = hotels.find((h) => h.slug === base || h.slugQr.startsWith(base));
    }
    const hotelSlug = hotel?.slug ?? slug;
    const codeSlug = code?.slug ?? slug;
    const dest = buildRedirectTarget("https://waygo.cz/discover", hotelSlug, codeSlug);
    setTarget(dest);

    // log scan (best effort)
    repo.recordWaygoScan(slug, {
      userAgent: navigator.userAgent,
      referrer: document.referrer || null,
      ipHash: null,
      country: null,
    }).catch(() => {});

    const t = setTimeout(() => {
      setDone(true);
      window.location.href = dest;
    }, 900);
    return () => clearTimeout(t);
  }, [slug, repo, snapshot]);

  return (
    <div className="page page-narrow" style={{ textAlign: "center", paddingTop: 48 }}>
      <div className="card" style={{ padding: 28, maxWidth: 520, margin: "0 auto" }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: "var(--ink)" }}>WAYGO</div>
        <div className="small muted" style={{ marginTop: 4 }}>Hand-picked Prague experiences</div>
        <div style={{ margin: "22px auto", width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} aria-hidden />
        <p className="small" style={{ marginTop: 12, lineHeight: 1.6 }}>
          Přesměrovávám na katalog zážitků…<br />
          <span className="xsmall muted">{slug}</span>
        </p>
        {target && (
          <a href={target} className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setDone(true)}>
            Otevřít katalog
          </a>
        )}
        <p className="xsmall muted" style={{ marginTop: 14 }}>Tracking: scan uložen pro hotel. Pokud se nic nestane, klikněte výše.</p>
        {done && <p className="xsmall" style={{ color: "var(--success)" }}>Hotovo — přesměrováno</p>}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
