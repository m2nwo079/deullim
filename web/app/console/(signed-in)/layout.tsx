import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Button } from "../../../src/components/button";
import { InlineAlert } from "../../../src/components/inline-alert";
import { signOut } from "../../../src/features/console-auth/actions";
import { getConsoleSession } from "../../../src/features/console-auth/session";

export const metadata: Metadata = {
  title: "들림 콘솔",
  robots: { index: false, follow: false },
};

function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="secondary">
        로그아웃
      </Button>
    </form>
  );
}

/** Signed-in console shell. Only manager profiles see the console; others get a notice. */
export default async function SignedInConsoleLayout({ children }: { children: ReactNode }) {
  const session = await getConsoleSession();

  if (session.access !== "manager") {
    return (
      <main className="mx-auto flex min-h-screen max-w-50 flex-col justify-center gap-3 bg-surface px-2 py-4">
        <InlineAlert tone="error">
          이 계정으로는 들림 콘솔에 들어올 수 없어요. 안전보건관리자 계정으로 로그인해 주세요.
        </InlineAlert>
        <SignOutButton />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-border print:hidden">
        <div className="mx-auto flex w-full max-w-console items-center justify-between gap-2 px-3 py-1">
          <p className="text-title-sm font-bold text-nav">들림 콘솔</p>
          <div className="flex items-center gap-2">
            <p className="text-small text-text-secondary">{session.displayName}</p>
            <SignOutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
