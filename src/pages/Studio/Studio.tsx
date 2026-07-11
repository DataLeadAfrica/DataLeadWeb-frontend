import { useEffect, useState } from "react";

import "./studio.css";
import { supabase } from "../../lib/supabase";
import { getCurrentEmail, isAdminEmail, signOut } from "../../lib/auth";
import StudioLogin from "./Login";
import Editor from "./Editor";

export default function Studio() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [view, setView] = useState<"home" | "write">("home");

  useEffect(() => {
    let robots = document.head.querySelector<HTMLMetaElement>(
      'meta[name="robots"]',
    );
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow");
    document.title = "Content Studio | Data-Lead Africa";

    getCurrentEmail().then((e) => {
      setEmail(e);
      setLoading(false);
      if (e) loadName();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const e = session?.user?.email ?? null;
      setEmail(e);
      if (e) loadName();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadName() {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", uid)
      .maybeSingle();
    if (prof?.full_name) setName(prof.full_name);
  }

  if (loading) return <div className="studio-loading">Loading...</div>;
  if (!email) return <StudioLogin />;

  const admin = isAdminEmail(email);

  if (view === "write") {
    return (
      <Editor
        authorEmail={email}
        authorName={name}
        onDone={() => setView("home")}
      />
    );
  }

  return (
    <div className="studio">
      <div className="studio__bar">
        <b>Data-Lead Africa</b>
        <span className="studio__bar-sub">Content Studio</span>
        <span className="studio__who">
          {name || email}
          <span className="studio__role">{admin ? "Admin" : "Staff"}</span>
        </span>
        <button className="studio__signout" onClick={() => signOut()}>
          Sign out
        </button>
      </div>

      <div className="studio__home">
        <h1>
          Welcome{name ? ", " + name.split(" ")[0] : ""}.
        </h1>
        <p className="studio__home-lead">
          {admin
            ? "You can write articles and approve submissions from staff."
            : "Write an article and submit it for review. An admin approves before it goes live."}
        </p>
        <div className="studio__cards">
          <button className="studio__card" onClick={() => setView("write")}>
            <span className="studio__card-icon">&#9998;</span>
            <span className="studio__card-title">Write an article</span>
            <span className="studio__card-sub">
              Compose, add images, and submit for review
            </span>
          </button>
          {admin && (
            <div className="studio__card studio__card--soon">
              <span className="studio__card-icon">&#9745;</span>
              <span className="studio__card-title">Approval queue</span>
              <span className="studio__card-sub">Coming in the next step</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
