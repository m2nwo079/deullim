"use client";

import { useState, type ReactNode } from "react";
import { Breadcrumb } from "../../../src/components/breadcrumb";
import { Button } from "../../../src/components/button";
import { ChoiceChipGrid } from "../../../src/components/choice-chip-grid";
import { DataTable, type Column } from "../../../src/components/data-table";
import { DateField } from "../../../src/components/date-field";
import { Popover } from "../../../src/components/popover";
import { ProgressIndicator } from "../../../src/components/progress-indicator";
import { SegmentedControl } from "../../../src/components/segmented-control";
import { Select } from "../../../src/components/select";
import { TextArea } from "../../../src/components/text-area";
import { TextLink } from "../../../src/components/text-link";
import { WorkerTopBar } from "../../../src/components/worker-top-bar";

// Synthetic example values for the preview only. Company names carry "(가상)".
type QuoteRow = {
  id: string;
  company: string;
  price: number;
  days: number;
  status: "submitted" | "withdrawn";
};

const QUOTES: QuoteRow[] = [
  { id: "q1", company: "가람설비(가상)", price: 4_500_000, days: 14, status: "submitted" },
  { id: "q2", company: "누리기계(가상)", price: 5_200_000, days: 10, status: "submitted" },
  { id: "q3", company: "다솜엔지니어링(가상)", price: 4_900_000, days: 21, status: "withdrawn" },
];

const won = (price: number) => `${(price / 10_000).toLocaleString("ko-KR")}만 원`;

const SITES = [
  { value: "site-1", label: "제1공장" },
  { value: "site-2", label: "제2공장" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3">
      <h2 className="text-title-sm font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function ComponentsDemo({ today, lastDay }: { today: string; lastDay: string }) {
  const [quote, setQuote] = useState<string | null>(null);
  const [site, setSite] = useState(SITES[0].value);
  const [log, setLog] = useState("아직 누른 것이 없어요.");
  const [progressRun, setProgressRun] = useState(0);
  const picked = QUOTES.find((row) => row.id === quote);

  const columns: Column<QuoteRow>[] = [
    { key: "company", header: "업체", render: (row) => row.company },
    { key: "price", header: "금액", numeric: true, render: (row) => won(row.price) },
    { key: "days", header: "기간", numeric: true, render: (row) => `${row.days}일` },
    {
      key: "status",
      header: "상태",
      render: (row) => (row.status === "submitted" ? "제출" : "철회"),
    },
    {
      key: "detail",
      header: "견적서",
      render: (row) => (
        <TextLink href={`/preview/components?quote=${row.id}`}>견적서 보기</TextLink>
      ),
    },
    {
      key: "more",
      header: "더보기",
      action: true,
      render: (row) => (
        <Popover label={`${row.company} 더보기`}>
          <Button variant="secondary" onClick={() => setLog(`${row.company}: 업체에 문의`)}>
            업체에 문의
          </Button>
          <Button variant="secondary" onClick={() => setLog(`${row.company}: 견적 복사`)}>
            견적 복사
          </Button>
        </Popover>
      ),
    },
  ];

  return (
    <main className="mx-auto flex max-w-console-form flex-col gap-3 px-2 py-4">
      <Breadcrumb items={[{ label: "시안 목록", href: "/preview" }, { label: "공통 컴포넌트" }]} />
      <h1 className="text-title font-bold">공통 컴포넌트</h1>
      <p className="text-body text-text-secondary">
        합성 예시 값으로 만든 화면이에요. 마지막으로 누른 것: {log}
      </p>

      <Section title="SegmentedControl">
        <SegmentedControl
          name="seg-worker"
          legend="작업자 크기"
          options={["약함", "중간", "심함"]}
          defaultValue="중간"
        />
        <SegmentedControl
          name="seg-console"
          legend="콘솔 크기, 한 줄에 하나"
          size="console"
          orientation="vertical"
          options={["새로운 작업 · 설비 도입", "근골격계 질환자 발생"]}
        />
        <SegmentedControl
          name="seg-disabled"
          legend="비활성"
          options={["예", "아니요"]}
          defaultValue="예"
          disabled
        />
        <ChoiceChipGrid
          name="chips"
          legend="ChoiceChipGrid (체크박스 목록)"
          options={["목", "어깨", "허리"]}
        />
      </Section>

      <Section title="DateField">
        <DateField id="past" label="과거 날짜 (오늘까지)" max={today} />
        <DateField
          id="future"
          label="미래 날짜 (오늘부터 2년 뒤까지)"
          min={today}
          max={lastDay}
          today={today}
        />
      </Section>

      <Section title="TextArea">
        <TextArea id="area" label="설명 (선택, 1000자 이하)" />
        <TextArea
          id="area-error"
          label="메모 (선택, 500자 이하)"
          error="메모는 500자 이하로 적어 주세요."
        />
      </Section>

      <Section title="Select, TextLink">
        <Select id="site" label="사업장" options={SITES} value={site} onValueChange={setSite} />
        <p className="text-body">고른 값: {site}</p>
        <div className="flex flex-wrap gap-3">
          <TextLink href="/preview">시안 목록</TextLink>
          <TextLink href="/preview/console-nav" iconAfter="arrow-right">
            콘솔 이동 시안
          </TextLink>
        </div>
      </Section>

      <Section title="DataTable 선택 열, Popover">
        <DataTable
          caption="견적 비교"
          columns={columns}
          rows={QUOTES}
          rowKey={(row) => row.id}
          selection={{
            name: "quote",
            legend: "수락할 견적 고르기",
            value: (row) => row.id,
            label: (row) => `${row.company} · ${won(row.price)} · ${row.days}일`,
            selectable: (row) => row.status === "submitted",
            selected: quote,
            onSelect: setQuote,
          }}
        />
        <div className="flex flex-col gap-1">
          <div>
            <Button disabled={!picked} onClick={() => setLog(`${picked?.company} 수락 (시안)`)}>
              선택한 견적 수락
            </Button>
          </div>
          <p className="text-small text-text-secondary">
            {picked ? `고른 견적: ${picked.company}` : "견적을 하나 고르면 수락할 수 있어요."}
          </p>
        </div>
      </Section>

      <Section title="ProgressIndicator">
        <div className="grid gap-3 sm:grid-cols-2">
          <ProgressIndicator key={`w-${progressRun}`} label="결과를 계산하고 있어요." />
          <ProgressIndicator key={`c-${progressRun}`} label="불러오고 있어요." size="console" />
        </div>
        <div>
          <Button variant="secondary" onClick={() => setProgressRun((run) => run + 1)}>
            처음부터 다시 (15초)
          </Button>
        </div>
      </Section>

      <Section title="WorkerTopBar">
        <div className="max-w-60 rounded-surface border border-border bg-surface">
          <WorkerTopBar title="용접 3번 작업대" />
        </div>
        <div className="max-w-60 rounded-surface border border-border bg-surface">
          <WorkerTopBar
            title="용접 3번 작업대 · 아주 긴 공정 이름이 들어가면 잘려요"
            onBack={() => setLog("WorkerTopBar 뒤로")}
          />
        </div>
      </Section>
    </main>
  );
}
