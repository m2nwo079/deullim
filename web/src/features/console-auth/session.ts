import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "../../lib/supabase/server";
import { consoleAccess, LOGIN, PARTNERS_HOME } from "./rules";

/**
 * Reads the signed-in user and their console access once per request.
 * Call it from the console layout and from every console page: Next.js renders them in
 * parallel, so a check in the layout alone does not stop the page from rendering.
 */
export const getConsoleSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) {
    redirect(LOGIN);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", userId)
    .maybeSingle<{ role: string; display_name: string }>();
  // A partner who opens a console address goes to their own area instead of a dead end.
  if (profile?.role === "partner") {
    redirect(PARTNERS_HOME);
  }

  return {
    supabase,
    userId,
    access: consoleAccess(profile?.role),
    displayName: profile?.display_name ?? "",
  };
});
