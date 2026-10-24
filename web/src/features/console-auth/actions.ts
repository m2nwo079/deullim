"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import {
  CONSOLE_LOGIN,
  consoleAccess,
  formText,
  PARTNERS_LOGIN,
  partnersAccess,
  safeConsolePath,
  safePartnersPath,
  signInErrorKind,
  type SignInError,
} from "./rules";

export type SignInState = { error?: SignInError; email?: string };

/** The console takes manager accounts only, 들림 파트너스 partner accounts only. */
const AREAS = {
  console: {
    safePath: safeConsolePath,
    allowed: (role: string | undefined) => consoleAccess(role) === "manager",
  },
  partners: {
    safePath: safePartnersPath,
    allowed: (role: string | undefined) => partnersAccess(role) === "partner",
  },
};

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  return signInTo("console", formData);
}

export async function signInPartner(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  return signInTo("partners", formData);
}

async function signInTo(area: keyof typeof AREAS, formData: FormData): Promise<SignInState> {
  const email = formText(formData, "email").trim();
  const password = formText(formData, "password");
  const next = AREAS[area].safePath(formText(formData, "next"));
  if (!email || !password) {
    return { error: "credentials", email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: signInErrorKind(error.status), email };
  }

  // Check the role right after sign-in; other roles are signed out before any page loads.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle<{ role: string }>();
  if (!AREAS[area].allowed(profile?.role)) {
    await supabase.auth.signOut();
    return { error: "forbidden", email };
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(CONSOLE_LOGIN);
}

export async function signOutPartner() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(PARTNERS_LOGIN);
}
