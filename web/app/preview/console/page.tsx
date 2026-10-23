import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "../../../src/components/button";
import {
  ConsoleMobileNav,
  ConsoleSidebar,
  type NavGroup,
} from "../../../src/components/console-sidebar";
import { DataTable, type Column } from "../../../src/components/data-table";
import { EmptyState } from "../../../src/components/empty-state";
import { FilterTabs } from "../../../src/components/filter-tabs";
import { IconButton } from "../../../src/components/icon-button";
import { Icon, IconTile, type IconName } from "../../../src/components/icons";
import { InlineAlert } from "../../../src/components/inline-alert";
import type { RiskLevel } from "../../../src/components/risk";
import { RiskBadge } from "../../../src/components/risk-badge";
import { RiskBar } from "../../../src/components/risk-bar";
import { SearchField } from "../../../src/components/search-field";
import { Sparkline } from "../../../src/components/sparkline";
import { StatStrip } from "../../../src/components/stat-strip";
import { requirePreviewEnabled } from "../guard";

export const metadata: Metadata = { title: "시안: 콘솔 개요 | 들림" };

// Synthetic example values for the preview only. Every workstation has 5 or more workers.
type WorkstationRow = {
  name: string;
  category: string;
  icon: IconName;
  code: string;
  surveyedOn: string;
  workers: number;
  highRiskRatio: number;
  level: RiskLevel;
  reports: number;
  /** High-risk posture share (%) for the last 7 days, oldest first. */
  trend: number[];
};

const WORKSTATIONS: WorkstationRow[] = [
  {
    name: "용접 3번 작업대",
    category: "용접",
    icon: "welding",
    code: "WLD-03",
    surveyedOn: "10월 28일",
    workers: 6,
    highRiskRatio: 0.58,
    level: "very-high",
    reports: 7,
    trend: [44, 47, 50, 49, 53, 55, 58],
  },
  {
    name: "프레스 2라인",
    category: "프레스",
    icon: "press",
    code: "PRS-02",
    surveyedOn: "10월 21일",
    workers: 12,
    highRiskRatio: 0.42,
    level: "high",
    reports: 5,
    trend: [38, 40, 39, 41, 40, 43, 42],
  },
  {
    name: "도장 부스 A",
    category: "도장",
    icon: "painting",
    code: "PNT-A1",
    surveyedOn: "10월 14일",
    workers: 8,
    highRiskRatio: 0.31,
    level: "high",
    reports: 3,
    trend: [35, 34, 33, 33, 32, 31, 31],
  },
  {
    name: "조립 1라인",
    category: "조립",
    icon: "assembly",
    code: "ASM-01",
    surveyedOn: "10월 9일",
    workers: 15,
    highRiskRatio: 0.12,
    level: "caution",
    reports: 4,
    trend: [14, 13, 13, 12, 12, 12, 12],
  },
  {
    name: "자재 입고장",
    category: "물류",
    icon: "logistics",
    code: "LOG-01",
    surveyedOn: "9월 30일",
    workers: 9,
    highRiskRatio: 0.18,
    level: "caution",
    reports: 2,
    trend: [20, 22, 19, 18, 19, 18, 18],
  },
  {
    name: "포장 라인",
    category: "포장",
    icon: "packaging",
    code: "PKG-01",
    surveyedOn: "9월 23일",
    workers: 7,
    highRiskRatio: 0.06,
    level: "low",
    reports: 0,
    trend: [8, 7, 7, 6, 6, 6, 6],
  },
];

const NAV_GROUPS: NavGroup[] = [
  { items: [{ label: "개요", icon: "overview", href: "/preview/console", current: true }] },
  {
    title: "조사",
    items: [
      { label: "수시 조사", icon: "survey" },
      { label: "공정", icon: "workstation" },
      { label: "통증 신고", icon: "message" },
    ],
  },
  {
    title: "관리",
    items: [
      { label: "보고서", icon: "report" },
      { label: "QR 관리", icon: "qr" },
    ],
  },
];

const COLUMNS: Column<WorkstationRow>[] = [
  {
    key: "name",
    header: "공정",
    render: (row) => (
      <div className="flex items-center gap-2">
        <IconTile name={row.icon} />
        <div className="flex flex-col">
          <span className="flex items-center gap-1">
            <span className="font-medium">{row.name}</span>
            <span className="rounded-control border border-border px-1 text-caption text-text-secondary">
              {row.category}
            </span>
          </span>
          <span className="text-caption text-text-secondary tabular-nums">
            <span className="font-mono">{row.code}</span> · 조사 {row.surveyedOn}
          </span>
        </div>
      </div>
    ),
  },
  { key: "workers", header: "인원", numeric: true, render: (row) => row.workers },
  {
    key: "ratio",
    header: "고위험 자세 비율",
    render: (row) => (
      <RiskBar
        ratio={row.highRiskRatio}
        level={row.level}
        mode="console"
        label={`${row.name} 고위험 자세 비율`}
      />
    ),
  },
  { key: "level", header: "단계", render: (row) => <RiskBadge level={row.level} mode="console" /> },
  { key: "reports", header: "이번 주 신고", numeric: true, render: (row) => row.reports },
  {
    key: "trend",
    header: "7일 추이",
    render: (row) => (
      <Sparkline
        values={row.trend}
        level={row.level}
        mode="console"
        domain={[0, 100]}
        label={`${row.name} 최근 7일 고위험 자세 비율 ${row.trend[0]}%에서 ${row.trend[row.trend.length - 1]}%`}
      />
    ),
  },
  {
    key: "more",
    header: "더보기",
    hiddenHeader: true,
    render: (row) => <IconButton icon="more" label={`${row.name} 더보기`} />,
  },
];

