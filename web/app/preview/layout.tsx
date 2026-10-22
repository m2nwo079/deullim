import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requirePreviewEnabled } from "./guard";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: ReactNode }) {
  requirePreviewEnabled();
  return children;
}
