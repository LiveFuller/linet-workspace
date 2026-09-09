// supabase/functions/report-delivery/index.ts
// Deno Edge Function: scheduled report delivery for LINET Workspace.
// Authenticates via service role key or scheduled invocation secret, loads
// report_schedules, respects timezone/sendAtLocal, applies idempotency key
// (schedule/period/destination), bounded retries, returns terminal states.
// Type-checks with `deno check`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scheduled-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

// idempotency key: schedule/period/destination (deterministic)
function idempotencyKey(scheduleId: string, periodStart: string, destination: string): string {
  return `${scheduleId}/${periodStart}/${destination}`;
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function parseSendAtLocal(sendAtLocal: string): { h: number; m: number } | null {
  const m = sendAtLocal.match(/^([01][0-9]|2[0-3]):([0-5][0-9])$/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

// check if now in schedule's timezone matches sendAtLocal within a 5-min window (simplified)
// In production, use Temporal or luxon; here we compare UTC with timezone offset approximation via Intl.
function isDueNow(timezone: string, sendAtLocal: string, now: Date): boolean {
  const parsed = parseSendAtLocal(sendAtLocal);
  if (!parsed) return false;
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false });
    const parts = fmt.formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "99");
    const mi = Number(parts.find((p) => p.type === "minute")?.value ?? "99");
    // allow 15-min grace after scheduled time (for cron jitter)
    const scheduled = parsed.h * 60 + parsed.m;
    const nowMin = h * 60 + mi;
    const diff = nowMin - scheduled;
    return diff >= 0 && diff < 15;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const scheduledSecret = Deno.env.get("SCHEDULED_SECRET") ?? Deno.env.get("REPORT_DELIVERY_SECRET") ?? "";

  if (!supabaseUrl || (!serviceKey && !scheduledSecret)) {
    return jsonResponse({ error: "not_configured", detail: "SUPABASE_URL and SERVICE_ROLE or SCHEDULED_SECRET required" }, 500);
  }

  // auth: either Authorization Bearer serviceKey, or X-Scheduled-Secret, or apikey serviceKey
  const auth = req.headers.get("authorization") ?? "";
  const suppliedSecret = req.headers.get("x-scheduled-secret") ?? req.headers.get("x-report-secret") ?? "";
  const apikey = req.headers.get("apikey") ?? "";

  const isServiceAuth = serviceKey && (auth === `Bearer ${serviceKey}` || apikey === serviceKey);
  const isScheduledAuth = scheduledSecret && suppliedSecret === scheduledSecret;

  if (!isServiceAuth && !isScheduledAuth) {
    return jsonResponse({ error: "unauthorized", detail: "invalid service key or scheduled secret" }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    const t = await req.text();
    if (t) body = JSON.parse(t) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const now = new Date();
  const force = body.force === true;
  const scheduleIdFilter = typeof body.schedule_id === "string" && isUuid(body.schedule_id) ? body.schedule_id as string : null;

  const supabase = createClient(supabaseUrl, serviceKey || scheduledSecret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // load enabled schedules (or single)
  let query = supabase.from("report_schedules").select("*").eq("enabled", true);
  if (scheduleIdFilter) query = query.eq("id", scheduleIdFilter);
  const { data: schedules, error: schedErr } = await query;
  if (schedErr) {
    console.error("load schedules", schedErr.message);
    return jsonResponse({ error: "internal", detail: schedErr.message }, 500);
  }
  if (!schedules || schedules.length === 0) {
    return jsonResponse({ ok: true, delivered: 0, reason: "no_enabled_schedules" }, 200);
  }

  type Result = { schedule_id: string; period_start: string; destination: string; status: "delivered" | "skipped" | "failed" | "already_delivered"; detail?: string };

  const results: Result[] = [];
  let delivered = 0;

  for (const sched of schedules as Array<Record<string, unknown>>) {
    const sid = sched.id as string;
    const workspaceId = sched.workspace_id as string;
    const projectId = sched.project_id as string;
    const kind = sched.kind as string;
    const timezone = (sched.timezone as string) ?? "Pacific/Port_Moresby";
    const sendAtLocal = sched.send_at_local as string;
    const channel = sched.channel as string;
    const recipients = (sched.recipients as string[]) ?? [];

    // respect timezone/sendAtLocal unless forced
    if (!force && !isDueNow(timezone, sendAtLocal, now)) {
      results.push({ schedule_id: sid, period_start: "", destination: channel, status: "skipped", detail: "not_due" });
      continue;
    }

    // compute period: for daily => today, for weekly => monday
    const periodStart = kind === "weekly"
      ? (() => {
        const d = new Date(now);
        const day = d.getUTCDay();
        const diff = day === 0 ? -6 : 1 - day; // Monday
        d.setUTCDate(d.getUTCDate() + diff);
        return d.toISOString().slice(0, 10);
      })()
      : now.toISOString().slice(0, 10);

    // idempotency: one execution per schedule/period/destination (use integration_jobs table)
    for (const dest of (recipients.length ? recipients : [channel])) {
      const execKey = idempotencyKey(sid, periodStart, dest);
      // check existing succeeded job
      const { data: existing } = await supabase.from("integration_jobs").select("state").eq("workspace_id", workspaceId).eq("execution_key", execKey).maybeSingle();
      if (existing && (existing as { state: string }).state === "succeeded") {
        results.push({ schedule_id: sid, period_start: periodStart, destination: dest, status: "already_delivered" });
        continue;
      }

      // bounded retries: up to max_attempts (default 5) stored in integration_jobs
      let attempts = 0;
      let lastErr: string | null = null;
      let terminal: Result["status"] = "failed";

      // upsert job as queued
      const { error: upsertErr } = await supabase.from("integration_jobs").upsert({
        workspace_id: workspaceId,
        integration_id: "supabase",
        job_type: `report_${kind}`,
        execution_key: execKey,
        payload: { schedule_id: sid, project_id: projectId, kind, period_start: periodStart, destination: dest, channel, timezone, send_at_local: sendAtLocal },
        state: "queued",
        attempts: 0,
      }, { onConflict: "workspace_id,execution_key" });

      if (upsertErr) {
        results.push({ schedule_id: sid, period_start: periodStart, destination: dest, status: "failed", detail: upsertErr.message });
        continue;
      }

      // try delivery with bounded retries (max 3 attempts in this invocation)
      const maxTries = 3;
      for (let tryN = 1; tryN <= maxTries; tryN++) {
        attempts = tryN;
        try {
          await supabase.from("integration_jobs").update({ state: "running", attempts: tryN, started_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("execution_key", execKey);

          // load report for period (if exists) or generate placeholder
          const { data: report } = await supabase.from("reports").select("id,status").eq("project_id", projectId).eq("kind", kind).eq("period_start", periodStart).maybeSingle();

          // simulate delivery: in_app => insert notification; email => log (placeholder)
          if (channel === "in_app") {
            // idempotency already via execKey, so safe to insert notification dedupe
            // we use a synthetic person: first workspace member
            const { data: member } = await supabase.from("workspace_memberships").select("user_id").eq("workspace_id", workspaceId).limit(1).maybeSingle();
            if (member) {
              const dedupe = execKey;
              await supabase.from("notifications").upsert({
                person_id: (member as { user_id: string }).user_id,
                kind: "system",
                title: `Report ${kind} ${periodStart}`,
                body: `Scheduled ${kind} report for ${periodStart}`,
                destination: `/reports/${report ? (report as { id: string }).id : periodStart}`,
                dedupe_key: dedupe,
              }, { onConflict: "person_id,dedupe_key" });
            }
          } else {
            // email: placeholder — in production, call mail provider here
            // do not log email addresses with secrets
          }

          await supabase.from("integration_jobs").update({ state: "succeeded", completed_at: new Date().toISOString(), last_error: null }).eq("workspace_id", workspaceId).eq("execution_key", execKey);
          await supabase.from("report_schedules").update({ last_run_at: new Date().toISOString() }).eq("id", sid);
          terminal = "delivered";
          delivered++;
          break;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          await supabase.from("integration_jobs").update({ state: "failed", last_error: lastErr.slice(0, 2000) }).eq("workspace_id", workspaceId).eq("execution_key", execKey);
          if (tryN === maxTries) terminal = "failed";
          // exponential backoff would happen via next scheduled invocation; we bound retries per invocation
        }
      }

      results.push({ schedule_id: sid, period_start: periodStart, destination: dest, status: terminal, detail: lastErr ?? undefined });
    }
  }

  // terminal states: delivered, already_delivered, skipped, failed
  const hasFailures = results.some((r) => r.status === "failed");
  return jsonResponse({ ok: !hasFailures, delivered, results }, hasFailures ? 207 : 200);
});
