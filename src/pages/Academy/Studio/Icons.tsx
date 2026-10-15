// The control room's line icons.
//
// Drawn here rather than imported, for the same reason the Academy's are:
// an icon set is a dependency that ships a thousand glyphs so a page can
// use nine, and these are nine strokes each.
//
// Every one is a 24 box with no fill, so the stroke colour is set by the
// thing around it and an icon never fights its label for attention.

type P = { className?: string };

const box = (d: React.ReactNode, className?: string) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    {d}
  </svg>
);

export const HomeIcon = ({ className }: P) =>
  box(<path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z" />, className);

export const BookIcon = ({ className }: P) =>
  box(
    <>
      <path d="M5 4h11a2 2 0 012 2v14H7a2 2 0 01-2-2z" />
      <path d="M5 16h13" />
    </>,
    className,
  );

export const PathIcon = ({ className }: P) =>
  box(
    <>
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <path d="M8.4 17A9 9 0 0017 8.4" />
    </>,
    className,
  );

export const GridIcon = ({ className }: P) =>
  box(
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>,
    className,
  );

export const UsersIcon = ({ className }: P) =>
  box(
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0112 0" />
      <path d="M16 5.5a3.2 3.2 0 010 5.6M17 20a6 6 0 00-2-4.3" />
    </>,
    className,
  );

export const KeyIcon = ({ className }: P) =>
  box(
    <>
      <circle cx="8" cy="12" r="3.4" />
      <path d="M11.4 12H21M18 12v3M15 12v2.4" />
    </>,
    className,
  );

export const AwardIcon = ({ className }: P) =>
  box(
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M9 13.5L8 21l4-2 4 2-1-7.5" />
    </>,
    className,
  );

export const ChartIcon = ({ className }: P) =>
  box(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />, className);

export const SlidersIcon = ({ className }: P) =>
  box(
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>,
    className,
  );

export const PopIcon = ({ className }: P) =>
  box(
    <>
      <rect x="3" y="5" width="14" height="11" rx="2" />
      <path d="M8 20h12a1 1 0 001-1V9" />
    </>,
    className,
  );

export const PulseIcon = ({ className }: P) =>
  box(<path d="M2 12h4l3-7 4 14 3-7h6" />, className);

export const SearchIcon = ({ className }: P) =>
  box(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l5 5" />
    </>,
    className,
  );

export const PlusIcon = ({ className }: P) => box(<path d="M12 5v14M5 12h14" />, className);

export const ArrowIcon = ({ className }: P) =>
  box(<path d="M5 12h13M13 6l6 6-6 6" />, className);

export const TickIcon = ({ className }: P) => box(<path d="M4 12.5l5 5L20 6.5" />, className);

export const CrossIcon = ({ className }: P) =>
  box(<path d="M6 6l12 12M18 6L6 18" />, className);

export const WarnIcon = ({ className }: P) =>
  box(
    <>
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 9.5v4.5M12 17.2v.1" />
    </>,
    className,
  );

export const ClockIcon = ({ className }: P) =>
  box(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.3 2" />
    </>,
    className,
  );

export const SendIcon = ({ className }: P) =>
  box(<path d="M21 3L10.5 13.5M21 3l-6.7 18-3.8-7.5L3 9.8z" />, className);

export const MoreIcon = ({ className }: P) =>
  box(
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>,
    className,
  );

export const OutIcon = ({ className }: P) =>
  box(
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5" />
    </>,
    className,
  );

export const DownIcon = ({ className }: P) =>
  box(<path d="M12 4v12M7 11l5 5 5-5M4 20h16" />, className);
