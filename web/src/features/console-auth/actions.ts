"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { formText, LOGIN, signedInPath, signInErrorKind, type SignInError } from "./rules";

export type SignInState = { error?: SignInError; email?: string };

/** One sign-in for managers and partners: the role decides between /console and /partners. */
export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = formText(formData, "email").trim();
  const password = formText(formData, "password");
  if (!email || !password) {
    return { error: "credentials", email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: signInErrorKind(error.status), email };
  }

  // Check the role right after sign-in; accounts without a known role are signed out.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle<{ role: string }>();
  const next = signedInPath(profile?.role, formText(formData, "next"));
  if (!next) {
    await supabase.auth.signOut();
    return { error: "forbidden", email };
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN);
}