const LEVEL_TABS = [
  { label: "전체", count: 6, selected: true },
  { label: "매우 높음", count: 1 },
  { label: "높음", count: 2 },
  { label: "주의", count: 2 },
  { label: "낮음", count: 1 },
];

export default function ConsoleOverviewPreview() {
  requirePreviewEnabled();
  return (
    <div className="flex min-h-screen">
      <ConsoleSidebar
        groups={NAV_GROUPS}
        status={{
          title: "조사 현황",
          lines: [
            <>
              다음 정기조사 <span className="font-mono tabular-nums">D-23</span>
            </>,
            <>
              QR <span className="font-mono tabular-nums">12 / 12</span> 활성
            </>,
          ],
        }}
        user={{ name: "김들림", role: "안전보건관리자" }}
      />
      <main className="flex min-w-0 flex-1 flex-col gap-3 bg-surface px-3 py-2 lg:px-4">
        <ConsoleMobileNav groups={NAV_GROUPS} />
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <span className="text-body font-medium">제1공장</span>
            <Button variant="secondary" iconAfter="chevron-down">
              사업장 바꾸기
            </Button>
          </div>
          <p className="flex items-center gap-1 text-small text-text-secondary">
            <Icon name="refresh" size={16} />
            마지막 갱신 오늘 <span className="font-mono tabular-nums">09:40</span>
          </p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <p className="text-caption text-text-secondary">제1공장 · 자세 부담 현황</p>
            <h1 className="text-title font-bold">개요</h1>
          </div>
          <Button variant="secondary" iconBefore="document">
            보고서 초안 만들기
          </Button>
        </div>

        <StatStrip
          stats={[
            {
              icon: "clock",
              label: "하루 고위험 노출",
              value: "38",
              unit: "사람 · 시간",
              helper: "지난주 42",
            },
            { icon: "alert", label: "매우 높음 공정", value: "1", helper: "용접 3번 작업대" },
            {
              icon: "survey",
              label: "진행 중 수시 조사",
              value: "2",
              helper: "가장 빠른 기한 11월 14일",
            },
            {
              icon: "message",
              label: "이번 주 통증 신고",
              value: "21",
              helper: "5개 공정에서 접수",
            },
          ]}
        />

        <InlineAlert
          tone="deadline"
          action={
            <Link
              href="/preview/console?survey=weld-3"
              className="flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              조사 보기
              <Icon name="arrow-right" size={16} />
            </Link>
          }
        >
          용접 3번 작업대 수시 조사 기한이 11월 14일입니다 (제2호 새로운 작업·설비 도입으로 시작).
        </InlineAlert>

        <InlineAlert tone="caution">
          수시 조사 검토 권고: 물류 묶음. 최근 4주 &lsquo;중간&rsquo; 이상 통증 신고가 3건
          이상이에요. 통증 신고 누적은 제657조 제2항의 사유가 아니니, 사유에 해당하는 일이 있었는지
          확인해 주세요.
        </InlineAlert>

        <section aria-labelledby="workstations-title" className="flex flex-col gap-2">
          <h2 id="workstations-title" className="text-title-sm font-bold">
            공정별 현황
          </h2>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FilterTabs label="위험 단계로 거르기" tabs={LEVEL_TABS} />
            <SearchField id="workstation-search" label="공정 검색" placeholder="이름 또는 코드" />
          </div>
          <DataTable
            caption="공정별 인원, 고위험 자세 비율, 위험 단계, 이번 주 통증 신고, 7일 추이"
            columns={COLUMNS}
            rows={WORKSTATIONS}
            rowKey={(row) => row.code}
          />
        </section>

        <section aria-labelledby="packing-reports-title" className="flex flex-col gap-2">
          <h2 id="packing-reports-title" className="text-title-sm font-bold">
            포장 라인 · 이번 주 통증 신고
          </h2>
          <EmptyState
            icon="inbox"
            title="이번 주에 들어온 신고가 없어요"
            description="신고가 들어오면 공정 단위로 모아 이곳에 보여 드려요."
          />
        </section>
      </main>
    </div>
  );
}
