"use client";

import { useRouter } from "next/navigation";
import { Select, type SelectOption } from "../../components/select";
import { withSite } from "../console-shell/nav";

const PAGE = "/console/reports";
/** Value of the "넣지 않음" choice; a plan id is a UUID, so it never collides. */
const NONE = "none";

/** Picks the saved plan to put in the report; the page reloads with ?plan= (docs/components.md). */
export function PlanSelect({
  siteId,
  plans,
  planId,
}: {
  siteId: string;
  plans: SelectOption[];
  planId: string | null;
}) {
  const router = useRouter();
  return (
    <div className="max-w-40">
      <Select
        id="report-plan"
        label="함께 넣을 개선 계획"
        options={[{ value: NONE, label: "넣지 않음" }, ...plans]}
        value={planId ?? NONE}
        onValueChange={(next) => {
          const base = withSite(PAGE, siteId);
          router.push(next === NONE ? base : `${base}&plan=${encodeURIComponent(next)}`);
        }}
      />
    </div>
  );
}
