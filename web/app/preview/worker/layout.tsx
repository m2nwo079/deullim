import type { ReactNode } from "react";

/** Mobile-width column for worker screens. */
export default function WorkerPreviewLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-screen max-w-60 flex-col bg-surface">{children}</div>;
}
