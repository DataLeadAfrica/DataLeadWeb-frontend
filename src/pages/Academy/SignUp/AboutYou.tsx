import { AskSection, Box, Chips, Pick } from "../ui/Ask";
import {
  AGE_BANDS,
  COUNTRIES,
  DISABILITY,
  EDUCATION,
  GENDERS,
  GOALS,
  HEARD_FROM,
  NG_STATES,
  OCCUPATIONS,
  QUALIFICATIONS,
  SECTORS,
  STUDY_LEVELS,
  nyscOffered,
  sectorLabel,
  shows,
  type Answers,
} from "./answers.js";

// The About you half of the sign up form.
//
// ONE FORM, BEFORE THE EMAIL CODE. Everything is asked once, in four
// short sections, and then the code screen is the only thing between
// here and an account. The alternative, asking afterwards, is a form
// nobody fills in: the person already has what they came for.
//
// WHICH QUESTIONS APPEAR IS NOT DECIDED HERE. shows() in answers.js
// decides, and the database says the same thing again in its check
// constraints, so a question that does not apply is null in the table
// however the row got there. This file only draws what shows() allows,
// and a question that is not drawn is not in the form at all: not
// disabled and hidden, not rendered. So there is nothing to send and
// nothing to check.
//
// A CHANGE OF ANSWER CLEARS WHAT IT HID. Somebody who says tertiary,
// types a course of study, then changes to secondary, must not have
// that course of study sent. The parent owns the answers, so the
// clearing is done there, in one place, by set().

type Props = {
  a: Answers;
  set: (patch: Partial<Answers>) => void;
  /** The one field the one message is about, or "". */
  badField: string;
  errorId: string;
  disabled?: boolean;
};

