import { useEffect, useState } from "react";

import RequireStaff from "../RequireStaff";
import Seo from "../../../../components/Seo/component";
import { OutIcon, WarnIcon } from "../Icons";
import { Done, Head, Problem } from "../ui";
import { setSiteSettings } from "../../../../lib/studio";
import { certDb } from "../../../../lib/certificates";
import { routes } from "../../../routes";

// The words on the landing page.
//
// A CHANGE HERE SHOWS ON THE SITE WITH NO RELEASE. That is the whole
// point of keeping them in lms_settings rather than in the code: the
// headline should not need a deployment and a person who can write
// cannot be made to wait for one.
//
// WHICH IS ALSO WHY THE TITLE AND THE DESCRIPTION ARE NOT HERE. Those
// are what a search engine reads, they are in api/_seo-rules.js, and a
// mistyped one would quietly move the Academy down the results for
// weeks. The headline is what a person reads, and a mistyped one is
// noticed and fixed in a minute.

function Inner() {
  const [headline, setHeadline] = useState("");
  const [subhead, setSubhead] = useState("");
  const [announceOn, setAnnounceOn] = useState(false);
  const [announceText, setAnnounceText] = useState("");
  const [welcomeRef, setWelcomeRef] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");

  // READ HERE RATHER THAN THROUGH lib/catalogue's getSettings, which is
  // the LEARNER side's read and deliberately selects four columns. The
  // welcome video is a fifth, and widening that function would add bytes
  // to a public page so that a staff form could have a field.
  useEffect(() => {
    if (!certDb) {
      setLoaded(true);
      return;
    }
    certDb
      .from("lms_settings")
      .select("headline, subhead, announce_on, announce_text, welcome_ref")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setHeadline(data.headline || "");
          setSubhead(data.subhead || "");
          setAnnounceOn(Boolean(data.announce_on));
          setAnnounceText(data.announce_text || "");
          setWelcomeRef(data.welcome_ref || "");
        }
        setLoaded(true);
      });
  }, []);

  async function save() {
    setProblem("");
    setDone("");
    const got = await setSiteSettings({
      headline,
      subhead,
      announceOn,
      announceText,
      welcomeProvider: welcomeRef ? "youtube" : undefined,
      welcomeRef: welcomeRef || undefined,
    });
    if (got.ok) setDone("Saved. It is on the site now, with no release needed.");
    else setProblem(got.message);
  }

  if (!loaded) return null;

  return (
    <>
      <Seo title="Site settings | Control room" noindex />

      <Head
        eyebrow="Site"
        title="Site settings"
        sub="The words on the Academy's front page. A change here is live straight away."
        actions={
          <a className="stu__chip" href={routes.academy} target="_blank" rel="noreferrer">
            See the page
            <OutIcon />
          </a>
        }
      />

      <div className="stu__grid stu__g2">
        <section className="stu__panel">
          <header>
            <h3>The landing page</h3>
          </header>
          <div className="stu__grid">
            <label className="stu__field">
              <span>Headline</span>
              <input
                className="stu__in"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
              <small>The last word is drawn in orange, whatever it is.</small>
            </label>
            <label className="stu__field">
              <span>The line under it</span>
              <textarea
                className="stu__in"
                rows={4}
                value={subhead}
                onChange={(e) => setSubhead(e.target.value)}
              />
            </label>
            <label className="stu__field">
              <span>Welcome video</span>
              <input
                className="stu__in"
                value={welcomeRef}
                placeholder="YouTube link or id"
                onChange={(e) => setWelcomeRef(e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="stu__panel">
          <header>
            <h3>The announcement line</h3>
            <span className="stu__label">Off by default</span>
          </header>
          <div className="stu__grid">
            <label className="stu__field" style={{ flexDirection: "row", gap: 10 }}>
              <input
                type="checkbox"
                checked={announceOn}
                onChange={(e) => setAnnounceOn(e.target.checked)}
              />
              <span>Show it</span>
            </label>
            <label className="stu__field">
              <span>What it says</span>
              <input
                className="stu__in"
                value={announceText}
                onChange={(e) => setAnnounceText(e.target.value)}
                placeholder="Enrolment for the October cohort closes on Friday."
              />
              <small>
                An announcement that is on and says nothing is a band of empty colour across the
                top of the site, which looks like a fault, so the database refuses it.
              </small>
            </label>
            {announceOn ? (
              <p className="stu__msg is-warn">
                <WarnIcon />
                <span>This appears above every Academy page, for everybody.</span>
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="stu__grid" style={{ marginTop: 18, gap: 10 }}>
        <Problem>{problem}</Problem>
        <Done>{done}</Done>
        <button type="button" className="acad-btn" style={{ justifySelf: "start" }} onClick={save}>
          Save the settings
        </button>
        <p className="stu__hint">
          Every change is recorded with what it said before and what it says now.
        </p>
      </div>
    </>
  );
}

export default function StudioSettingsPage() {
  return <RequireStaff adminOnly>{() => <Inner />}</RequireStaff>;
}
