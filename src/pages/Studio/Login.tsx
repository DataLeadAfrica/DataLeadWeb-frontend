import { useEffect, useState } from "react";

import "./studio.css";
import { sendMagicLink } from "../../lib/auth";

// Keep the studio out of search indexes: it is a private, gated workspace.
function useNoIndex() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Content Studio | Data-Lead Africa";
    let robots = document.head.querySelector<HTMLMetaElement>(
      'meta[name="robots"]',
    );
    const created = !robots;
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    const prev = robots.getAttribute("content");
    robots.setAttribute("content", "noindex, nofollow");
    return () => {
      document.title = prevTitle;
      if (created && robots && robots.parentNode)
        robots.parentNode.removeChild(robots);
      else if (robots && prev) robots.setAttribute("content", prev);
    };
  }, []);
}

export default function StudioLogin() {
  useNoIndex();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await sendMagicLink(email);
    setMsg({ ok: res.ok, text: res.message });
    setBusy(false);
  }

  return (
    <div className="studio-login">
      <div className="studio-login__card">
        <div className="studio-login__brand">Data-Lead Africa</div>
        <h1>Content Studio</h1>
        <p className="studio-login__lead">
          Sign in with your Data-Lead Africa email. We'll send you a secure
          magic link, no password needed.
        </p>

        {msg && msg.ok ? (
          <div className="studio-login__sent">
            <p>{msg.text}</p>
            <p className="studio-login__hint">
              Open the link on this device to continue.
            </p>
          </div>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="you@dataleadafrica.com"
              aria-label="Email address"
            />
            <button
              className="studio-btn"
              onClick={submit}
              disabled={busy || !email}
            >
              {busy ? "Sending..." : "Send me a magic link"}
            </button>
            {msg && !msg.ok && (
              <p className="studio-login__error">{msg.text}</p>
            )}
            <p className="studio-login__note">
              Only @dataleadafrica.com addresses can sign in. Staff can write
              and submit articles; admins approve them for publishing.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
