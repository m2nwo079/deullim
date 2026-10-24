import type { Metadata } from "next";
import { Breadcrumb } from "../../../src/components/breadcrumb";
import {
  ConsoleDrawer,
  ConsoleSidebar,
  type NavGroup,
} from "../../../src/components/console-sidebar";
import { Select } from "../../../src/components/select";
import { TextLink } from "../../../src/components/text-link";
import { requirePreviewEnabled } from "../guard";

export const metadata: Metadata = { title: "시안: 콘솔 이동 | 들림" };

// Synthetic example values for the preview only. Every link stays on this page.
const HERE = "/preview/console-nav";

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "개요", icon: "overview", href: `${HERE}?at=overview` },
      { label: "공정 · 개선안", icon: "tool", href: HERE, current: true },
      { label: "견적 요청", icon: "inbox", href: `${HERE}?at=requests` },
      { label: "개선 계획", icon: "report", href: `${HERE}?at=plans` },
      { label: "수시 조사", icon: "survey", href: `${HERE}?at=surveys` },
      { label: "보고서 초안", icon: "document", href: `${HERE}?at=report` },
      { label: "QR 관리", icon: "qr", href: `${HERE}?at=qr` },
    ],
  },
];

const SITES = [
  { value: "site-1", label: "제1공장" },
  { value: "site-2", label: "제2공장" },
];

export default function ConsoleNavPreview() {
  requirePreviewEnabled();
  return (
    <div className="flex min-h-screen bg-surface">
      <ConsoleSidebar
        groups={NAV_GROUPS}
        status={{ title: "조사 현황", lines: ["시안 화면이에요."] }}
        user={{ name: "김들림", role: "안전보건관리자" }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-border px-2 py-1">
          <div className="flex items-center gap-1">
            <ConsoleDrawer
              groups={NAV_GROUPS}
              top={
                <div className="px-2 sm:hidden">
                  <Select id="site-drawer" label="사업장" options={SITES} defaultValue="site-1" />
                </div>
              }
            />
            <p className="text-title-sm font-bold text-nav lg:hidden">들림 콘솔</p>
          </div>
          <div className="hidden w-30 sm:block">
            <Select id="site-header" label="사업장" options={SITES} defaultValue="site-1" />
          </div>
        </header>
        <main className="flex flex-col gap-2 px-3 py-2">
          <Breadcrumb
            items={[
              { label: "공정 · 개선안", href: HERE },
              { label: "조립 A라인", href: `${HERE}?at=workstation` },
              { label: "개선안 수정" },
            ]}
          />
          <h1 className="text-title font-bold">개선안 수정</h1>
          <p className="text-body text-text-secondary">
            창 폭을 1024px보다 좁히면 사이드바가 메뉴 버튼으로, 640px보다 좁히면 사업장 선택이 서랍
            안으로 옮겨 가요.
          </p>
          <div>
            <TextLink href="/preview/components" iconAfter="arrow-right">
              공통 컴포넌트 시안
            </TextLink>
          </div>
        </main>
      </div>
    </div>
  );
}
