"use client";

import { Button } from "../../components/button";

/** Opens the browser's print dialog, where "Save as PDF" is also offered. */
export function PrintButton() {
  return (
    <Button iconBefore="document" onClick={() => window.print()}>
      인쇄 / PDF로 저장
    </Button>
  );
}
