import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import { CardIcon } from "../Icons";
import { Done, Head, Problem, Stat, Waiting } from "../ui";
import {
  cardsForPrint,
  getRoster,
  issueCardsForCohort,
  listCohorts,
  markCardLost,
  type PrintableCard,
  type RosterRow,
} from "../../../../lib/attendance";

// Issuing and printing the ID cards.
//
// THE QR HOLDS THE TOKEN AND NOTHING ELSE. Not a web address. A QR
// carrying a link would turn a lost card into a working door into the
// system for whoever picked it up, and would let somebody print a card
// pointing at a copy of our site. A bare token does nothing at all in
// an ordinary camera app: it comes up as a line of letters and numbers,
// which is the point.
//
// THE TOKENS ARE NEVER HELD LONGER THAN THE PRINT. They are read when
// the sheet is asked for and thrown away when the screen is left.
// Nothing writes them to storage, nothing puts them in the address bar,
// and the sheet is drawn in the page rather than made into a file, so
// no copy of them ends up in a downloads folder.
//
// NO PHOTOGRAPH. That was asked for, considered and declined for now:
// the card carries a name, a cohort and a number. The scanner shows the
// name back to the person holding it, which is how the face gets
// checked.
//
// THE DEPENDENCY IS ONE THE SITE ALREADY HAS. qrcode-generator draws
// the certificate QR on the public showcase page, so drawing one here
// adds nothing to the site's weight and needs nobody's approval.
// READING a QR with a camera is a different job and a different
// library, and that is the one still waiting on Dr Ayoola.

