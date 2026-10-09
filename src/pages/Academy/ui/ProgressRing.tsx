import "./ProgressRing.css";

// A ring showing how far through something somebody is, with the number
// in the middle.
//
// Not the same thing as MeterRing, which counts down a number of seconds
// and is used on the code screen. This one shows a share of a whole and
// never moves on its own. Two components rather than one with a mode,
// because the only thing they have in common is being round.
//
// The ring is drawn by shortening a circle's dash. Nothing is measured
// and no frames are counted.

type Props = {
  /** 0 to 100. */
  percent: number;
  /** Pixel width. The stroke and the type scale with it. */
  size?: number;
  /** Small word under the number, such as COURSE. */
  label?: string;
  /** Red rather than orange, for a failed quiz result. */
  tone?: "signal" | "bad";
  /** What a screen reader should hear instead of the digits. */
  title?: string;
};

export default function ProgressRing({
  percent,
  size = 104,
  label,
  tone = "signal",
  title,
}: Props) {
  const safe = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  // The viewBox is always 104 wide, so one set of numbers works at every
  // size and the browser does the scaling.
  const r = 44;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - safe / 100);

  return (
    <div
      className={`acad-ring acad-ring--${tone}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={title || `${safe} percent complete`}
    >
      <svg viewBox="0 0 104 104" aria-hidden="true">
        <circle className="acad-ring__bg" cx="52" cy="52" r={r} />
        <circle
          className="acad-ring__fg"
          cx="52"
          cy="52"
          r={r}
          strokeDasharray={circumference.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
        />
      </svg>
      <span className="acad-ring__mid" aria-hidden="true">
        <b>{safe}%</b>
        {label ? <small>{label}</small> : null}
      </span>
    </div>
  );
}
