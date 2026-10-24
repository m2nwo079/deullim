import type { IconName } from "../../components/icons";

// Console sections reached from ConsoleSidebar, and how the chosen site travels in ?site=
// (docs/components.md "이동").

export type Section = { key: string; label: string; icon: IconName; path: string };

export const CONSOLE_HOME = "/console";

export const SECTIONS: readonly Section[] = [
  { key: "overview", label: "개요", icon: "overview", path: CONSOLE_HOME },
  { key: "improvements", label: "공정 · 개선안", icon: "tool", path: "/console/improvements" },
  { key: "requests", label: "견적 요청", icon: "inbox", path: "/console/requests" },
  { key: "plans", label: "개선 계획", icon: "report", path: "/console/plans" },
  { key: "surveys", label: "수시 조사", icon: "survey", path: "/console/surveys" },
  { key: "reports", label: "보고서 초안", icon: "document", path: "/console/reports" },
  { key: "qr", label: "QR 관리", icon: "qr", path: "/console/qr" },
];

/** Section a console path belongs to, by its leading segments. Null outside the sections. */
export function sectionOf(pathname: string): Section | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === CONSOLE_HOME) {
    return SECTIONS[0];
  }
  return (
    SECTIONS.slice(1).find(
      (section) => path === section.path || path.startsWith(`${section.path}/`),
    ) ?? null
  );
}

export function withSite(path: string, siteId: string | undefined): string {
  return siteId ? `${path}?site=${encodeURIComponent(siteId)}` : path;
}

/**
 * Where picking another site in the header goes: the current section's first-level screen with
 * only ?site=. Values of the old site (a plan, a workstation) are dropped.
 */
export function siteSwitchTarget(pathname: string, siteId: string): string {
  return withSite(sectionOf(pathname)?.path ?? CONSOLE_HOME, siteId);
}

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * For a screen whose object belongs to one site: the same address with ?site= set to that site,
 * keeping every other value (such as ?done=), or null when ?site= already matches. Call it only
 * after the object was read, so a hidden object is a 404 and a matching address never redirects.
 */
export function siteRedirect(
  pathname: string,
  params: SearchParams,
  siteId: string,
): string | null {
  const current = params.site;
  if (current === siteId) {
    return null;
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "site" || value === undefined) {
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      query.append(key, item);
    }
  }
  query.set("site", siteId);
  return `${pathname}?${query.toString()}`;
}
