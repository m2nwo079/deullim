import Link from "next/link";

/** Every item but the last links upward; the last one is the current screen and has no href. */
export type Crumb = { label: string; href?: string };

/** Full path above the title of second-level and deeper screens (docs/components.md). */
export function Breadcrumb({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="현재 위치">
      <ol className="flex flex-wrap items-center gap-1 text-small text-text-secondary">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${index}-${item.label}`} className="flex items-center gap-1">
              {last || !item.href ? (
                <span aria-current={last ? "page" : undefined} className="text-text">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="rounded-control underline-offset-4 hover:text-text hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  {item.label}
                </Link>
              )}
              {last ? null : <span aria-hidden="true">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
