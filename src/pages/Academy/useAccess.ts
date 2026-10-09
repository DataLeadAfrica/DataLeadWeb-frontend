import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { syncAccess, type AccessState } from "../../lib/academy";

// Access refresh, and the one notice it produces.
//
// Why it exists: a person's rights come from whether their confirmed email
// is on one of two lists, and those lists change without them doing
// anything. Somebody taken off a cohort should lose the free catalogue
// even if they never sign in again, and somebody newly added should get it
// without having to ask.
//
// THE FAULT THIS REPLACES
// -----------------------
// The sync returns changed = true exactly once, the first time it notices
// a difference. Sign up, sign in and reset all called it themselves before
// sending the person on to My learning, so by the time My learning called
// it again the change had already been reported and used up. The notice
// was therefore never shown to the one person it was written for: somebody
// who had just arrived.
//
// The fix is that whoever calls the sync carries the answer with them.
// handOver() packs it into the navigation and this hook unpacks it, rather
// than calling the sync a second time. Only a page opened directly, with
// nothing handed over, syncs for itself.

export const ACCESS_KEY = "access";

/** What sign up, sign in and reset pass to navigate() after syncing. */
export function handOver(state: AccessState | null) {
  return state ? { [ACCESS_KEY]: state } : undefined;
}

export type AccessView = {
  /** The role from the sync, as the database spells it: learner, facilitator, admin. */
  role: string;
  /** True when the bootcamp enrolment is active. Decides the pass card. */
  bootcamp: boolean;
  /** The one time message, or "" when there is nothing to say. */
  notice: string;
  dismiss: () => void;
  /** False until the sync or the handover has answered. */
  ready: boolean;
};

export function useAccess(): AccessView {
  const location = useLocation();
  const navigate = useNavigate();

  // Read the handover ONCE, on the first render. It has to be captured
  // here because the effect below immediately wipes it out of the history
  // entry, and after that reading location.state again would find nothing
  // and start a second sync.
  const [handed] = useState<AccessState | null>(() => {
    const carried = (location.state as Record<string, unknown> | null)?.[
      ACCESS_KEY
    ];
    return (carried as AccessState | undefined) ?? null;
  });

  const [state, setState] = useState<AccessState | null>(handed);
  const [notice, setNotice] = useState(
    handed && handed.changed ? handed.message : "",
  );
  const [ready, setReady] = useState(handed !== null);
  const synced = useRef(false);
  const cleaned = useRef(false);

  // Take the handover out of the history entry once it has been read.
  // Without this the notice would come back on every refresh, and "show it
  // once" would mean "show it until they stop pressing reload".
  useEffect(() => {
    if (handed === null || cleaned.current) return;
    cleaned.current = true;
    navigate(location.pathname + location.search, {
      replace: true,
      state: null,
    });
  }, [handed, navigate, location.pathname, location.search]);

  useEffect(() => {
    // Nothing to do when the answer was handed over.
    if (handed !== null) return;
    // React runs effects twice in development. Without this the sync would
    // fire twice on every page open.
    if (synced.current) return;
    synced.current = true;

    let alive = true;
    syncAccess().then((fresh) => {
      if (!alive) return;
      setState(fresh);
      setReady(true);
      if (fresh && fresh.changed && fresh.message) setNotice(fresh.message);
    });
    return () => {
      alive = false;
    };
  }, [handed]);

  return {
    role: state?.role ?? "learner",
    bootcamp: Boolean(state?.bootcamp),
    notice,
    dismiss: () => setNotice(""),
    ready,
  };
}
