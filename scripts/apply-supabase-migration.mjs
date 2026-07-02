#!/usr/bin/env node
/**
 * Apply supabase/migrations/001_library.sql via Supabase Management API.
 *
 * Requires a personal access token from https://supabase.com/dashboard/account/tokens
 *
 *   set SUPABASE_ACCESS_TOKEN=sbp_...
 *   node scripts/apply-supabase-migration.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_REF = "htdlgflnlmrfoqrwmtvk";
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!token) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN.\n" +
      "Create one at https://supabase.com/dashboard/account/tokens then run:\n" +
      "  set SUPABASE_ACCESS_TOKEN=sbp_...\n" +
      "  node scripts/apply-supabase-migration.mjs\n\n" +
      "Or paste supabase/migrations/001_library.sql into the SQL Editor:\n" +
      `  https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`
  );
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(join(root, "supabase/migrations/001_library.sql"), "utf8");

const response = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  }
);

const body = await response.text();
if (!response.ok) {
  console.error(`Migration failed (${response.status}):`, body);
  process.exit(1);
}

console.log("Migration applied successfully.");
if (body) console.log(body);
