import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client with the secret key. It bypasses RLS, so every Route Handler that uses it
 * must check the caller's role and site membership in code first (docs/auth.md).
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
