"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import {
  CONSOLE_LOGIN,
  consoleAccess,
  formText,
  safeConsolePath,
  signInErrorKind,
  type SignInError,
} from "./rules";

export type SignInState = { error?: SignInError; email?: string };

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = formText(formData, "email").trim();
  const password = formText(formData, "password");
  const next = safeConsolePath(formText(formData, "next"));
  if (!email || !password) {
    return { error: "credentials", email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: signInErrorKind(error.status), email };
  }

  // Check the role right after sign-in; non-managers are signed out before any console page loads.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle<{ role: string }>();
  if (consoleAccess(profile?.role) !== "manager") {
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
