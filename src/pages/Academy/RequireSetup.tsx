import { useEffect, useState } from "react";
import { Navigate } from "react-router";

import Waiting from "./ui/Waiting";
import { routes } from "../routes";
import { getMyDay, getMySetup } from "../../lib/attendance";

// Sends a bootcamp participant who has not filled in the first sign-in
// screen to it, once, before the dashboard draws.
//
// WHY IT WRAPS THE PAGE RATHER THAN LIVING IN IT. Asking inside My
// learning would mean the dashboard drawing first and then being
// replaced, which is the worst of both: the person sees the thing they
// wanted for half a second and then it is taken away. This renders the
// same holding block the router already shows while a page's code is
// downloading, so the check adds no new state to the screen. It is the
// block they were already looking at, for a moment longer.
//
// WHY TWO QUESTIONS AND NOT ONE. "Has this person filled it in" is not
// enough, because the screen is for participants. A self-service learner
// who signed up this morning already answered twenty questions on the
// sign up page, and standing another form in front of their dashboard
// would be a poor welcome and nobody asked for it. So the second
// question is whether this account is linked to a bootcamp enrolment.
//
// They go in one Promise.all, so this costs one round trip rather than
// two. lms_attendance_my_day is the function asked, because it is the
// only one in file 28 that answers "is this account a participant"
// without staff rights, and it returns no code, no fingerprint and no
// token: for a learner with no enrolment it returns { bootcamp: false }
// and stops there.
//
// IT FAILS OPEN, DELIBERATELY. If either call errors, the dashboard is
// shown. A database hiccup must not be able to lock somebody out of the
// Academy, and the worst case of failing open is that the questions get
// asked on the next visit instead.

type State = "checking" | "through" | "setup";

export default function RequireSetup({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let alive = true;

    Promise.all([getMySetup(), getMyDay()]).then(([setup, day]) => {
      if (!alive) return;
      // Either refusal, and the person carries on to their dashboard.
      if (!setup.ok || !day.ok) {
        setState("through");
        return;
      }
      const participant = Boolean(day.data.bootcamp);
      setState(participant && !setup.data.done ? "setup" : "through");
    });

    return () => {
      alive = false;
    };
  }, []);

  if (state === "checking") return <Waiting />;
  if (state === "setup") return <Navigate to={routes.academyWelcome} replace />;
  return <>{children}</>;
}
