import "./PassCard.css";

// Who the person is and what their account can reach, as a card they own
// rather than a line of grey text.
//
// Two versions, and which one shows is decided entirely by the access sync
// on the server, never by anything the browser works out for itself:
//
//   bootcamp  the orange pass, for somebody whose enrolment is active
//   account   the plain card, for everybody else
//
// The plain card is not a lesser version with things missing. It says what
// the account is, and nothing about what it is not.

type Props = {
  name: string;
  email: string;
  /** Learner, Facilitator or Administrator, already in words. */
  role: string;
  bootcamp: boolean;
};

export default function PassCard({ name, email, role, bootcamp }: Props) {
  return (
    <article className={`acad-pass${bootcamp ? " acad-pass--bootcamp" : ""}`}>
      <div className="acad-pass__top">
        <span className="acad-pass__kind">
          {bootcamp ? "Bootcamp pass" : "Academy account"}
        </span>
        <span className="acad-pass__role">{role}</span>
      </div>

      <p className="acad-pass__name">{name}</p>

      <p className="acad-pass__line">
        {bootcamp
          ? "Your bootcamp enrolment is active, so the courses it covers are open to you."
          : "Courses you enrol on will appear in My learning."}
      </p>

      <div className="acad-pass__foot">
        <span>{email}</span>
        <span>{bootcamp ? "Active" : "Signed in"}</span>
      </div>
    </article>
  );
}
