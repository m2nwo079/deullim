const QUIET_ZONE = 4;

type QrCodeProps = {
  /** QR modules, true for dark. */
  matrix: readonly (readonly boolean[])[];
  /** Accessible name, e.g. the workstation the code belongs to. */
  label: string;
  className?: string;
};

/** QR code drawn as one SVG path: dark modules in the text color on the surface color, 4-module quiet zone. */
export function QrCode({ matrix, label, className }: QrCodeProps) {
  const size = matrix.length + QUIET_ZONE * 2;
  const path = matrix
    .flatMap((row, y) =>
      row.map((dark, x) => (dark ? `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z` : "")),
    )
    .join("");

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} className="fill-surface" />
      <path d={path} className="fill-text" />
    </svg>
  );
}
