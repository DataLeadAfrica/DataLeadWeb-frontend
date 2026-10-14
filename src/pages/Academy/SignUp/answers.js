// The sign up answers: the lists the form offers, which questions it
// asks, and whether what came back is usable.
//
// THIS IS THE ONE COPY OF THE RULES. The form imports it, and
// tests/signup-answers.test.mjs runs it in plain Node. Plain JavaScript
// with a .d.ts beside it, the same pattern as
// src/pages/Academy/Learn/Player/slices.js, because a rule written
// twice is a rule that will disagree with itself.
//
// THE DATABASE SAYS ALL OF THIS AGAIN, in check constraints on
// lms_learner_profiles in database/lms/16_restructure.sql. That is on
// purpose and not a duplication to tidy away:
//
//   here, so the form is pleasant: a question that does not apply is
//   never shown, and the person is told one thing at a time
//
//   there, so the data is true: a browser with JavaScript off, a
//   replayed request or a staff screen written in a hurry cannot put a
//   degree on somebody with no formal education
//
// A test reads the SQL and fails if the two ever stop agreeing.

/** Nigeria first, then A to Z. */
export const COUNTRIES = [ "Nigeria", "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "C\u00f4te d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "S\u00e3o Tom\u00e9 and Pr\u00edncipe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe" ];

/** The 36 states and the Federal Capital Territory. */
export const NG_STATES = [ "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara" ];

export const AGE_BANDS = [
  ["u18", "Under 18"],
  ["18", "18 to 24"],
  ["25", "25 to 34"],
  ["35", "35 to 44"],
  ["45", "45 to 54"],
  ["55", "55 or older"],
  ["pn", "Prefer not to say"],
];

export const GENDERS = ["Female", "Male", "Prefer not to say"];

export const EDUCATION = [
  ["none", "No formal education"],
  ["primary", "Primary school"],
  ["secondary", "Secondary school"],
  ["vocational", "Vocational or technical training"],
  ["tertiary", "Tertiary institution"],
];

export const QUALIFICATIONS = [
  ["ond", "OND"],
  ["nce", "NCE"],
  ["hnd", "HND"],
  ["bsc", "Bachelor's degree"],
  ["pgd", "Postgraduate diploma"],
  ["msc", "Master's degree"],
  ["phd", "Doctorate"],
];

/** NYSC is for these. An OND or an NCE is not enough. */
export const NYSC_QUALIFICATIONS = ["hnd", "bsc", "pgd", "msc", "phd"];

/** NYSC does not exist for these age bands. It closes at 30. */
export const NYSC_BLOCKED_AGES = ["u18", "35", "45", "55"];

export const OCCUPATIONS = [
  ["employed", "Employed"],
  ["self", "Self employed"],
  ["student", "A student"],
  ["nysc", "A corps member (NYSC)"],
  ["seeking", "Looking for work"],
  ["none", "Not working right now"],
];

export const STUDY_LEVELS = [
  "Secondary school", "OND or NCE", "HND", "Bachelor's degree", "Postgraduate",
];

export const SECTORS = [
  "Research, monitoring and evaluation", "Health", "Education", "Government",
  "NGO or development", "Banking and finance", "Tech", "Agriculture",
  "Trade and retail", "Another sector",
];

export const HEARD_FROM = [
  "A friend", "WhatsApp", "Instagram", "LinkedIn",
  "A Data-Lead bootcamp", "Google", "My school or employer",
];

export const GOALS = [
  ["job", "Get a job in data"],
  ["work", "Do my current job better"],
  ["research", "Research or a thesis"],
  ["biz", "Run my business with data"],
];

export const DISABILITY = [
  ["yes", "Yes"],
  ["no", "No"],
  ["pn", "Prefer not to say"],
];

/** The label on the sector question, which changes with the answer above it. */
export function sectorLabel(occupation) {
  return {
    employed: "Sector you work in",
    self: "Sector your business is in",
    nysc: "Sector of your place of primary assignment",
    seeking: "Sector you want to work in",
  }[occupation] || "Sector";
}

/** Is NYSC even an option for this person? */
export function nyscOffered(a) {
  return a.country === "Nigeria" && !NYSC_BLOCKED_AGES.includes(a.age_band || "");
}

/**
 * Does the form ask this question, given what has been answered so far?
 *
 * A question that is not asked is never sent and never checked. This is
 * the whole of the skip logic, in one place, so the form and the tests
 * cannot drift.
 */
export function shows(field, a) {
  const ng = a.country === "Nigeria";
  switch (field) {
    case "state":           return ng;
    case "region":          return Boolean(a.country) && !ng;
    case "postal_code":     return ng;
    case "qualification":
    case "course_of_study": return a.education_level === "tertiary";
    case "trade":           return a.education_level === "vocational";
    case "job_title":       return a.occupation === "employed";
    case "business":        return a.occupation === "self";
    case "study_level":
    case "school":          return a.occupation === "student";
    case "sector":          return ["employed", "self", "nysc", "seeking"].includes(a.occupation);
    case "disability_detail": return a.disability === "yes";
    default:                return true;
  }
}

