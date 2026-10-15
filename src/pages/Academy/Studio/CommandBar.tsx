import { useEffect, useRef, useState } from "react";

import { ArrowIcon } from "./Icons";

// Ctrl K. Type a few letters, press enter, land on the page.
//
// IT ONLY OFFERS PAGES, and that is a decision rather than a stage.
// Offering courses and learners too would mean a search against the
// database on every keystroke, and for a facilitator it would mean the
// box quietly deciding which results they are allowed to see, which is
// a permission rule in a place nobody would think to check it. The list
// it searches is the rail, which the shell has already filtered by role,
// so the command bar cannot show a way into a page the rail would not.
//
// NO FUZZY MATCHING. "lrn" finding Learners feels clever for a week and
// then surprises somebody into opening Reports. A plain contains, on
// what is typed, is predictable, and predictable is what a keyboard
// shortcut has to be.

type Item = { to: string; label: string; icon: React.ReactNode; group: string };

type Props = {
  items: Item[];
  onClose: () => void;
  onGo: (to: string) => void;
};

export default function CommandBar({ items, onClose, onGo }: Props) {
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    box.current?.focus();
  }, []);

  const needle = q.trim().toLowerCase();
  const hits = needle
    ? items.filter((i) => i.label.toLowerCase().includes(needle))
    : items;

  // Keep the highlight inside the list when the list shortens under it.
  const cursor = Math.min(at, Math.max(hits.length - 1, 0));

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAt((n) => Math.min(n + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAt((n) => Math.max(n - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = hits[cursor];
      if (pick) onGo(pick.to);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <>
      <div className="stu__scrim" onClick={onClose} />
      <div className="stu__cmd" role="dialog" aria-modal="true" aria-label="Find a page">
        <input
          ref={box}
          className="stu__cmdin"
          value={q}
          placeholder="Find a page"
          aria-label="Find a page"
          onChange={(e) => {
            setQ(e.target.value);
            setAt(0);
          }}
          onKeyDown={onKey}
        />
        <ul>
          {hits.length === 0 ? (
            <li>
              <button type="button" disabled>
                Nothing called {q.trim()}
              </button>
            </li>
          ) : (
            hits.map((i, n) => (
              <li key={i.to}>
                <button
                  type="button"
                  className={n === cursor ? "is-on" : ""}
                  onMouseEnter={() => setAt(n)}
                  onClick={() => onGo(i.to)}
                >
                  {i.icon}
                  {i.label}
                  <small>{i.group}</small>
                  <ArrowIcon />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
}
