import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageFooter } from "../../src/components/page-footer";
import { LoginForm } from "../../src/features/console-auth/login-form";
import { signedInPath } from "../../src/features/console-auth/rules";
import { createClient } from "../../src/lib/supabase/server";

export const metadata: Metadata = {
  title: "로그인 · 들림",
  robots: { index: false, follow: false },
};

type LoginPageProps = { searchParams: Promise<{ next?: string | string[] }> };

/**
 * One sign-in for managers and partners; the role decides where to go (docs/auth.md). There is
 * no sign-up: operators create the accounts. A signed-in account with a known role skips the form.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const nextParam = typeof next === "string" ? next : "";

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle<{ role: string }>();
    const target = signedInPath(profile?.role, nextParam);
    if (target) {
      redirect(target);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <main className="flex flex-1 items-center justify-center px-2 py-4">
        <div className="flex w-full max-w-50 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Link
              href="/"
              className="self-start rounded-control text-small font-bold text-nav underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              들림
            </Link>
            <h1 className="text-title font-bold">로그인</h1>
          </div>
          <LoginForm next={nextParam} />
          <p className="text-caption text-text-secondary">
            계정은 운영 담당자가 만들어 드려요. 로그인이 안 되면 운영 담당자에게 문의해 주세요.
          </p>
        </div>
      </main>
      <PageFooter />
    </div>
  );
}
