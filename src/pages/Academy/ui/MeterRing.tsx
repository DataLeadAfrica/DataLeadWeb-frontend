import "./MeterRing.css";

// A small circular countdown with a line of text beside it.
//
// Two sit side by side on the code screen: how long the code lasts, and
// how long until another can be asked for. Both answer a question people
// otherwise have to guess at, and guessing is what makes them hammer a
// button that is going to refuse them.
//
// The ring is drawn by shortening a circle's dash. Nothing is measured and
// no frames are counted: the page hands in a number of seconds once a
// second and the ring follows it.

const R = 17;
const CIRCUMFERENCE = 2 * Math.PI * R; // 106.8

type Props = {
  /** The small grey line above the value. */
  label: string;
  /** Seconds remaining. */
  left: number;
  /** What the ring was full at. */
  total: number;
  children: React.ReactNode;
};

export default function MeterRing({ label, left, total, children }: Props) {
  const share = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const offset = CIRCUMFERENCE * (1 - share);

  return (
    <div className="acad-meter">
      <svg className="acad-meter__ring" viewBox="0 0 40 40" aria-hidden="true">
        <circle className="acad-meter__bg" cx="20" cy="20" r={R} />
        <circle
          className="acad-meter__fg"
          cx="20"
          cy="20"
          r={R}
          strokeDasharray={CIRCUMFERENCE.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
        />
      </svg>
      <div className="acad-meter__text">
        <small>{label}</small>
        {children}
      </div>
    </div>
  );
}