/** Everything the form asks, in the order it asks it. */
const ORDER = [
  "full_name", "email", "password",
  "country", "state", "region", "city", "postal_code",
  "age_band", "gender",
  "education_level", "qualification", "course_of_study", "trade",
  "occupation", "job_title", "business", "study_level", "school", "sector",
  "disability", "disability_detail",
  "heard_from", "goals", "consent",
];

const LABEL = {
  full_name: "your full name", email: "your email address",
  password: "a password", country: "the country you live in",
  state: "your state", region: "your state or region",
  city: "your city or town", postal_code: "your postal code",
  age_band: "your age", gender: "your gender",
  education_level: "your highest level of education",
  qualification: "your highest qualification", course_of_study: "your course of study",
  trade: "what you trained in", occupation: "what you are doing right now",
  job_title: "your job title", business: "what your business does",
  study_level: "what you are studying for", school: "your school",
  sector: "a sector", disability: "an answer about disability",
  disability_detail: "what to note about it", heard_from: "how you heard about us",
  goals: "at least one thing you want to do",
};

/**
 * The first thing wrong, or null.
 *
 * ONE AT A TIME, on purpose. A wall of red the moment somebody presses
 * the button tells them they have failed at everything. One message,
 * with that field outlined, tells them what to do next.
 */
export function firstProblem(a) {
  for (const field of ORDER) {
    if (field !== "full_name" && field !== "email" && field !== "password"
        && field !== "consent" && !shows(field, a)) {
      continue;
    }
    const v = a[field];

    if (field === "password") {
      if (!v || String(v).length < 8) {
        return { field, message: "Your password needs at least 8 characters." };
      }
      continue;
    }
    if (field === "email") {
      if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) {
        return { field, message: "Check your email address." };
      }
      continue;
    }
    if (field === "consent") {
      if (!v) return { field, message: "Please agree to the terms and privacy policy." };
      continue;
    }
    if (field === "goals") {
      const n = Array.isArray(v) ? v.length : 0;
      if (n < 1) return { field, message: "Choose at least one thing you want to do." };
      if (n > 2) return { field, message: "Choose at most two." };
      continue;
    }
    if (field === "postal_code") {
      if (!/^[0-9]{6}$/.test(String(v || ""))) {
        return { field, message: "A Nigerian postal code is exactly 6 digits." };
      }
      continue;
    }
    if (field === "disability_detail") {
      const t = String(v || "").trim();
      if (!t) return { field, message: "Please say what to note." };
      if (t.length > 200) return { field, message: "Please keep this under 200 characters." };
      continue;
    }

    if (v === undefined || v === null || String(v).trim() === "") {
      return { field, message: "Please give " + LABEL[field] + "." };
    }
  }

  // The one rule that is about two answers at once, so it cannot be
  // checked field by field above.
  if (a.occupation === "nysc") {
    if (!nyscOffered(a)) {
      return { field: "occupation", message: "NYSC is for corps members serving in Nigeria." };
    }
    if (!NYSC_QUALIFICATIONS.includes(a.qualification || "")) {
      return {
        field: "occupation",
        message: "NYSC is for HND and degree holders. Check your education answers.",
      };
    }
  }
  return null;
}

/**
 * What goes into supabase.auth.signUp options.data.
 *
 * ONLY THE QUESTIONS THAT WERE ASKED. A field the form skipped is left
 * out entirely rather than sent as an empty string, because the
 * database stores null for those and a "" would fail a check constraint
 * that is doing its job.
 */
export function toMetadata(a) {
  const out = {};
  for (const field of ORDER) {
    if (field === "full_name" || field === "email" || field === "password" || field === "consent") continue;
    if (!shows(field, a)) continue;
    const v = a[field];
    if (v === undefined || v === null || v === "") continue;
    out[field] = field === "goals" ? [...v] : v;
  }
  out.consented_at = new Date().toISOString();
  return out;
}

/**
 * Take out every answer that the current answers no longer ask for.
 *
 * WHY IT IS A FUNCTION AND NOT A LINE IN THE PAGE. Somebody picks
 * Nigeria, types a postal code, then changes to Ghana. Without this the
 * postal code is still in the object, is still sent, and the database
 * refuses the whole row because of a question the form stopped asking.
 * The same for a course of study after changing away from tertiary, and
 * for a disability detail after changing to No, which is the one that
 * matters: an answer somebody has taken back must not travel.
 *
 * It returns a new object. The page calls it on every change, so it has
 * to be safe to call when nothing has changed, and it is: a field that
 * is already absent stays absent.
 */
export function clearHidden(a) {
  const next = { ...a };
  for (const field of [
    "state", "region", "postal_code",
    "qualification", "course_of_study", "trade",
    "job_title", "business", "study_level", "school", "sector",
    "disability_detail",
  ]) {
    if (!shows(field, next)) delete next[field];
  }
  // The NYSC option disappears when the country or the age makes it
  // impossible, and an answer of nysc has to go with it, along with
  // everything that answer was asking for.
  if (next.occupation === "nysc" && !nyscOffered(next)) {
    delete next.occupation;
    delete next.sector;
  }
  return next;
}
