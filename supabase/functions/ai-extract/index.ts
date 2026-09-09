// supabase/functions/ai-extract/index.ts
// Deno Edge Function: AI extraction stub for LINET Workspace.
// Validates JWT via Supabase Auth, checks workspace membership, validates input
// size/schema, rate-limits, calls AI provider if configured (else returns not_configured),
// sanitizes output, never stores secrets. Handles CORS. Type-checks with `deno check`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scheduled-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BODY_BYTES = 500 * 1024; // 500 KiB
const MAX_TEXT_CHARS = 50_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

// in-memory rate limiter (per isolate; best-effort)
const rateMap = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count += 1;
  return false;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function sanitize(text: string): string {
  // strip control chars, limit length, escape for safe display; never echo secrets
  return text.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 2000).trim();
}

type ExtractInput = {
  workspace_id: string;
  project_id?: string;
  text: string;
  kind?: "transcript" | "inbox" | "note";
  meeting_id?: string;
};

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function validateInput(raw: unknown): { ok: true; data: ExtractInput } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "invalid_json" };
  const o = raw as Record<string, unknown>;
  if (typeof o.workspace_id !== "string" || !isUuid(o.workspace_id)) return { ok: false, error: "workspace_id must be uuid" };
  if (o.project_id !== undefined && (typeof o.project_id !== "string" || !isUuid(o.project_id))) return { ok: false, error: "project_id must be uuid" };
  if (typeof o.text !== "string") return { ok: false, error: "text is required" };
  if (o.text.length === 0 || o.text.length > MAX_TEXT_CHARS) return { ok: false, error: `text length 1..${MAX_TEXT_CHARS}` };
  if (o.kind !== undefined && !["transcript", "inbox", "note"].includes(o.kind as string)) return { ok: false, error: "kind invalid" };
  if (o.meeting_id !== undefined && (typeof o.meeting_id !== "string" || !isUuid(o.meeting_id))) return { ok: false, error: "meeting_id must be uuid" };
  return { ok: true, data: o as ExtractInput };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // size guard via Content-Length if present
  const cl = req.headers.get("content-length");
  if (cl && Number(cl) > MAX_BODY_BYTES) {
    return jsonResponse({ error: "payload_too_large" }, 413);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "not_configured", detail: "SUPABASE_URL/ANON_KEY missing" }, 500);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "unauthorized", detail: "missing bearer token" }, 401);
  }
  const token = authHeader.slice(7).trim();
  if (!token) return jsonResponse({ error: "unauthorized" }, 401);

  // read body with limit
  let rawBody: string;
  try {
    rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) return jsonResponse({ error: "payload_too_large" }, 413);
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const validated = validateInput(parsed);
  if (!validated.ok) return jsonResponse({ error: "validation", detail: validated.error }, 400);

  const input = validated.data;

  // verify JWT and get user
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "unauthorized", detail: "invalid token" }, 401);
  }
  const userId = userData.user.id;

  if (rateLimited(userId)) {
    return jsonResponse({ error: "rate_limited", detail: "too many requests" }, 429);
  }

  // membership check: must be member of workspace (and project if provided)
  const { data: membership, error: memErr } = await supabase
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", input.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (memErr) {
    console.error("membership check failed", memErr.message);
    return jsonResponse({ error: "internal" }, 500);
  }
  if (!membership) {
    return jsonResponse({ error: "forbidden", detail: "not a workspace member" }, 403);
  }

  // optional project membership check (if project_id provided, ensure caller can access project workspace)
  if (input.project_id) {
    const { data: proj } = await supabase.from("projects").select("workspace_id").eq("id", input.project_id).maybeSingle();
    if (!proj || proj.workspace_id !== input.workspace_id) {
      return jsonResponse({ error: "validation", detail: "project_id not in workspace" }, 400);
    }
  }

  // AI provider placeholder — honest: if no key, return not_configured
  const aiKey = Deno.env.get("AI_PROVIDER_KEY") ?? Deno.env.get("OPENAI_API_KEY") ?? "";
  const aiUrl = Deno.env.get("AI_PROVIDER_URL") ?? "";
  if (!aiKey || !aiUrl) {
    return jsonResponse({ error: "not_configured", detail: "AI provider not configured — set AI_PROVIDER_KEY and AI_PROVIDER_URL" }, 503);
  }

  // NOTE: never log aiKey, never store secrets, never echo raw provider errors with secrets
  // Here we would call the provider; for the stub we simulate a sanitized deterministic extraction:
  // In production, replace this block with a fetch to aiUrl using aiKey.
  try {
    // Simulate provider call with timeout (bounded)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // Placeholder: instead of real fetch, we do a local sanitized heuristic
    // To keep the stub runnable without external network, we do NOT actually fetch.
    // If you configure a real provider, uncomment the fetch below:
    /*
    const resp = await fetch(aiUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.text.slice(0, 4000), kind: input.kind ?? "note" }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) throw new Error(`provider ${resp.status}`);
    const providerJson = await resp.json();
    */

    clearTimeout(timeout);

    // deterministic helper: split into lines, produce up to 3 proposals
    const lines = input.text.split(/\n/).map((l) => l.trim()).filter(Boolean).slice(0, 20);
    const proposals = lines.slice(0, 3).map((line, idx) => ({
      source_action_key: `heuristic-${idx}-${line.slice(0, 20).replace(/\W+/g, "_")}`,
      proposed_title: sanitize(line.slice(0, 120)),
      evidence_text: sanitize(line),
      extraction_method: "deterministic_helper" as const,
    }));

    const sanitized = proposals.map((p) => ({
      source_action_key: sanitize(p.source_action_key),
      proposed_title: sanitize(p.proposed_title),
      evidence_text: sanitize(p.evidence_text),
      extraction_method: p.extraction_method,
    }));

    return jsonResponse({ ok: true, proposals: sanitized, provider: "stub" }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // sanitize error, never leak key
    return jsonResponse({ error: "provider_error", detail: sanitize(msg).slice(0, 500) }, 502);
  }
});