export default function AboutYou({ a, set, badField, errorId, disabled }: Props) {
  const bad = (field: string) => badField === field;
  const describe = (field: string) => (bad(field) ? errorId : undefined);

  // The NYSC option is only offered where it exists and to the ages it
  // can apply to. It is taken out of the list rather than shown and
  // refused: an option you can choose and are then told off for is a
  // trap, and this one is not a judgement about the person, it is a
  // fact about the scheme.
  const occupations = OCCUPATIONS.filter(
    ([value]) => value !== "nysc" || nyscOffered(a),
  );

  return (
    <>
      <AskSection title="Where you live">
        <Pick
          label="Country"
          value={a.country || ""}
          onChange={(v) => set({ country: v })}
          options={COUNTRIES}
          placeholder="Choose your country"
          invalid={bad("country")}
          describedBy={describe("country")}
          disabled={disabled}
        />

        {shows("state", a) ? (
          <Pick
            label="State"
            value={a.state || ""}
            onChange={(v) => set({ state: v })}
            options={NG_STATES}
            placeholder="Choose your state"
            invalid={bad("state")}
            describedBy={describe("state")}
            disabled={disabled}
          />
        ) : null}

        {shows("region", a) ? (
          <Box
            label="State or region"
            value={a.region || ""}
            onChange={(v) => set({ region: v })}
            maxLength={80}
            invalid={bad("region")}
            describedBy={describe("region")}
            disabled={disabled}
          />
        ) : null}

        <Box
          label="City or town"
          value={a.city || ""}
          onChange={(v) => set({ city: v })}
          maxLength={80}
          autoComplete="address-level2"
          invalid={bad("city")}
          describedBy={describe("city")}
          disabled={disabled}
        />

        {shows("postal_code", a) ? (
          <Box
            label="Postal code"
            value={a.postal_code || ""}
            onChange={(v) => set({ postal_code: v.replace(/\D/g, "").slice(0, 6) })}
            maxLength={6}
            inputMode="numeric"
            autoComplete="postal-code"
            hint="Nigeria uses 6 digits."
            invalid={bad("postal_code")}
            describedBy={describe("postal_code")}
            disabled={disabled}
          />
        ) : null}
      </AskSection>

      <AskSection title="You">
        <Pick
          label="Age"
          value={a.age_band || ""}
          onChange={(v) => set({ age_band: v })}
          options={AGE_BANDS}
          invalid={bad("age_band")}
          describedBy={describe("age_band")}
          disabled={disabled}
        />
        <Pick
          label="Gender"
          value={a.gender || ""}
          onChange={(v) => set({ gender: v })}
          options={GENDERS}
          invalid={bad("gender")}
          describedBy={describe("gender")}
          disabled={disabled}
        />
      </AskSection>

      <AskSection title="Education">
        <Pick
          label="Highest level of education"
          value={a.education_level || ""}
          onChange={(v) => set({ education_level: v })}
          options={EDUCATION}
          invalid={bad("education_level")}
          describedBy={describe("education_level")}
          disabled={disabled}
        />

        {shows("qualification", a) ? (
          <Pick
            label="Highest qualification"
            value={a.qualification || ""}
            onChange={(v) => set({ qualification: v })}
            options={QUALIFICATIONS}
            invalid={bad("qualification")}
            describedBy={describe("qualification")}
            disabled={disabled}
          />
        ) : null}

        {shows("course_of_study", a) ? (
          <Box
            label="Course of study"
            value={a.course_of_study || ""}
            onChange={(v) => set({ course_of_study: v })}
            maxLength={120}
            invalid={bad("course_of_study")}
            describedBy={describe("course_of_study")}
            disabled={disabled}
          />
        ) : null}

        {shows("trade", a) ? (
          <Box
            label="What did you train in?"
            value={a.trade || ""}
            onChange={(v) => set({ trade: v })}
            maxLength={120}
            invalid={bad("trade")}
            describedBy={describe("trade")}
            disabled={disabled}
          />
        ) : null}
      </AskSection>

      <AskSection title="Work">
        <Pick
          label="Right now you are"
          value={a.occupation || ""}
          onChange={(v) => set({ occupation: v })}
          options={occupations}
          invalid={bad("occupation")}
          describedBy={describe("occupation")}
          disabled={disabled}
        />

        {shows("job_title", a) ? (
          <Box
            label="Job title"
            value={a.job_title || ""}
            onChange={(v) => set({ job_title: v })}
            maxLength={120}
            autoComplete="organization-title"
            invalid={bad("job_title")}
            describedBy={describe("job_title")}
            disabled={disabled}
          />
        ) : null}

        {shows("business", a) ? (
          <Box
            label="What does your business do?"
            value={a.business || ""}
            onChange={(v) => set({ business: v })}
            maxLength={120}
            invalid={bad("business")}
            describedBy={describe("business")}
            disabled={disabled}
          />
        ) : null}

        {shows("study_level", a) ? (
          <Pick
            label="What are you studying for?"
            value={a.study_level || ""}
            onChange={(v) => set({ study_level: v })}
            options={STUDY_LEVELS}
            invalid={bad("study_level")}
            describedBy={describe("study_level")}
            disabled={disabled}
          />
        ) : null}

        {shows("school", a) ? (
          <Box
            label="School"
            value={a.school || ""}
            onChange={(v) => set({ school: v })}
            maxLength={120}
            invalid={bad("school")}
            describedBy={describe("school")}
            disabled={disabled}
          />
        ) : null}

        {shows("sector", a) ? (
          // The question changes with the answer above it. A corps
          // member is asked about their place of primary assignment,
          // somebody looking for work about where they want to be.
          // Asking all four "Sector" would be asking four different
          // questions in the same words.
          <Pick
            label={sectorLabel(a.occupation)}
            value={a.sector || ""}
            onChange={(v) => set({ sector: v })}
            options={SECTORS}
            invalid={bad("sector")}
            describedBy={describe("sector")}
            disabled={disabled}
          />
        ) : null}
      </AskSection>

      <AskSection title="Disability status">
        <div className="acad-ask--wide">
          <Chips
            label="Do you have a disability?"
            value={a.disability || ""}
            onChange={(v: never) => set({ disability: v })}
            options={DISABILITY}
            invalid={bad("disability")}
            describedBy={describe("disability")}
            disabled={disabled}
          />
        </div>

        {shows("disability_detail", a) ? (
          <div className="acad-ask--wide">
            <Box
              label="Please specify"
              value={a.disability_detail || ""}
              onChange={(v) => set({ disability_detail: v })}
              maxLength={200}
              invalid={bad("disability_detail")}
              describedBy={describe("disability_detail")}
              disabled={disabled}
            />
          </div>
        ) : null}

        {/* These two sit under the same heading with none of their own,
            which is the design. They are not about disability; the
            heading is simply the last one and these are the last two
            questions. */}
        <Pick
          label="How did you hear about us?"
          value={a.heard_from || ""}
          onChange={(v) => set({ heard_from: v })}
          options={HEARD_FROM}
          invalid={bad("heard_from")}
          describedBy={describe("heard_from")}
          disabled={disabled}
        />

        <div className="acad-ask--wide">
          <Chips
            label="What do you want to do?"
            note="Up to two"
            value={a.goals || []}
            onChange={(v: never) => set({ goals: v })}
            options={GOALS}
            max={2}
            invalid={bad("goals")}
            describedBy={describe("goals")}
            disabled={disabled}
          />
        </div>
      </AskSection>
    </>
  );
}
