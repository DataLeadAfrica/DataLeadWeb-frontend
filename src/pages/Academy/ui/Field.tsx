import { useId, useState } from "react";

import "./Field.css";

// One text input with a label that floats up out of the way once there is
// something in the box.
//
// Why a floating label and not a placeholder: a placeholder disappears the
// moment somebody types, so anyone interrupted halfway through a form comes
// back to three filled boxes and no idea which is which. The label here
// stays on screen for as long as the value does.
//
// The trick is CSS only. The input carries placeholder=" ", a single space,
// so :placeholder-shown is true exactly while the box is empty. Nothing
// here listens for focus or measures anything.

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  disabled?: boolean;
  /** Draws the box in red and points a screen reader at the message. */
  invalid?: boolean;
  /** The id of the element holding the error text, for aria-describedby. */
  describedBy?: string;
  /** Adds a Show and Hide button. Only makes sense with type="password". */
  canReveal?: boolean;
};

export default function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  disabled = false,
  invalid = false,
  describedBy,
  canReveal = false,
}: Props) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);

  const shownType = canReveal && revealed ? "text" : type;

  return (
    <div className={`acad-field${canReveal ? " acad-field--peek" : ""}`}>
      <input
        id={id}
        className="acad-field__input"
        type={shownType}
        value={value}
        placeholder=" "
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
      <label className="acad-field__label" htmlFor={id}>
        {label}
      </label>
      {canReveal ? (
        <button
          type="button"
          className="acad-field__peek"
          aria-pressed={revealed}
          disabled={disabled}
          onClick={() => setRevealed((r) => !r)}
        >
          {revealed ? "Hide" : "Show"}
        </button>
      ) : null}
    </div>
  );
}
