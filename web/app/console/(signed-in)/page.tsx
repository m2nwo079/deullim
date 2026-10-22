import { ButtonLink } from "../../../src/components/button";
import { getConsoleSession } from "../../../src/features/console-auth/session";

/** Minimal signed-in screen for checking login. The full overview replaces it later. */
export default async function ConsolePage() {
  // Checked here as well as in the layout, because Next.js renders both in parallel.
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return null;
  }

  // RLS returns only the sites this manager belongs to.
  const { data: sites } = await session.supabase
    .from("sites")
    .select("name")
    .order("name")
    .returns<{ name: string }[]>();
  const siteNames = (sites ?? []).map((site) => site.name).join(" · ");

  return (
    <main className="flex flex-col gap-1 px-3 py-3">
      <p className="text-small text-text-secondary">{siteNames || "연결된 사업장이 없어요."}</p>
      <h1 className="text-title font-bold">개요</h1>
      <div className="pt-2">
        <ButtonLink href="/console/qr" variant="secondary" iconBefore="qr">
          QR 관리
        </ButtonLink>
      </div>
    </main>
  );
}
