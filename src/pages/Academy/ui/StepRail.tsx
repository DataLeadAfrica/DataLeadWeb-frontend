import "./StepRail.css";

// Short bars across the top of the card, one per step.
//
// THREE BY DEFAULT, BUT NOT ALWAYS THREE. Sign up has two as of Phase
// 6D: it no longer sends a code, so there is nothing to verify between
// typing the details and being done. The type used to be a tuple of
// exactly three, which made a two step flow impossible to express and
// would have left sign up showing a VERIFY bar for a step that no
// longer exists.
//
// People abandon a form they cannot see the end of. The rail says there
// are three steps and which one they are on, before they have typed
// anything.
//
// The steps differ by more than colour: a step that is done has a filled
// bar, the current one has a lit gradient bar, and a step still to come
// has an empty grey bar. The whole thing is also announced in words to a
// screen reader through aria-label, so the bars are decoration.

type Props = {
  /** 1, 2 or 3. */
  current: number;
  /** Defaults to the sign up wording. */
  steps?: string[];
};

export default function StepRail({
  current,
  steps = ["Details", "Verify", "Ready"],
}: Props) {
  return (
    <div
      className="acad-rail"
      aria-label={`Step ${current} of ${steps.length}: ${steps[current - 1]}`}
    >
      {steps.map((name, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "cur" : "next";
        return (
          <div key={name} className={`acad-rail__step is-${state}`} aria-hidden="true">
            {name}
          </div>
        );
      })}
    </div>
  );
}
