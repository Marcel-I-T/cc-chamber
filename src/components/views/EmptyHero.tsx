interface Props {
  hint?: string;
}

/**
 * OC-style empty state: a thin 3D wireframe cube + italic hint text.
 * Pure SVG so it scales cleanly on any window size.
 */
export function EmptyHero({ hint }: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6">
      <svg
        width="140"
        height="140"
        viewBox="0 0 200 200"
        fill="none"
        className="text-fg-subtle"
      >
        {/* back face */}
        <path
          d="M 70 50 L 150 50 L 150 130 L 70 130 Z"
          stroke="currentColor"
          strokeWidth="1.4"
          opacity="0.35"
        />
        {/* front face */}
        <path
          d="M 50 70 L 130 70 L 130 150 L 50 150 Z"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="rgba(167, 139, 250, 0.04)"
        />
        {/* connecting edges */}
        <line x1="70" y1="50" x2="50" y2="70" stroke="currentColor" strokeWidth="1.4" opacity="0.6" />
        <line x1="150" y1="50" x2="130" y2="70" stroke="currentColor" strokeWidth="1.4" opacity="0.6" />
        <line x1="150" y1="130" x2="130" y2="150" stroke="currentColor" strokeWidth="1.4" opacity="0.6" />
        <line x1="70" y1="130" x2="50" y2="150" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
        {/* inner accent square */}
        <rect
          x="78"
          y="98"
          width="24"
          height="24"
          stroke="currentColor"
          strokeWidth="1.2"
          opacity="0.5"
        />
      </svg>
      {hint && (
        <div className="max-w-md text-center font-mono text-[12px] italic text-fg-subtle">
          "{hint}"
        </div>
      )}
    </div>
  );
}
