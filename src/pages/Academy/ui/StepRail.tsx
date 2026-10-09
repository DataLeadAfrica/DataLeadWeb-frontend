import "./StepRail.css";

// Three short bars across the top of the card: Details, Verify, Ready.
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
  steps?: [string, string, string];
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
