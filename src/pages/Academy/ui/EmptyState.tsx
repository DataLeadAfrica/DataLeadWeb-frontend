import "./EmptyState.css";

// What somebody sees before they have started anything.
//
// A blank box reads as a fault. This says what the space is for, and shows
// a few cells of a watch tape as a hint of what is going to fill it, so
// the first real course looks like it belongs there rather than like a
// different page.

type Props = {
  /** The small mono label above, naming the area. */
  label: string;
  title: string;
  children: React.ReactNode;
  /** Optional button or link underneath. */
  action?: React.ReactNode;
};

export default function EmptyState({ label, title, children, action }: Props) {
  return (
    <div className="acad-empty">
      <p className="acad-empty__label">{label}</p>
      <div className="acad-empty__ghost" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <h2 className="acad-h3">{title}</h2>
      <p className="acad-empty__text">{children}</p>
      {action}
    </div>
  );
}
