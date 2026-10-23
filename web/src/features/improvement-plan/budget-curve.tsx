"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  downsampleCurve,
  formatHours,
  formatWon,
  niceTicks,
  pointAtBudget,
  stepPath,
  type CurvePoint,
} from "./curve";

const HEIGHT = 240;
const MARGIN = { top: 16, right: 16, bottom: 32, left: 48 };

/**
 * Budget against the best daily high-risk reduction, as a step line (single series, so no legend).
 * The entered budget is marked on the line. Hover or arrow keys show a crosshair readout, and the
 * table below the chart holds the same values without hovering.
 */
export function BudgetCurve({ curve, budget }: { curve: CurvePoint[]; budget: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();

  useEffect(() => {
    const element = box.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, entry.contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const points = downsampleCurve(curve);
  const last = points[points.length - 1];
  const yTicks = niceTicks(last.reduction, true, 5);
  const yMax = Math.max(yTicks[yTicks.length - 1], 1e-9);
  const xTicks = niceTicks(budget, false, width < 480 ? 3 : 6);
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (b: number) => MARGIN.left + (budget > 0 ? (b / budget) * plotWidth : 0);
  const y = (r: number) => MARGIN.top + plotHeight - (r / yMax) * plotHeight;
  const hovered = active === null ? null : points[active];
  // The readout sits beside the crosshair, on the side with more room, so it never hides the line.
  const hoverX = hovered ? x(hovered.budget) : 0;
  const tooltipPosition = hoverX > width / 2 ? { right: width - hoverX + 8 } : { left: hoverX + 8 };

  function handlePointer(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    setActive(pointAtBudget(points, ratio * budget));
  }

  function handleKey(event: KeyboardEvent<SVGSVGElement>) {
    const current = active ?? points.length - 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const next = current + (event.key === "ArrowLeft" ? -1 : 1);
      setActive(Math.min(Math.max(next, 0), points.length - 1));
    } else if (event.key === "Escape") {
      setActive(null);
    }
  }

  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-small font-medium">
        예산별 최대 위험 감소량 (하루 사람 · 시간)
      </figcaption>
      <div ref={box} className="relative w-full">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          tabIndex={0}
          aria-label={`예산 0원에서 ${formatWon(budget)}까지 감소량 0에서 ${formatHours(last.reduction)}. 좌우 화살표로 값을 볼 수 있어요.`}
          aria-describedby={tableId}
          onKeyDown={handleKey}
          onBlur={() => setActive(null)}
          className="block rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-text-secondary text-caption tabular-nums"
              >
                {formatHours(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((tick, i) => (
            <text
              key={`x-${tick}`}
              x={x(tick)}
              y={HEIGHT - 8}
              textAnchor={i === 0 ? "start" : tick === budget ? "end" : "middle"}
              className="fill-text-secondary text-caption"
            >
              {formatWon(tick)}
            </text>
          ))}
          <path
            d={stepPath(points, x, y)}
            fill="none"
            className="stroke-text-secondary"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Entered budget: a hairline to the axis and a ringed dot on the line. */}
          <line
            x1={x(last.budget)}
            x2={x(last.budget)}
            y1={y(last.reduction)}
            y2={MARGIN.top + plotHeight}
            className="stroke-border-strong"
            strokeWidth={1}
          />
          <circle
            cx={x(last.budget)}
            cy={y(last.reduction)}
            r={5}
            className="fill-text stroke-surface"
            strokeWidth={2}
          />
          {hovered ? (
            <g>
              <line
                x1={x(hovered.budget)}
                x2={x(hovered.budget)}
                y1={MARGIN.top}
                y2={MARGIN.top + plotHeight}
                className="stroke-border-strong"
                strokeWidth={1}
              />
              <circle
                cx={x(hovered.budget)}
                cy={y(hovered.reduction)}
                r={4}
                className="fill-text-secondary stroke-surface"
                strokeWidth={2}
              />
            </g>
          ) : null}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onPointerMove={handlePointer}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        <p
          aria-live="polite"
          style={tooltipPosition}
          className={`pointer-events-none absolute top-0 flex flex-col rounded-control border border-border bg-surface px-1 shadow-sm ${hovered ? "" : "sr-only"}`}
        >
          {hovered ? (
            <>
              <span className="text-small font-bold tabular-nums">
                {formatHours(hovered.reduction)} 사람 · 시간
              </span>
              <span className="text-caption text-text-secondary">
                예산 {formatWon(hovered.budget)}
              </span>
            </>
          ) : null}
        </p>
      </div>
      <p className="text-caption text-text-secondary">
        점은 입력한 예산 {formatWon(last.budget)}에서의 감소량 {formatHours(last.reduction)}이에요.
      </p>
      <details className="text-small">
        <summary className="cursor-pointer text-text-secondary">예산별 감소량 표 보기</summary>
        <table id={tableId} className="mt-1 w-full max-w-50 text-left">
          <thead>
            <tr className="border-b border-border text-caption text-text-secondary">
              <th scope="col" className="py-1 font-medium">
                예산
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                최대 감소량
              </th>
            </tr>
          </thead>
          <tbody>
            {downsampleCurve(curve, 51).map((point) => (
              <tr key={point.budget} className="border-b border-border">
                <td className="py-1">{formatWon(point.budget)}</td>
                <td className="py-1 text-right tabular-nums">{formatHours(point.reduction)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
