#!/usr/bin/env node
// scripts/bootstrap-owner.mjs — Bootstrap a workspace owner (idempotent, rerun-safe)
// Usage: node scripts/bootstrap-owner.mjs --user <uuid-or-email> --workspace <name>
// Reads: VITE_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY from env.
// Never reads service key from VITE_* vars. Safe to rerun: reuses existing workspace/membership.

import { createClient } from "@supabase/supabase-js";

function printUsageAndExit(code = 0) {
  console.log(`
LINET Workspace — bootstrap-owner

Usage:
  node scripts/bootstrap-owner.mjs --user <uuid-or-email> --workspace <name>

Options:
  --user <id>        Supabase auth user id (uuid) or email
  --workspace <name> Workspace display name (e.g. "LINET PNG Pilot")
  --help             Show this help

Env (required):
  VITE_SUPABASE_URL            Supabase project URL (public, from .env.example)
  SUPABASE_SERVICE_ROLE_KEY    Service role key (server-only, never VITE_*)

Notes:
  - Safe to rerun: reuses existing workspace/membership, does not drop data,
    duplicate invites, reset progress, or overwrite edited settings.
  - Fails clearly if schema_version 1 is missing (run supabase/setup.sql first).
  - Prints sanitized next steps (no secrets).
`.trim());
  process.exit(code);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--user" && argv[i + 1]) out.user = argv[++i];
    else if (a === "--workspace" && argv[i + 1]) out.workspace = argv[++i];
    else if (a.startsWith("--")) {
      console.error(`Unknown flag: ${a}`);
      printUsageAndExit(1);
    }
  }
  return out;
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "workspace";
}

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) printUsageAndExit(0);
  if (!args.user || !args.workspace) {
    console.error("Error: --user and --workspace are required");
    printUsageAndExit(1);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  // Never accept service key from VITE_* (client bundle)
  if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Error: SUPABASE_SERVICE_ROLE_KEY must not be provided via VITE_* (client) variable");
    process.exit(1);
  }
  if (!supabaseUrl) {
    console.error("Error: VITE_SUPABASE_URL (or SUPABASE_URL) is not set");
    process.exit(1);
  }
  if (!serviceKey) {
    console.error("Error: SUPABASE_SERVICE_ROLE_KEY is not set (server-only)");
    process.exit(1);
  }

  // Basic URL sanity without leaking key
  let host;
  try {
    host = new URL(supabaseUrl).host;
  } catch {
    console.error("Error: VITE_SUPABASE_URL is not a valid URL");
    process.exit(1);
  }

  console.log(`Bootstrapping workspace "${args.workspace}" for user "${args.user}" against ${host} ...`);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Resolve auth user
  let userId = null;
  let userEmail = null;
  if (isUuid(args.user)) {
    userId = args.user;
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user) {
      console.error(`Error: auth user not found for id ${userId}: ${error?.message ?? "not found"}`);
      process.exit(1);
    }
    userEmail = data.user.email ?? null;
  } else {
    // email lookup — paginate (Supabase admin listUsers)
    let found = null;
    let page = 1;
    for (; page <= 10; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        console.error(`Error listing users: ${error.message}`);
        process.exit(1);
      }
      const u = data.users.find((x) => x.email?.toLowerCase() === args.user.toLowerCase());
      if (u) { found = u; break; }
      if (data.users.length < 1000) break;
    }
    if (!found) {
      console.error(`Error: auth user not found for email ${args.user}`);
      process.exit(1);
    }
    userId = found.id;
    userEmail = found.email ?? args.user;
  }

  console.log(`Resolved user: ${userId} ${userEmail ? `(${userEmail})` : ""}`);

  // 2. Guard: schema_version 1 must exist (setup.sql applied)
  const { data: ver, error: verErr } = await supabase.from("schema_version").select("version").eq("version", 1).maybeSingle();
  if (verErr) {
    console.error(`Error checking schema_version: ${verErr.message}`);
    console.error("Hint: run supabase/setup.sql in the Supabase SQL editor first");
    process.exit(1);
  }
  if (!ver) {
    console.error("Error: schema_version 1 not found — run supabase/setup.sql first");
    process.exit(1);
  }

  // 3. Ensure profile exists (idempotent, do not overwrite edited display_name)
  const { data: existingProfile } = await supabase.from("profiles").select("id, display_name").eq("id", userId).maybeSingle();
  if (!existingProfile) {
    const { error: pErr } = await supabase.from("profiles").insert({
      id: userId,
      email: userEmail ?? `${userId}@example.invalid`,
      display_name: userEmail ? userEmail.split("@")[0] : "Owner",
    });
    if (pErr && !pErr.message.includes("duplicate")) {
      console.error(`Error creating profile: ${pErr.message}`);
      process.exit(1);
    }
    console.log("Created profile for user");
  } else {
    console.log(`Profile exists (display_name="${existingProfile.display_name}") — not overwriting`);
  }

  // 4. Find or create workspace (safe to rerun: reuse by slug or name)
  const slug = slugify(args.workspace);
  let workspaceId = null;
  // Try by slug first (unique)
  {
    const { data } = await supabase.from("workspaces").select("id, name, slug").eq("slug", slug).maybeSingle();
    if (data) {
      workspaceId = data.id;
      console.log(`Reusing existing workspace by slug "${slug}": ${workspaceId} ("${data.name}")`);
    }
  }
  if (!workspaceId) {
    // Try by exact name
    const { data } = await supabase.from("workspaces").select("id, name, slug").eq("name", args.workspace).maybeSingle();
    if (data) {
      workspaceId = data.id;
      console.log(`Reusing existing workspace by name: ${workspaceId} ("${data.name}")`);
    }
  }
  if (!workspaceId) {
    const { data, error } = await supabase.from("workspaces").insert({
      name: args.workspace,
      slug,
      description: "",
      created_by: userId,
      settings: {},
    }).select("id").single();
    if (error) {
      // race: another bootstrap created it concurrently
      if (error.message.includes("duplicate") || error.code === "23505") {
        const { data: retry } = await supabase.from("workspaces").select("id").eq("slug", slug).maybeSingle();
        if (retry) {
          workspaceId = retry.id;
          console.log(`Workspace created concurrently, reusing ${workspaceId}`);
        } else {
          console.error(`Error creating workspace: ${error.message}`);
          process.exit(1);
        }
      } else {
        console.error(`Error creating workspace: ${error.message}`);
        process.exit(1);
      }
    } else {
      workspaceId = data.id;
      console.log(`Created workspace ${workspaceId} ("${args.workspace}", slug="${slug}")`);
    }
  }

  // 5. Ensure membership as workspace_admin (idempotent, do not downgrade if already admin)
  {
    const { data: existing } = await supabase.from("workspace_memberships").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
    if (existing) {
      if (existing.role !== "workspace_admin") {
        console.log(`Membership exists as ${existing.role} — upgrading to workspace_admin`);
        const { error: updErr } = await supabase.from("workspace_memberships").update({ role: "workspace_admin" }).eq("workspace_id", workspaceId).eq("user_id", userId);
        if (updErr) {
          console.error(`Error upgrading membership: ${updErr.message}`);
          process.exit(1);
        }
      } else {
        console.log("Membership already workspace_admin — not reassigning");
      }
    } else {
      const { error: insErr } = await supabase.from("workspace_memberships").insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: "workspace_admin",
      });
      if (insErr) {
        console.error(`Error creating membership: ${insErr.message}`);
        process.exit(1);
      }
      console.log("Created workspace_admin membership");
    }
  }

  // 6. Ensure at least one project exists (optional, for immediate use)
  {
    const { data: proj } = await supabase.from("projects").select("id, name").eq("workspace_id", workspaceId).limit(1).maybeSingle();
    if (!proj) {
      const { data: newProj, error: projErr } = await supabase.from("projects").insert({
        workspace_id: workspaceId,
        name: "Pilot Project",
        name_en: "Pilot Project",
        description: "Initial project for LINET Workspace pilot",
        timezone: "Pacific/Port_Moresby",
      }).select("id, name").single();
      if (projErr) {
        console.warn(`Warning: could not create pilot project: ${projErr.message}`);
      } else {
        console.log(`Created pilot project ${newProj.id} ("${newProj.name}")`);
        // also add membership
        await supabase.from("project_memberships").insert({
          project_id: newProj.id,
          workspace_id: workspaceId,
          user_id: userId,
          role: "workspace_admin",
        }).then(({ error }) => {
          if (error && !error.message.includes("duplicate")) console.warn(`project_membership warning: ${error.message}`);
        });
      }
    } else {
      console.log(`Project exists: ${proj.id} ("${proj.name}") — reusing`);
    }
  }

  console.log("\nBootstrap complete (sanitized):");
  console.log(`  Workspace: ${args.workspace} (slug: ${slug})`);
  console.log(`  Workspace ID: ${workspaceId}`);
  console.log(`  User: ${userId}${userEmail ? ` (${userEmail})` : ""} as workspace_admin`);
  console.log(`  Supabase: ${host}`);
  console.log("\nNext steps:");
  console.log("  1. Invite teammates via the app (Team page) or workspace_invitations table");
  console.log("  2. Verify RLS: psql -f supabase/tests/rls_tests.sql");
  console.log("  3. Verify integrity: psql -f supabase/tests/integrity_tests.sql");
  console.log("  4. Set VITE_DATA_MODE=supabase and VITE_SUPABASE_URL in your .env, then `npm run dev`");
  console.log("  5. Do NOT commit .env or service keys; rotate keys if exposed");
}

main().catch((e) => {
  console.error("Unhandled error:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
