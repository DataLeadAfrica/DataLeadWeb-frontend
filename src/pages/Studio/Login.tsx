import { useEffect, useState } from "react";

import "./studio.css";
import { login, registerStaff, resetPassword } from "../../lib/auth";

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

type Mode = "login" | "register" | "reset";

export default function StudioLogin() {
  useNoIndex();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");

  function switchMode(m: Mode) {
    setMode(m);
    setMsg(null);
  }

  async function submitLogin() {
    setBusy(true);
    setMsg(null);
    const res = await login(email, password);
    if (!res.ok) setMsg({ ok: false, text: res.message });
    setBusy(false);
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

  async function submitReset() {
    setBusy(true);
    setMsg(null);
    const res = await resetPassword(email);
    setMsg({ ok: res.ok, text: res.message });
    setBusy(false);
  }

  return (
    <div className="studio-login">
      <div className="studio-login__card">
        <div className="studio-login__brand">Data-Lead Africa</div>
        <h1>Content Studio</h1>

        {mode !== "reset" && (
          <div className="studio-login__tabs">
            <button
              className={mode === "login" ? "on" : ""}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>
            <button
              className={mode === "register" ? "on" : ""}
              onClick={() => switchMode("register")}
            >
              Sign up
            </button>
          </div>
        )}

        {mode === "register" && (
          <p className="studio-login__lead">
            Sign up, write and submit your articles.
          </p>
        )}

        {mode === "reset" && (
          <p className="studio-login__lead">
            Enter your email and we'll send you a link to reset your password.
          </p>
        )}

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

        {mode !== "reset" && (
          <input
            type="password"
            placeholder={
              mode === "register"
                ? "Create a password (8+ characters)"
                : "Password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              (mode === "login" ? submitLogin() : submitRegister())
            }
            aria-label="Password"
          />
        )}

        <button
          className="studio-btn"
          onClick={
            mode === "login"
              ? submitLogin
              : mode === "register"
                ? submitRegister
                : submitReset
          }
          disabled={busy || !email || (mode !== "reset" && !password)}
        >
          {busy
            ? "Please wait..."
            : mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Sign up"
                : "Send reset link"}
        </button>

        {msg && (
          <p className={msg.ok ? "studio-login__success" : "studio-login__error"}>
            {msg.text}
          </p>
        )}

        {mode === "login" && (
          <button
            className="studio-login__forgot"
            onClick={() => switchMode("reset")}
          >
            Forgot password?
          </button>
        )}
        {mode === "reset" && (
          <button
            className="studio-login__forgot"
            onClick={() => switchMode("login")}
          >
            &larr; Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
