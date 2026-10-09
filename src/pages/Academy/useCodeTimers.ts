import { useEffect, useState } from "react";

import { CODE_SECONDS, RESEND_WAIT_SECONDS } from "../../lib/academy";

// The two countdowns on every code screen: how long the code lasts, and
// how long before another can be asked for.
//
// Both are worked out from one timestamp rather than by counting down a
// number every second. That matters because a browser slows timers right
// down in a background tab: a counter that subtracts one per tick would
// drift further behind the longer the tab sat unwatched, and would then
// tell somebody their code had four minutes left when it had already run
// out. Reading the clock cannot drift.
//
// Nothing here is the real rule. The code's life is a Supabase setting
// (Authentication, Sign In / Providers, Email, Email OTP expiration) and
// the 60 second wait is enforced by Supabase too. These numbers only have
// to agree with those settings, and CODE_SECONDS is the single place the
// number is written down.

export type CodeTimers = {
  /** Seconds left on the code, counting down from CODE_SECONDS. */
  life: number;
  /** Seconds until another code can be asked for, from 60. */
  resend: number;
  /** Call after a code is sent, to start both again. */
  restart: () => void;
};

export function useCodeTimers(active: boolean): CodeTimers {
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const gone = Math.floor((now - sentAt) / 1000);

  return {
    life: Math.max(0, CODE_SECONDS - gone),
    resend: Math.max(0, RESEND_WAIT_SECONDS - gone),
    restart: () => {
      const t = Date.now();
      setSentAt(t);
      setNow(t);
    },
  };
}
