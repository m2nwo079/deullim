import type { Metadata } from "next";
import { connection } from "next/server";
import { addMonths } from "../../../src/components/date-grid";
import { todayKst } from "../../../src/features/adhoc-surveys/survey-rules";
import { requirePreviewEnabled } from "../guard";
import { ComponentsDemo } from "./demo";

export const metadata: Metadata = { title: "시안: 공통 컴포넌트 | 들림" };

export default async function ComponentsPreview() {
  requirePreviewEnabled();
  // Render per request so the calendars mark the real today, not the build day.
  await connection();
  const today = todayKst(new Date());
  return <ComponentsDemo today={today} lastDay={addMonths(today, 24)} />;
}
