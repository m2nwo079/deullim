import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Button } from "../../../src/components/button";
import { InlineAlert } from "../../../src/components/inline-alert";
import { signOutPartner } from "../../../src/features/console-auth/actions";
import { getPartnerSession } from "../../../src/features/partners/session";

export const metadata: Metadata = {
  title: "들림 파트너스",
  robots: { index: false, follow: false },
};

function SignOutButton() {
  return (
    <form action={signOutPartner}>
      <Button type="submit" variant="secondary">
        로그아웃
      </Button>
    </form>
  );
}

/** Signed-in 들림 파트너스 shell. Only partner profiles see it; managers get a notice too. */
export default async function SignedInPartnersLayout({ children }: { children: ReactNode }) {
  const session = await getPartnerSession();

  if (session.access !== "partner") {
    return (
      <main className="mx-auto flex min-h-screen max-w-50 flex-col justify-center gap-3 bg-surface px-2 py-4">
        <InlineAlert tone="error">
          이 계정으로는 들림 파트너스에 들어올 수 없어요. 설비 업체 계정으로 로그인해 주세요.
        </InlineAlert>
        <SignOutButton />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-console items-center justify-between gap-2 px-3 py-1">
          <p className="text-title-sm font-bold text-nav">들림 파트너스</p>
          <div className="flex items-center gap-2">
            <p className="text-small text-text-secondary">{session.companyName}</p>
            <SignOutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
