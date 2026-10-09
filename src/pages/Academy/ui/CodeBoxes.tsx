import { useEffect, useRef, useState } from "react";

import "./CodeBoxes.css";
import { CODE_LENGTH } from "../../../lib/academy";

// Six boxes for the emailed code.
//
// The boxes keep their own array of six cells rather than working from one
// joined string. That is what fixes the three faults testing found in the
// first build, and the reason is the same in all three: a string loses
// WHERE a digit was typed, and all three faults were about position.
//
//   (a) Tapping a box that already had a digit and typing one more wiped
//       the whole code. The box reports "27" to the change handler, two
//       characters, and the old code treated anything longer than one
//       character as a pasted code. On an iPhone that is the normal case,
//       not an edge case. Now only three or more characters at once count
//       as a paste, and for two the new digit is worked out by comparing
//       against what was already there.
//
//   (b) After a wrong code the boxes cleared but the cursor stayed where
//       it was, so the next digit landed in the middle.
//
//   (c) A digit typed into box 3 while boxes 1 and 2 were empty jumped to
//       box 1, because joining ["","","7"] gives "7" and "7" means box 1.
//       An array of six cells keeps the gap.

type Props = {
  value: string;
  onChange: (code: string) => void;
  /** Called the moment all six boxes are full, so nobody has to press a
      button they did not need. The submit button stays, for Enter and for
      anyone who prefers it. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  /** Turns every box green when the code was accepted. */
  accepted?: boolean;
  /** Shakes the boxes once when the code was refused. */
  refused?: boolean;
  label?: string;
};

const BLANK = ["", "", "", "", "", ""];

export default function CodeBoxes({
  value,
  onChange,
  onComplete,
  disabled = false,
  accepted = false,
  refused = false,
  label = "Your 6 digit code",
}: Props) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const [cells, setCells] = useState<string[]>(BLANK);
  const landed = useRef(false);

  // Fix (b). The page clears the value after a wrong code. When it does,
  // empty every box and put the cursor back in box 1, so the next digit
  // goes where the person expects it to.
  useEffect(() => {
    if (value === "" && cells.join("") !== "") {
      setCells(BLANK);
      boxes.current[0]?.focus();
    }
  }, [value, cells]);

  // Focus box 1 once, when the step first appears.
  useEffect(() => {
    if (!disabled && !landed.current) {
      landed.current = true;
      boxes.current[0]?.focus();
    }
  }, [disabled]);

  function report(next: string[]) {
    setCells(next);
    const code = next.join("");
    onChange(code);
    if (code.length === CODE_LENGTH && onComplete) onComplete(code);
  }

  // A whole code arriving at once: a paste, or the phone offering the code
  // straight out of the text message or email.
  function fillAll(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, CODE_LENGTH).split("");
    if (digits.length === 0) return;
    const next = BLANK.slice();
    digits.forEach((d, i) => {
      next[i] = d;
    });
    report(next);
    boxes.current[Math.min(digits.length, CODE_LENGTH - 1)]?.focus();
  }

  function onInput(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    const had = cells[index];

    if (digits.length === 0) {
      const next = cells.slice();
      next[index] = "";
      report(next);
      return;
    }

    // Three or more at once is never typing.
    if (digits.length >= 3) {
      fillAll(digits);
      return;
    }

    // Fix (a). Two characters means the box already held one and another
    // was typed beside it. Whichever of the two is not the old one is the
    // new one, and that is the only digit kept.
    const fresh =
      digits.length === 2 && had
        ? digits[0] === had
          ? digits[1]
          : digits[0]
        : digits.slice(-1);

    const next = cells.slice();
    next[index] = fresh;
    report(next);

    // Fix (c). Move forward only. A digit typed into box 3 stays in box 3
    // even when boxes 1 and 2 are still empty.
    if (index < CODE_LENGTH - 1) boxes.current[index + 1]?.focus();
  }

  function onKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = cells.slice();
      if (next[index]) {
        next[index] = "";
        report(next);
      } else if (index > 0) {
        next[index - 1] = "";
        report(next);
        boxes.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) boxes.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      boxes.current[index + 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    fillAll(e.clipboardData.getData("text"));
  }

  const state = accepted ? " is-accepted" : refused ? " is-refused" : "";

  return (
    <fieldset className={`acad-code${state}`} disabled={disabled}>
      <legend className="acad-code__legend">{label}</legend>
      {cells.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          className={`acad-code__box${digit ? " is-filled" : ""}`}
          type="text"
          inputMode="numeric"
          /* Only box 1 asks for the code. On all six, some browsers offer
             it six times over. */
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
          maxLength={CODE_LENGTH}
          value={digit}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </fieldset>
  );
}
