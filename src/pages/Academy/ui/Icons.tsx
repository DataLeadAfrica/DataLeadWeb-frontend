// The handful of line icons the Academy uses, drawn inline.
//
// Inline rather than as image files because they are tiny, because they
// inherit the colour of the text beside them, and because an icon that is
// part of the markup cannot arrive late and shift the page.
//
// Every one is aria-hidden. None of them carries meaning on its own: the
// words beside them always say the same thing.

type IconProps = { className?: string };

export function TickIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function WarnIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.2v.3" />
    </svg>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.8v.3" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </svg>
  );
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10 9.5v5l4.5-2.5z" />
    </svg>
  );
}

export function SealIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13l-1.5 8 5-2.5 5 2.5-1.5-8" />
    </svg>
  );
}

/** A padlock. The shape a locked lesson carries, so the state does not
    depend on anybody being able to tell orange from green. */
export function LockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="11" width="12" height="9" rx="2" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </svg>
  );
}

/**
 * Three bars and a baseline, for the fourth floating tile on the hero.
 *
 * It replaced a question mark. A "?" in a white tile on a web page
 * reads as a help button, and people tap help buttons: the tile is
 * decoration, it does nothing, and a tile that looks tappable and is
 * not is worse than no tile. The chart is what the concept had, and it
 * says the same thing the page already says in words.
 */
export function ChartIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20V11M10 20V5M16 20v-6M3 20h18" />
    </svg>
  );
}

/** A speech mark, for the module quiz row. */
export function AskIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 9a3 3 0 1 1 3 3v2M12 17h.01" />
    </svg>
  );
}

/**
 * The little picture on a goal chip, chosen by the course area.
 *
 * Keyed by the same short area key the cover art uses, so an area the
 * database grows next year gets the general one rather than nothing.
 * Like every icon here it carries no meaning on its own: the chip
 * always says the goal in words beside it.
 */
export function GoalIcon({ area, className }: IconProps & { area: string }) {
  const paths: Record<string, React.ReactNode> = {
    // Analysis: points with an axis, the shape of a scatter.
    an: (
      <>
        <circle cx="7" cy="15" r="1.6" />
        <circle cx="11" cy="11" r="1.6" />
        <circle cx="15" cy="12" r="1.6" />
        <circle cx="18" cy="7" r="1.6" />
        <path d="M3 20h18M3 20V3" />
      </>
    ),
    // Visualisation: a chart in a frame.
    vi: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M7 15l3-3 3 2 4-5" />
      </>
    ),
    // Data collection: a form being filled in.
    dc: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="3" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    // Programming: angle brackets.
    pr: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />,
    // Everything, and anything we have no picture for: four panes.
    x: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
  };
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {paths[area] || paths.x}
    </svg>
  );
}
