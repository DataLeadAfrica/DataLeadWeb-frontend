import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";

import Shell from "./Shell";
import type { NavCounts } from "./Shell";
import { getSession } from "../../../lib/academy";
import { getMyRole, type Role } from "../../../lib/studio";
import { routes } from "../../routes";

// Every control room page goes through here.
//
// IT ASKS THE DATABASE WHO THEY ARE, rather than reading a role out of
// the session. A token says who somebody is and keeps saying it for an
// hour; somebody taken off the staff list at 10:00 would still be
// carrying an administrator's token at 10:30. The role is a question,
// so it gets asked.
//
// THIS IS STILL ONLY A COURTESY. It decides which menu to draw and
// which page to show, and nothing else. Every administrator-only page
// underneath it calls functions that check again, and those functions
// are the thing that actually refuses. If this component were deleted
// tomorrow, a facilitator who typed /lms/studio/learners would see a
// page with an error on it rather than a list of learners, which is the
// property worth having.
//
// WHERE SOMEBODY WHO IS NOT STAFF GOES. A learner who finds this
// address is sent to their own My learning page, not to a sign in
// screen: they ARE signed in, and asking them to sign in again to be
// refused a second time would be a small cruelty.

type Props = {
  /** true if only an administrator may see this page. */
  adminOnly?: boolean;
  counts?: NavCounts;
  children: (role: Role) => React.ReactNode;
};

type State =
  | { at: "asking" }
  | { at: "out" }
  | { at: "learner" }
  | { at: "in"; role: Role; name: string };

export default function RequireStaff({ adminOnly = false, counts, children }: Props) {
  const location = useLocation();
  const [state, setState] = useState<State>({ at: "asking" });

  useEffect(() => {
    let alive = true;
    (async () => {
      const session = await getSession();
      if (!alive) return;
      if (!session.signedIn) {
        setState({ at: "out" });
        return;
      }
      const role = await getMyRole();
      if (!alive) return;
      if (role === "learner") {
        setState({ at: "learner" });
        return;
      }
      setState({ at: "in", role, name: session.fullName || "" });
    })();
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  // Nothing while the question is being asked. It is two quick calls,
  // and a spinner for that long is a flash of worry about nothing.
  if (state.at === "asking") return null;

  if (state.at === "out") {
    return <Navigate to={routes.academySignIn} replace state={{ from: location.pathname }} />;
  }

  if (state.at === "learner") {
    return <Navigate to={routes.academyMe} replace />;
  }

  return (
    <Shell role={state.role} name={state.name} counts={counts}>
      {adminOnly && state.role !== "admin" ? (
        <div className="stu__empty">
          <p>
            <b>That section is for administrators.</b>
          </p>
          <p>
            Everything you build is under Courses, Learning paths and Reports.
          </p>
        </div>
      ) : (
        children(state.role)
      )}
    </Shell>
  );
}
