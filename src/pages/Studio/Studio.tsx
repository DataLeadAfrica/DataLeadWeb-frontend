import { useEffect, useState } from "react";

import "./studio.css";
import { supabase } from "../../lib/supabase";
import { getCurrentEmail, isAdminEmail, signOut } from "../../lib/auth";
import StudioLogin from "./Login";

export default function Studio() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // set noindex for the whole studio
    let robots = document.head.querySelector<HTMLMetaElement>(
      'meta[name="robots"]',
    );
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow");

    getCurrentEmail().then((e) => {
      setEmail(e);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="studio-loading">Loading...</div>;
  }

  if (!email) {
    return <StudioLogin />;
  }

  const admin = isAdminEmail(email);

  return (
    <div className="studio">
      <div className="studio__bar">
        <b>Data-Lead Africa</b>
        <span className="studio__bar-sub">Content Studio</span>
        <span className="studio__who">
          {email}
          <span className="studio__role">{admin ? "Admin" : "Staff"}</span>
        </span>
        <button className="studio__signout" onClick={() => signOut()}>
          Sign out
        </button>
      </div>

      <div className="studio__placeholder">
        <h1>You're signed in.</h1>
        <p>
          Welcome, {email}. You are signed in as{" "}
          <strong>{admin ? "an admin" : "staff"}</strong>.
        </p>
        <p className="studio__placeholder-note">
          The writing editor and approval queue are coming in the next steps.
        </p>
      </div>
    </div>
  );
}
