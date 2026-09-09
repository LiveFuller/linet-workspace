#!/usr/bin/env node
// scripts/verify-sql-sync.mjs — Verify supabase/setup.sql and supabase/migrations/0001_init.sql are sync'd
// Usage: node scripts/verify-sql-sync.mjs  (also: npm run sql:verify-setup)
// Strips the header comment (first 5 lines) and asserts remainder identical.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname ? import.meta.dirname : ".", "..");
const SETUP = resolve(ROOT, "supabase/setup.sql");
const MIGRATION = resolve(ROOT, "supabase/migrations/0001_init.sql");

function stripHeader(content) {
  // Normalize line endings to \n for comparison, but keep file's original for diff count
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  // Strip first 5 lines (header comment)
  const remainder = lines.slice(5).join("\n");
  return remainder;
}

async function main() {
  let setupRaw, migrationRaw;
  try {
    setupRaw = await readFile(SETUP, "utf8");
  } catch (e) {
    console.error(`Error reading ${SETUP}: ${e.message}`);
    process.exit(1);
  }
  try {
    migrationRaw = await readFile(MIGRATION, "utf8");
  } catch (e) {
    console.error(`Error reading ${MIGRATION}: ${e.message}`);
    process.exit(1);
  }

  const setupBody = stripHeader(setupRaw);
  const migrationBody = stripHeader(migrationRaw);

  if (setupBody === migrationBody) {
    console.log("✓ supabase/setup.sql and supabase/migrations/0001_init.sql are in sync (after stripping 5-line header)");
    console.log(`  Body length: ${setupBody.length} chars, ${(setupBody.split("\n").length)} lines`);
    process.exit(0);
  }

  // diff line count
  const aLines = setupBody.split("\n");
  const bLines = migrationBody.split("\n");
  const max = Math.max(aLines.length, bLines.length);
  let diffCount = 0;
  const diffs = [];
  for (let i = 0; i < max; i++) {
    const a = aLines[i] ?? "<missing>";
    const b = bLines[i] ?? "<missing>";
    if (a !== b) {
      diffCount++;
      if (diffs.length < 20) diffs.push(`  line ${i + 6}: setup: ${JSON.stringify(a.slice(0, 120))} | migration: ${JSON.stringify(b.slice(0, 120))}`);
    }
  }

  console.error("✗ supabase/setup.sql and supabase/migrations/0001_init.sql are OUT OF SYNC");
  console.error(`  Setup body: ${aLines.length} lines, Migration body: ${bLines.length} lines`);
  console.error(`  Diff lines: ${diffCount}`);
  if (diffs.length) {
    console.error("  First diffs:");
    for (const d of diffs) console.error(d);
  }
  console.error("\nFix: edit supabase/migrations/0001_init.sql then regenerate supabase/setup.sql (or vice versa) so functional SQL after first 5 lines is identical.");
  process.exit(1);
}

main();
