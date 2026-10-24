"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  ConsoleDrawer,
  ConsoleHomeLink,
  ConsoleSidebar,
  type NavGroup,
} from "../../components/console-sidebar";
import { PageFooter } from "../../components/page-footer";
import { Select } from "../../components/select";
import { CONSOLE_HOME, SECTIONS, sectionOf, siteSwitchTarget, withSite } from "./nav";

type Site = { id: string; name: string };

type ConsoleShellProps = {
  /** Sites the manager belongs to (RLS), read once by the layout. */
  sites: Site[];
  displayName: string;
  signOut: ReactNode;
  children: ReactNode;
};

/**
 * Console frame: sidebar (fixed at 1024px and wider, a drawer below), and a header with the site
 * select and the account. Layouts get no search params, so the current site and section come
 * from the address here; the pages still check ?site= themselves against RLS.
 */
export function ConsoleShell({ sites, displayName, signOut, children }: ConsoleShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const requested = useSearchParams().get("site");
  const site = sites.find((s) => s.id === requested) ?? sites[0];
  const current = sectionOf(pathname)?.key;
  const groups: NavGroup[] = [
    {
      items: SECTIONS.map((section) => ({
        label: section.label,
        icon: section.icon,
        href: withSite(section.path, site?.id),
        current: section.key === current,
      })),
    },
  ];

  const home = { href: withSite(CONSOLE_HOME, site?.id), current: current === "overview" };

  // The header puts the label beside the box; the drawer keeps it above.
  const siteSelect = (id: string, labelPosition: "top" | "side") =>
    sites.length > 1 && site ? (
      <Select
        id={id}
        label="사업장"
        options={sites.map((s) => ({ value: s.id, label: s.name }))}
        value={site.id}
        onValueChange={(next) => router.push(siteSwitchTarget(pathname, next))}
        labelPosition={labelPosition}
      />
    ) : site ? (
      <p className="text-body font-medium">{site.name}</p>
    ) : null;

  return (
    <div className="flex min-h-screen bg-surface">
      <ConsoleSidebar groups={groups} home={home} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border print:hidden">
          <div className="mx-auto flex w-full max-w-console items-center justify-between gap-2 px-3 py-1">
            <div className="flex items-center gap-1">
              <ConsoleDrawer
                groups={groups}
                top={<div className="px-2 sm:hidden">{siteSelect("site-drawer", "top")}</div>}
              />
              <span className="lg:hidden">
                <ConsoleHomeLink {...home} />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden w-40 sm:block">{siteSelect("site-header", "side")}</div>
              <p className="text-small text-text-secondary">{displayName}</p>
              {signOut}
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <PageFooter />
      </div>
    </div>
  );
}
