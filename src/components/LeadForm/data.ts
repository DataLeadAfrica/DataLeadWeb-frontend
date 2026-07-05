// Country list with international dialling codes (used for the searchable
// country dropdown and to auto-prefix the phone number). No external library.
export type Country = { name: string; dial: string };

export const COUNTRIES: Country[] = [
  { name: "Nigeria", dial: "+234" },
  { name: "Ghana", dial: "+233" },
  { name: "Kenya", dial: "+254" },
  { name: "South Africa", dial: "+27" },
  { name: "Benin Republic", dial: "+229" },
  { name: "Togo", dial: "+228" },
  { name: "Chad", dial: "+235" },
  { name: "Guinea-Bissau", dial: "+245" },
  { name: "Cameroon", dial: "+237" },
  { name: "Liberia", dial: "+231" },
  { name: "Sierra Leone", dial: "+232" },
  { name: "Uganda", dial: "+256" },
  { name: "Tanzania", dial: "+255" },
  { name: "Zambia", dial: "+260" },
  { name: "Zimbabwe", dial: "+263" },
  { name: "Botswana", dial: "+267" },
  { name: "Rwanda", dial: "+250" },
  { name: "Ethiopia", dial: "+251" },
  { name: "Egypt", dial: "+20" },
  { name: "Senegal", dial: "+221" },
  { name: "Côte d'Ivoire", dial: "+225" },
  { name: "Mali", dial: "+223" },
  { name: "Burkina Faso", dial: "+226" },
  { name: "Niger", dial: "+227" },
  { name: "Gambia", dial: "+220" },
  { name: "Guinea", dial: "+224" },
  { name: "Morocco", dial: "+212" },
  { name: "Algeria", dial: "+213" },
  { name: "Tunisia", dial: "+216" },
  { name: "Democratic Republic of the Congo", dial: "+243" },
  { name: "Republic of the Congo", dial: "+242" },
  { name: "Gabon", dial: "+241" },
  { name: "Angola", dial: "+244" },
  { name: "Mozambique", dial: "+258" },
  { name: "Malawi", dial: "+265" },
  { name: "Namibia", dial: "+264" },
  { name: "Mauritius", dial: "+230" },
  { name: "Madagascar", dial: "+261" },
  { name: "Sudan", dial: "+249" },
  { name: "South Sudan", dial: "+211" },
  { name: "Somalia", dial: "+252" },
  { name: "Burundi", dial: "+257" },
  { name: "Central African Republic", dial: "+236" },
  { name: "Mauritania", dial: "+222" },
  { name: "Eswatini", dial: "+268" },
  { name: "Lesotho", dial: "+266" },
  { name: "United Kingdom", dial: "+44" },
  { name: "United States", dial: "+1" },
  { name: "Canada", dial: "+1" },
  { name: "United Arab Emirates", dial: "+971" },
  { name: "Saudi Arabia", dial: "+966" },
  { name: "Qatar", dial: "+974" },
  { name: "India", dial: "+91" },
  { name: "China", dial: "+86" },
  { name: "Germany", dial: "+49" },
  { name: "France", dial: "+33" },
  { name: "Italy", dial: "+39" },
  { name: "Spain", dial: "+34" },
  { name: "Netherlands", dial: "+31" },
  { name: "Ireland", dial: "+353" },
  { name: "Australia", dial: "+61" },
  { name: "Brazil", dial: "+55" },
  { name: "Turkey", dial: "+90" },
  { name: "Other", dial: "" },
];

// Nigeria's 36 states plus the FCT (shown only when Country = Nigeria).
export const NIGERIA_STATES: string[] = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "Federal Capital Territory (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna",
  "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger",
  "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara",
];

// ── Cohort options — sensitive to the programme selected ──────────────
// Kids' courses run once a year in summer, so they must NOT show the adult
// 27 July / 19 October cohort dates. To treat a programme as "kids", add its
// exact name here.
export const KIDS_COURSES: string[] = [
  "Digital Creators",
  "AI & ML for Kids",
  "Python Coding for Kids",
];

export function isKidsCourse(programme: string): boolean {
  return KIDS_COURSES.includes(programme);
}

// "How early do you want to start?" (brochure form).
const ADULT_START_OPTIONS = [
  "Cohort 3 – 27 July",
  "Cohort 4 – 19 October",
  "A future cohort",
  "Just exploring",
];
const KIDS_START_OPTIONS = [
  "This summer's cohort",
  "A future summer",
  "Just exploring",
];
export function startOptionsFor(programme: string): string[] {
  return isKidsCourse(programme) ? KIDS_START_OPTIONS : ADULT_START_OPTIONS;
}

// "Preferred cohort" (enrol form).
const ADULT_COHORTS = [
  "Cohort 3 – 27 July",
  "Cohort 4 – 19 October",
  "A future cohort",
];
const KIDS_COHORTS = ["This summer's cohort", "A future summer"];
export function cohortsFor(programme: string): string[] {
  return isKidsCourse(programme) ? KIDS_COHORTS : ADULT_COHORTS;
}

// Options for the optional "How did you hear about us?" question.
export const HEARD_OPTIONS: string[] = [
  "Google / search",
  "Instagram",
  "LinkedIn",
  "X (Twitter)",
  "Facebook",
  "WhatsApp",
  "Friend or colleague",
  "Event or webinar",
  "Other",
];
