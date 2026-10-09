import "./Pitch.css";
import { PlayIcon, SealIcon, TickIcon } from "./ui/Icons";

// The left hand side of every account page: who this is, in as few words
// as it can be said, and the three steps the Academy is made of.
//
// Watch, Check, Certify is not marketing. It is the actual shape of a
// course: watch the lesson, answer a short question, and the certificate
// at the end can be checked by anyone at dataleadafrica.com/verify. Saying
// it before somebody signs up means nothing about how it works is a
// surprise afterwards.
//
// What it deliberately does NOT say: anything about who gets what for
// free, or about which address to use. That belongs after sign in, where
// the pass card says it from the server's own answer rather than as a
// promise made to a stranger.
//
// On a narrow screen the three steps drop away and the headline and the
// line under it carry the page, so a phone opens straight onto the form.

type Props = {
  headline: React.ReactNode;
  lead: string;
  /** Watch, Check, Certify. Off on the pages where the card is the point. */
  showPath?: boolean;
};

export default function Pitch({ headline, lead, showPath = true }: Props) {
  return (
    <div className="acad-pitch">
      <p className="acad-eyebrow">
        <i />
        Data-Lead Academy
      </p>

      <h1 className="acad-h1">{headline}</h1>
      <p className="acad-lead">{lead}</p>

      {showPath ? (
        <ul className="acad-path">
          <li>
            <PlayIcon />
            <span>
              <b>Watch</b>
              Every lesson, no skipping the first time.
            </span>
          </li>
          <li>
            <TickIcon />
            <span>
              <b>Check</b>A short question before the next lesson opens.
            </span>
          </li>
          <li>
            <SealIcon />
            <span>
              <b>Certify</b>Checked at dataleadafrica.com/verify
            </span>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
