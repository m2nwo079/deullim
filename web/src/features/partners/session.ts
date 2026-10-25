import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "../../lib/supabase/server";
import { CONSOLE_HOME, LOGIN, partnersAccess } from "../console-auth/rules";

/**
 * Reads the signed-in user, their 들림 파트너스 access and company once per request. Call it from
 * the partner layout and from every partner page, as the console does (Next.js renders both in
 * parallel). The company comes from partner_members through RLS, so it is the user's own.
 */
export const getPartnerSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) {
    redirect(LOGIN);
  }

  const [{ data: profile }, { data: member }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, display_name")
      .eq("id", userId)
      .maybeSingle<{ role: string; display_name: string }>(),
    supabase
      .from("partner_members")
      .select("partner_id, partners(company_name)")
      .eq("profile_id", userId)
      .limit(1)
      .maybeSingle<{ partner_id: string; partners: { company_name: string } }>(),
  ]);

  // A manager who opens a partner address goes to the console instead of a dead end.
  if (profile?.role === "manager") {
    redirect(CONSOLE_HOME);
  }
  const access = partnersAccess(profile?.role);
  return {
    supabase,
    userId,
    access: access === "partner" && member ? ("partner" as const) : ("forbidden" as const),
    displayName: profile?.display_name ?? "",
    partnerId: member?.partner_id ?? "",
    companyName: member?.partners.company_name ?? "",
  };
});
