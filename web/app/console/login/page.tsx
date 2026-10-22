import type { Metadata } from "next";
import { LoginForm } from "../../../src/features/console-auth/login-form";
import { safeConsolePath } from "../../../src/features/console-auth/rules";

export const metadata: Metadata = {
  title: "로그인 · 들림 콘솔",
  robots: { index: false, follow: false },
};

type LoginPageProps = { searchParams: Promise<{ next?: string | string[] }> };

/** Console sign-in. There is no sign-up: operators create manager accounts (docs/auth.md). */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const nextPath = safeConsolePath(typeof next === "string" ? next : undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-2 py-4">
      <div className="flex w-full max-w-50 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-small font-bold text-nav">들림 콘솔</p>
          <h1 className="text-title font-bold">로그인</h1>
        </div>
        <LoginForm next={nextPath} />
        <p className="text-caption text-text-secondary">
          계정은 운영 담당자가 만들어 드려요. 로그인이 안 되면 운영 담당자에게 문의해 주세요.
        </p>
      </div>
    </main>
  );
}