function Inner() {
  const [cohorts, setCohorts] = useState<string[] | null>(null);
  const [cohort, setCohort] = useState("");
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [sheet, setSheet] = useState<PrintableCard[] | null>(null);
  const [busy, setBusy] = useState("");
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    let alive = true;
    listCohorts().then((a) => {
      if (!alive) return;
      if (!a.ok) {
        setProblem(a.message);
        setCohorts([]);
        return;
      }
      const names = a.data.map((c) => c.cohort);
      setCohorts(names);
      setCohort((c) => c || names[0] || "");
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!cohort) return;
    let alive = true;
    // THE TOKENS GO when the cohort changes. They are the one secret
    // this screen ever holds and it holds them for as short a time as
    // it can.
    setSheet(null);
    setRoster(null);
    setDone("");
    getRoster(cohort).then((a) => {
      if (!alive) return;
      if (a.ok) setRoster(a.data);
      else setProblem(a.message);
    });
    return () => {
      alive = false;
    };
  }, [cohort]);

  async function reload() {
    const a = await getRoster(cohort);
    if (a.ok) setRoster(a.data);
  }

  async function onIssue() {
    setBusy("issue");
    setProblem("");
    const a = await issueCardsForCohort(cohort);
    setBusy("");
    if (!a.ok) {
      setProblem(a.message);
      return;
    }
    setDone(
      a.data === 0
        ? "Everybody in this cohort already has a card. Nothing was made, which is what should happen: a second card would stop the first one working."
        : `${a.data} card${a.data === 1 ? "" : "s"} issued. Print the sheet and hand them out.`,
    );
    reload();
  }

  async function onPrint() {
    setBusy("sheet");
    setProblem("");
    const a = await cardsForPrint(cohort);
    setBusy("");
    if (!a.ok) {
      setProblem(a.message);
      return;
    }
    setSheet(a.data);
  }

  async function onLost(p: RosterRow) {
    setBusy(p.participant_id);
    setProblem("");
    const a = await markCardLost(p.participant_id);
    setBusy("");
    if (!a.ok) {
      setProblem(a.message);
      return;
    }
    setDone(
      `${p.full_name}'s old card stopped working the moment you pressed that. ${a.data} is still their number, so print the sheet again and hand them a new card with the same number on it.`,
    );
    setSheet(null);
    reload();
  }

  const noCard = useMemo(
    () => (roster || []).filter((r) => !r.has_card).length,
    [roster],
  );
  const noAccount = useMemo(
    () => (roster || []).filter((r) => !r.has_account).length,
    [roster],
  );

  if (cohorts === null) return <Waiting what="the cohorts" />;

  return (
    <>
      <Seo title="ID cards | Control room" noindex />

      <Head
        eyebrow="People"
        title="ID cards"
        sub="A number people can read and a secret the QR carries. The number is printed on the front; the secret is only ever inside the code."
        actions={
          <button
            type="button"
            className="stu__chip"
            disabled={busy === "sheet" || !roster || roster.length === 0}
            onClick={onPrint}
          >
            <CardIcon />
            {busy === "sheet" ? "Reading" : "Make the print sheet"}
          </button>
        }
      />

      <div className="stu__chips stu-att__cohorts">
        {cohorts.map((c) => (
          <button
            key={c}
            type="button"
            className="stu__chip"
            aria-pressed={c === cohort}
            onClick={() => setCohort(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <Problem>{problem}</Problem>
      <Done>{done}</Done>

      {!roster ? (
        <Waiting what="the cohort" />
      ) : roster.length === 0 ? (
        <div className="stu__empty">Nobody is actively enrolled in {cohort}.</div>
      ) : (
        <>
          <div className="stu__grid stu__g4" style={{ marginBottom: 20 }}>
            <Stat label="In this cohort" value={roster.length} />
            <Stat label="Holding a card" value={roster.length - noCard} />
            <Stat label="Still waiting" value={noCard} />
            <Stat
              label="No Academy account"
              value={noAccount}
              note={noAccount > 0 ? "A card will not scan without one" : undefined}
            />
          </div>

          {noCard > 0 ? (
            <div className="stu__panel stu-att__open">
              <header>
                <h2>
                  {noCard} {noCard === 1 ? "person has" : "people have"} no card yet
                </h2>
              </header>
              <div className="stu-att__openbody">
                <p className="stu__hint">
                  Each one gets a number like DLA-26-7K4QP and a secret of their
                  own. Pressing this twice is safe: anybody already holding a
                  card keeps the one they have.
                </p>
                <button
                  type="button"
                  className="stu__chip stu-att__big"
                  disabled={busy === "issue"}
                  onClick={onIssue}
                >
                  {busy === "issue" ? "Issuing" : `Issue ${noCard} card${noCard === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          ) : null}

          {/* --------------------------------------------- the sheet */}
          {sheet && sheet.length > 0 ? (
            <div className="stu__panel stu-card__sheetwrap">
              <header>
                <h2>The print sheet</h2>
                <button type="button" className="stu__chip" onClick={() => window.print()}>
                  Print
                </button>
              </header>
              <p className="stu__hint stu-card__advice">
                Sized for an ordinary laminating pouch, eight to a page. Print
                it, cut along the lines and laminate. Close this screen when you
                are done: the secrets are only here while it is open.
              </p>

              <div className="stu-card__sheet">
                {sheet.map((c) => (
                  <Card key={c.participant_id} card={c} />
                ))}
              </div>
            </div>
          ) : null}

          {/* --------------------------------------------- the people */}
          <div className="stu__panel">
            <header>
              <h2>Everybody in {cohort}</h2>
            </header>
            <div className="stu__scroll">
              <table className="stu__table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Card number</th>
                    <th>Account</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr key={r.participant_id}>
                      <td>{r.full_name}</td>
                      <td style={{ fontFamily: "var(--acad-f-mono)", fontSize: 12.5 }}>
                        {r.participant_no || "-"}
                        {r.replaced_count > 0 ? (
                          <small className="stu-reg__no">
                            replaced {r.replaced_count}{" "}
                            {r.replaced_count === 1 ? "time" : "times"}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        {r.has_account ? (
                          <span className="stu__tag is-live">Linked</span>
                        ) : (
                          <span className="stu__tag is-bad">None yet</span>
                        )}
                      </td>
                      <td>
                        {r.has_card ? (
                          <button
                            type="button"
                            className="stu__chip"
                            disabled={busy === r.participant_id}
                            onClick={() => onLost(r)}
                          >
                            {busy === r.participant_id ? "Replacing" : "Mark card lost"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="stu__hint">
              Marking a card lost replaces the secret and keeps the number, so
              the old card stops working the instant you press it and the
              person's paperwork does not change.
            </p>
          </div>
        </>
      )}
    </>
  );
}

/** One card, with its QR drawn as a single path. */
function Card({ card }: { card: PrintableCard }) {
  const qr = useMemo(() => {
    // Error correction M: enough to survive a scuffed laminate, without
    // making the modules so small that a cheap phone camera struggles.
    const q = qrcode(0, "M");
    // THE TOKEN, BARE. No address, no prefix, nothing that means
    // anything to a camera app that is not ours.
    q.addData(card.card_token);
    q.make();
    const n = q.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      }
    }
    return { n, d };
  }, [card.card_token]);

  return (
    <article className="stu-card">
      <div className="stu-card__top">
        <b>Data-Lead Academy</b>
        <span>{card.cohort}</span>
      </div>
      <div className="stu-card__mid">
        <svg
          className="stu-card__qr"
          viewBox={`0 0 ${qr.n} ${qr.n}`}
          role="img"
          aria-label={`The code for ${card.full_name}`}
        >
          <path d={qr.d} />
        </svg>
        <div className="stu-card__who">
          <b>{card.full_name}</b>
          <span className="stu-card__no">{card.participant_no}</span>
        </div>
      </div>
      <p className="stu-card__foot">
        Found this card? Please return it to Data-Lead Africa, Abuja.
      </p>
    </article>
  );
}

export default function StudioCardsPage() {
  return <RequireStaff adminOnly>{() => <Inner />}</RequireStaff>;
}
