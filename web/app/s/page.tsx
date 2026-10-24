import type { Metadata } from "next";
import { SimulationFlow } from "../../src/features/simulation/simulation-flow";

export const metadata: Metadata = {
  title: "들림 시연 촬영",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Simulation capture from a one-time console QR: https://<site>/s#<token> (docs/auth.md). */
export default function SimulationPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-60 flex-col bg-surface">
      <SimulationFlow />
    </div>
  );
}
