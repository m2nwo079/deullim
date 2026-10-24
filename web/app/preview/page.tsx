import type { Metadata } from "next";
import Link from "next/link";
import { requirePreviewEnabled } from "./guard";

export const metadata: Metadata = { title: "시안 목록 | 들림" };

const SCREENS = [
  { href: "/preview/console", label: "관리자 콘솔 개요" },
  { href: "/preview/components", label: "공통 컴포넌트" },
  { href: "/preview/console-nav", label: "콘솔 이동 (사이드바, 서랍, 경로)" },
  { href: "/preview/worker/result", label: "작업자 촬영 결과" },
  { href: "/preview/worker/pain", label: "작업자 통증 신고" },
  { href: "/preview/worker/done", label: "작업자 신고 완료" },
];

export default function PreviewIndexPage() {
  requirePreviewEnabled();
  return (
    <main className="mx-auto flex max-w-80 flex-col gap-2 p-3">
      <h1 className="text-title font-bold">시안 목록</h1>
      <p className="text-body text-text-secondary">
        합성 예시 값으로 만든 화면이에요. 운영 주소에서는 열리지 않아요.
      </p>
      <ul className="divide-y divide-border rounded-surface border border-border bg-surface">
        {SCREENS.map((screen) => (
          <li key={screen.href}>
            <Link
              href={screen.href}
              className="flex h-6 items-center px-2 text-body text-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              {screen.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
