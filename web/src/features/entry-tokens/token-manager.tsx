"use client";

import { useState, useTransition } from "react";
import { Button } from "../../components/button";
import { Popover, PopoverDivider, PopoverItem } from "../../components/popover";
import { DataTable, type Column } from "../../components/data-table";
import { EmptyState } from "../../components/empty-state";
import { InlineAlert } from "../../components/inline-alert";
import { Modal } from "../../components/modal";
import { QrCode } from "../../components/qr-code";
import { deactivateToken, extendToken, issueToken, type TokenResult } from "./actions";

export type TokenRow = {
  workstationId: string;
  name: string;
  code: string | null;
  /** The active token, or null when the workstation has none. */
  tokenId: string | null;
  status: "active" | "expired" | "none";
  daysLeft: number | null;
  expiresOn: string | null;
};

type Issued = { siteName: string; workstationName: string; matrix: boolean[][] };
type Confirm = { kind: "reissue" | "deactivate"; row: TokenRow } | null;

const STATUS_LABEL: Record<TokenRow["status"], string> = {
  active: "활성",
  expired: "만료됨",
  none: "발급 전",
};

/**
 * QR token list with issue, reissue, extend and deactivate.
 * A newly issued QR lives only in this component's memory: leaving or reloading the page loses it.
 */
export function TokenManager({ rows }: { rows: TokenRow[] }) {
  const [issued, setIssued] = useState<Issued | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(key: string, action: () => Promise<TokenResult | { ok: false; message: string }>) {
    setError(null);
    setPendingKey(key);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
      }
      setPendingKey(null);
      setConfirm(null);
    });
  }

  function issue(row: TokenRow) {
    setError(null);
    setPendingKey(`issue-${row.workstationId}`);
    startTransition(async () => {
      const result = await issueToken(row.workstationId);
      if (result.ok) {
        setIssued({
          siteName: result.siteName,
          workstationName: result.workstationName,
          matrix: result.matrix,
        });
      } else {
        setError(result.message);
      }
      setPendingKey(null);
      setConfirm(null);
    });
  }

  const busy = pendingKey !== null;

  const columns: Column<TokenRow>[] = [
    {
      key: "workstation",
      header: "공정",
      render: (row) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.name}</span>
          {row.code ? (
            <span className="font-mono text-caption text-text-secondary">{row.code}</span>
          ) : null}
        </span>
      ),
    },
    { key: "status", header: "상태", render: (row) => STATUS_LABEL[row.status] },
    {
      key: "expiry",
      header: "남은 기간",
      render: (row) =>
        row.status === "none" ? (
          <span className="text-text-secondary">-</span>
        ) : (
          <span>
            {row.status === "active" ? (
              <span className="font-mono tabular-nums">D-{row.daysLeft}</span>
            ) : (
              "만료"
            )}
            <span className="text-text-secondary"> · {row.expiresOn}</span>
          </span>
        ),
    },
    {
      key: "actions",
      header: "동작",
      action: true,
      render: (row) => (
        <>
          {row.tokenId === null ? (
            <Button
              variant="text"
              iconBefore="qr"
              loading={pendingKey === `issue-${row.workstationId}`}
              disabled={busy}
              onClick={() => issue(row)}
            >
              발급
            </Button>
          ) : (
            <>
              <Button
                variant="text"
                iconBefore="refresh"
                loading={pendingKey === `extend-${row.tokenId}`}
                disabled={busy}
                onClick={() => {
                  const tokenId = row.tokenId as string;
                  run(`extend-${tokenId}`, () => extendToken(tokenId));
                }}
              >
                기간 연장
              </Button>
              {/* Less frequent and irreversible entries; the confirm dialog sits outside the menu. */}
              <Popover label={`${row.name} QR 더보기`}>
                <PopoverItem disabled={busy} onClick={() => setConfirm({ kind: "reissue", row })}>
                  재발급
                </PopoverItem>
                <PopoverDivider />
                <PopoverItem
                  disabled={busy}
                  onClick={() => setConfirm({ kind: "deactivate", row })}
                >
                  비활성화
                </PopoverItem>
              </Popover>
            </>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <div className="print:hidden">
          <InlineAlert tone="error">{error}</InlineAlert>
        </div>
      ) : null}

      {issued ? (
        <section aria-labelledby="issued-title" className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 print:hidden">
            <h2 id="issued-title" className="text-title-sm font-bold">
              QR을 발급했어요
            </h2>
            <InlineAlert tone="caution">
              이 화면을 벗어나면 QR을 다시 볼 수 없어요. 잃어버리면 재발급해 주세요.
            </InlineAlert>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-surface border border-border bg-surface p-4 print:border-0 print:p-6">
            <div className="flex flex-col items-center">
              <p className="text-small text-text-secondary">{issued.siteName}</p>
              <p className="text-title font-bold">{issued.workstationName}</p>
            </div>
            <QrCode
              matrix={issued.matrix}
              label={`${issued.workstationName} 들림 QR`}
              className="size-30 print:size-60"
            />
            <p className="text-center text-body">
              휴대폰 카메라로 찍어 자세를 확인하고 아픈 곳을 알려 주세요.
            </p>
            <p className="text-center text-body text-text-secondary">이름은 남지 않아요.</p>
          </div>
          <div className="flex gap-1 print:hidden">
            <Button iconBefore="document" onClick={() => window.print()}>
              인쇄하기
            </Button>
            <Button variant="secondary" onClick={() => setIssued(null)}>
              닫기
            </Button>
          </div>
        </section>
      ) : null}

      <div className="print:hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon="workstation"
            title="등록된 공정이 없어요"
            description="공정을 등록하면 이곳에서 QR을 발급할 수 있어요."
          />
        ) : (
          <DataTable
            caption="공정별 QR 상태"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.workstationId}
          />
        )}
      </div>

      <Modal
        open={confirm !== null}
        title={confirm?.kind === "reissue" ? "QR을 재발급할까요?" : "QR을 비활성화할까요?"}
        onClose={() => setConfirm(null)}
        actions={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>
              취소
            </Button>
            <Button
              loading={busy}
              onClick={() => {
                if (!confirm) {
                  return;
                }
                const { row } = confirm;
                if (confirm.kind === "reissue") {
                  issue(row);
                } else {
                  const tokenId = row.tokenId as string;
                  run(`deactivate-${tokenId}`, () => deactivateToken(tokenId));
                }
              }}
            >
              {`‘${confirm?.row.name ?? ""}’ QR ${confirm?.kind === "reissue" ? "재발급" : "비활성화"}`}
            </Button>
          </>
        }
      >
        {confirm?.kind === "reissue" ? (
          <p>
            {confirm.row.name}에 붙여 둔 QR은 바로 쓸 수 없게 돼요. 새 QR을 인쇄해 바꿔 붙여 주세요.
          </p>
        ) : (
          <p>
            {confirm?.row.name}에 붙여 둔 QR은 바로 쓸 수 없게 돼요. 다시 켤 수 없고, 필요하면 새로
            발급해야 해요.
          </p>
        )}
      </Modal>
    </div>
  );
}
