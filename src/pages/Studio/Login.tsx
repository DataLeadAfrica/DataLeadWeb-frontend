import { useEffect, useState } from "react";

import "./studio.css";
import { login, registerStaff } from "../../lib/auth";

function useNoIndex() {
  useEffect(() => {
    document.title = "Content Studio | Data-Lead Africa";
    let robots = document.head.querySelector<HTMLMetaElement>(
      'meta[name="robots"]',
    );
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow");
  }, []);
}

export default function StudioLogin() {
  useNoIndex();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // shared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // register-only
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");

  async function submitLogin() {
    setBusy(true);
    setMsg(null);
    const res = await login(email, password);
    if (!res.ok) setMsg({ ok: false, text: res.message });
    setBusy(false);
    // on success, the Studio shell reacts to the auth state change automatically
  }

  async function submitRegister() {
    setBusy(true);
    setMsg(null);
    const res = await registerStaff({
      email,
      password,
      fullName,
      department,
      title,
    });
    setMsg({ ok: res.ok, text: res.message });
    setBusy(false);
  }

  return (
    <div className="studio-login">
      <div className="studio-login__card">
        <div className="studio-login__brand">Data-Lead Africa</div>
        <h1>Content Studio</h1>

        <div className="studio-login__tabs">
          <button
            className={mode === "login" ? "on" : ""}
            onClick={() => {
              setMode("login");
              setMsg(null);
            }}
          >
            Sign in
          </button>
          <button
            className={mode === "register" ? "on" : ""}
            onClick={() => {
              setMode("register");
              setMsg(null);
            }}
          >
            Create account
          </button>
        </div>

        {mode === "register" && (
          <>
            <input
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              aria-label="Full name"
            />
            <input
              placeholder="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              aria-label="Department"
            />
            <input
              placeholder="Title / role"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Title"
            />
          </>
        )}

        <input
          type="email"
          placeholder="you@dataleadafrica.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
        />
        <input
          type="password"
          placeholder={
            mode === "register" ? "Create a password (8+ characters)" : "Password"
          }
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            (mode === "login" ? submitLogin() : submitRegister())
          }
          aria-label="Password"
        />

        <button
          className="studio-btn"
          onClick={mode === "login" ? submitLogin : submitRegister}
          disabled={busy || !email || !password}
        >
          {busy
            ? "Please wait..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>

        {msg && (
          <p
            className={
              msg.ok ? "studio-login__success" : "studio-login__error"
            }
          >
            {msg.text}
          </p>
        )}

        <p className="studio-login__note">
          Only @dataleadafrica.com addresses can register. Staff can write and
          submit articles; admins approve them for publishing.
        </p>
      </div>
    </div>
  );
}
