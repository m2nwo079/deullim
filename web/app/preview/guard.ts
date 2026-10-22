import { notFound } from "next/navigation";

/**
 * Previews open only in local development and Vercel preview deployments.
 * Everything else, including production and an unset VERCEL_ENV, returns 404.
 * Call it in every preview page as well as the layout: layouts and pages render in parallel,
 * so a layout-only check still ships the page payload with the 404 response.
 */
export function requirePreviewEnabled(): void {
  if (!(process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview")) {
    notFound();
  }
}
