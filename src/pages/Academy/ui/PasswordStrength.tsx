import "./PasswordStrength.css";
import { MIN_PASSWORD } from "../../../lib/academy";

// Four segments under the password box, filling as the password gets
// harder to guess.
//
// It is a hint, not a gate. The only rule the Academy actually enforces is
// the minimum length, which is checked here, in src/lib/academy.ts, and in
// the Supabase setting. A meter that refused to let somebody continue would
// be a fourth rule that nobody agreed to.
//
// Deliberately not clever: no dictionary, no entropy maths, nothing sent
// anywhere. A password never leaves the box it was typed into.

function strengthOf(password: string): number {
  if (password.length === 0) return 0;
  if (password.length < MIN_PASSWORD) return 1;

  let score = 1;
  if (password.length >= 12) score += 1;
  if (/\d/.test(password) && /[a-z]/i.test(password)) score += 1;
  if (/[^a-z0-9]/i.test(password)) score += 1;
  return Math.min(score, 4);
}

const WORDS = ["", "Too short", "Fair", "Good", "Strong"];

export default function PasswordStrength({ password }: { password: string }) {
  const score = strengthOf(password);

  return (
    <>
      <div className="acad-strength" data-score={score} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <p className="acad-strength__hint">
        <span>At least {MIN_PASSWORD} characters</span>
        {/* Announced politely so a screen reader hears the verdict change
            without the typing being interrupted. */}
        <span aria-live="polite">{WORDS[score]}</span>
      </p>
    </>
  );
}
