export type SupabaseConfigStatus =
  | "ready"
  | "missing_url"
  | "missing_key"
  | "missing_both";

export const DEFAULT_SUPABASE_PROJECT_URL =
  "https://htdlgflnlmrfoqrwmtvk.supabase.co";

export function getSupabasePublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = getSupabasePublishableKey();

  if (url && key) return "ready";
  if (url && !key) return "missing_key";
  if (!url && key) return "missing_url";
  return "missing_both";
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigStatus() === "ready";
}

export function supabaseProjectUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_PROJECT_URL;
}
