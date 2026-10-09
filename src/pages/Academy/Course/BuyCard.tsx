import { Link } from "react-router";

import "./BuyCard.css";
import { asPrice, type FullCourse } from "../../../lib/catalogue";
import { ArrowIcon, TickIcon } from "../ui/Icons";
import { routes } from "../../routes";

// The card that says what a course costs and what pressing the button
// will do.
//
// FIVE STATES, and two of them are reachable in this release.
//
//   free        the course costs nothing. "Start free"
//   open        paid, and online payment is working. "Start learning".
//               NOT USED YET. Paystack comes later, and the state is
//               written now so that turning it on later is one flag
//               rather than a rewrite of this file
//   closed      paid, payment not open yet, and the reader is signed
//               OUT. "Create an account", with a line saying online
//               payment opens soon
//   waiting     paid, payment not open yet, and the reader is signed
//               IN without access. No button telling them to create an
//               account, because they have one. Just the price and the
//               line about payment, and "Try module 1 free" if the
//               course offers it
//   owned       already has access. "Continue learning"
//
// WHY waiting EXISTS. Without it a signed in learner was told to
// "Create an account" on every paid course, which is the page telling
// somebody it does not know who they are. Worse, somebody who had
// already paid for the course was told the same thing.
//
// WHAT IT NEVER SAYS: anything about bootcamp emails, or about who gets
// a course free. Before somebody signs in the page has no idea who is
// reading it, so any such sentence is a promise made to a stranger.
// What an account can reach is decided by the server after sign in.

export type BuyState = "free" | "open" | "closed" | "waiting" | "owned";

type Props = {
  course: FullCourse;
  state: BuyState;
};

export default function BuyCard({ course, state }: Props) {
  const slug = course.slug;
  const from = { from: `/lms/courses/${slug}` };
  const paid = (course.price_kobo || 0) > 0;
  const signedIn = state === "owned" || state === "waiting";

  // Where "Try module 1 free" and the main button send somebody. A person
  // who is already signed in has no business being sent to the sign up
  // form. Until Phase 4 opens the player, both land on their account
  // page, which is where their courses will appear.
  const start = signedIn ? routes.academyMe : routes.academySignUp;

  // waiting is the one state with no main button at all.
  const button =
    state === "owned"
      ? { label: "Continue learning", to: routes.academyMe }
      : state === "free"
        ? { label: "Start free", to: start }
        : state === "open"
          ? { label: "Start learning", to: start }
          : state === "closed"
            ? { label: "Create an account", to: routes.academySignUp }
            : null;

  return (
    <aside className="acad-buy" aria-label="Price and how to start">
      {/* The price, and under it the line about payment. Under, not
          floating above the bar on a phone, where it used to sit over
          the page content as a separate box. */}
      <div className="acad-buy__money">
        <p className="acad-buy__label">Course price</p>
        <p className="acad-buy__price">{asPrice(course.price_kobo)}</p>
        {state === "closed" || state === "waiting" ? (
          <p className="acad-buy__soon">Online payment opens soon.</p>
        ) : null}
      </div>

      <p className="acad-buy__note">
        {state === "owned"
          ? "You already have this course."
          : paid
            ? "One payment. Yours to keep, at your own pace."
            : "No payment. Yours to keep, at your own pace."}
      </p>

      {button ? (
        <Link className="acad-btn acad-buy__go" to={button.to} state={from}>
          {button.label}
          <ArrowIcon />
        </Link>
      ) : null}

      {state !== "owned" && paid && course.first_module_free ? (
        <Link
          className={
            // With no main button this is the only one, so it takes the
            // solid style rather than sitting on the page as a ghost of
            // a button nobody notices.
            button
              ? "acad-btn acad-btn--ghost acad-buy__second"
              : "acad-btn acad-buy__go"
          }
          to={start}
          state={from}
        >
          Try module 1 free
          {button ? null : <ArrowIcon />}
        </Link>
      ) : null}

      <ul className="acad-buy__list">
        <li>
          <TickIcon />
          Works on your phone
        </li>
        <li>
          <TickIcon />
          Your place saved as you watch
        </li>
        <li>
          <TickIcon />
          Certificate with a public number
        </li>
      </ul>
    </aside>
  );
}
