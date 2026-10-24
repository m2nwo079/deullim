import type { ReactNode } from "react";
import { Breadcrumb, type Crumb } from "./breadcrumb";
import { InlineAlert } from "./inline-alert";

type PageHeaderProps = {
  /** Second-level and deeper screens: the full path, the last item being this screen. */
  breadcrumb?: readonly Crumb[];
  title: ReactNode;
  /** Facts about this screen that are not part of the path, such as the headcount. */
  info?: ReactNode;
  /** Buttons at the right of the title, such as the screen's one primary entry. */
  actions?: ReactNode;
  /** Result of the move that led here (?done=), picked by the screen. */
  notice?: string | null;
};

/**
 * Title block of console and partner screens. Pages lay out their blocks 48px apart (gap-6); the
 * negative bottom margin here brings the first block 32px under the title (docs/components.md
 * "간격").
 */
export function PageHeader({ breadcrumb, title, info, actions, notice }: PageHeaderProps) {
  return (
    <div className="-mb-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          {breadcrumb ? <Breadcrumb items={breadcrumb} /> : null}
          <h1 className="text-title font-bold">{title}</h1>
          {info ? <div className="text-small text-text-secondary">{info}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {notice ? <InlineAlert icon="check">{notice}</InlineAlert> : null}
    </div>
  );
}

/** Class of a console or partner page's main: blocks 48px apart, no bottom padding (PageFooter). */
export const PAGE_MAIN = "mx-auto flex w-full flex-col gap-6 px-3 pt-3";
