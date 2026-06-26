import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, isSupabaseConfigured } from "@/lib/supabase/config";

export { getSupabaseConfigStatus, getSupabasePublishableKey, isSupabaseConfigured, supabaseProjectUrl } from "@/lib/supabase/config";

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const anonKey = getSupabasePublishableKey();

  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey);
  }

  return browserClient;
}

export const LIBRARY_BLOBS_BUCKET = "library-blobs";
