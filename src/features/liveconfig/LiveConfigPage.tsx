// Honest configuration screen for live mode with missing/invalid configuration.
// NEVER falls back to demo data from a failed live operation.
export default function LiveConfigPage({ message }: { message: string }) {
  return (
    <div className="page page-narrow" role="alert">
      <h1 className="page-title">Live režim — nutná konfigurace</h1>
      <p className="page-subtitle">Live mode requires configuration</p>
      <div className="banner banner-warn">
        <div>
          <p><strong>Aplikace běží v režimu VITE_DATA_MODE=supabase, ale konfigurace chybí nebo je neplatná.</strong></p>
          <p className="small">Nastavte <code>VITE_SUPABASE_URL</code> a <code>VITE_SUPABASE_ANON_KEY</code> podle <code>.env.example</code> a restartujte. Aplikace se <strong>ne</strong>přepne do demo režimu automaticky.</p>
          {message && <p className="small muted">{message}</p>}
        </div>
      </div>
      <div className="card">
        <h3>Další kroky / Next steps</h3>
        <ol className="stack small">
          <li>Spusťte <code>supabase/setup.sql</code> v autorizovaném Supabase projektu (SQL editor).</li>
          <li>Nastavte public proměnné prostředí (URL + anon key).</li>
          <li>Vytvořte/pozvěte operátora a spusťte <code>scripts/bootstrap-owner.sql</code> (development only).</li>
          <li>Pro lokální demo bez konfigurace spusťte s <code>VITE_DATA_MODE=local</code> (výchozí).</li>
        </ol>
      </div>
    </div>
  );
}
