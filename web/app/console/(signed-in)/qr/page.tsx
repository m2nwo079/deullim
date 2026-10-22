import { daysUntil } from "../../../../src/lib/entry-token";
import { getConsoleSession } from "../../../../src/features/console-auth/session";
import { TokenManager, type TokenRow } from "../../../../src/features/entry-tokens/token-manager";

const DATE = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

type Workstation = { id: string; name: string; code: string | null };
type ActiveToken = { id: string; workstation_id: string; expires_at: string };

/** QR tokens per workstation of the manager's sites. Token hashes are never selected. */
export default async function QrPage() {
  // Checked here as well as in the layout, because Next.js renders both in parallel.
  const session = await getConsoleSession();
  if (session.access !== "manager") {
    return null;
  }

  const [{ data: workstations }, { data: tokens }] = await Promise.all([
    session.supabase
      .from("workstations")
      .select("id, name, code")
      .order("name")
      .returns<Workstation[]>(),
    session.supabase
      .from("entry_tokens")
      .select("id, workstation_id, expires_at")
      .eq("active", true)
      .returns<ActiveToken[]>(),
  ]);

  const now = new Date();
  const byWorkstation = new Map((tokens ?? []).map((token) => [token.workstation_id, token]));
  const rows: TokenRow[] = (workstations ?? []).map((workstation) => {
    const token = byWorkstation.get(workstation.id);
    if (!token) {
      return {
        workstationId: workstation.id,
        name: workstation.name,
        code: workstation.code,
        tokenId: null,
        status: "none",
        daysLeft: null,
        expiresOn: null,
      };
    }
    const expiresAt = new Date(token.expires_at);
    return {
      workstationId: workstation.id,
      name: workstation.name,
      code: workstation.code,
      tokenId: token.id,
      status: expiresAt > now ? "active" : "expired",
      daysLeft: daysUntil(expiresAt, now),
      expiresOn: DATE.format(expiresAt),
    };
  });

  return (
    <main className="flex flex-col gap-3 px-3 py-3 print:p-0">
      <div className="flex flex-col gap-1 print:hidden">
        <h1 className="text-title font-bold">QR 관리</h1>
        <p className="text-small text-text-secondary">
          공정마다 QR을 하나씩 발급해요. QR은 발급한 직후에만 볼 수 있어요.
        </p>
      </div>
      <TokenManager rows={rows} />
    </main>
  );
}
