import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";

import { getSession } from "../../lib/academy";
import { routes } from "../routes";

// Wraps any Academy page that needs somebody signed in.
//
// Somebody not signed in is sent to /lms/sign-in, and the page they were
// trying to reach travels with them so they land back on it afterwards
// rather than on a dashboard they did not ask for.
//
// While the session is being read it renders nothing rather than a
// spinner. Reading it is a local lookup and takes a few milliseconds, so
// a spinner would be a flash of worry about nothing.

export default function RequireAccount({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<"checking" | "in" | "out">("checking");

  useEffect(() => {
    let alive = true;
    getSession().then((s) => {
      if (alive) setState(s.signedIn ? "in" : "out");
    });
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  if (state === "checking") return null;

  if (state === "out") {
    return (
      <Navigate
        to={routes.academySignIn}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}
