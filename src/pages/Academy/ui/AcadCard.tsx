import "./AcadCard.css";

// The white card the account pages live in, with the one orange edge in
// its top left corner.
//
// The edge is a gradient border drawn with a masked pseudo element rather
// than a real border, because a real border cannot fade from one colour to
// nothing along its own length.

type Props = {
  children: React.ReactNode;
  /** Renders a real <form>, which is what every step of every flow uses. */
  as?: "div" | "form";
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
  centred?: boolean;
};

export default function AcadCard({
  children,
  as = "div",
  onSubmit,
  className = "",
  centred = false,
}: Props) {
  const cls = [
    "acad-card",
    centred ? "acad-card--centred" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (as === "form") {
    return (
      <form className={cls} onSubmit={onSubmit} noValidate>
        {children}
      </form>
    );
  }
  return <div className={cls}>{children}</div>;
}
