import type { Metadata } from "next";
import { WorkerFlow } from "../../src/features/worker-flow/worker-flow";

export const metadata: Metadata = {
  title: "들림",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Worker entry from a QR code: https://<site>/w#<token> (docs/auth.md). */
export default function WorkerPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-60 flex-col bg-surface">
      <WorkerFlow />
    </div>
  );
}
