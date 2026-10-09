// The public addresses of the site, for the sitemap.
//
// WHY THIS IS A SECOND LIST. src/pages/routes.ts is TypeScript inside the
// React bundle, and an edge function cannot import it. So the addresses
// are written out here as plain JavaScript.
//
// Two lists of the same thing drift apart. tests/sitemap.test.mjs reads
// src/pages/routes.ts, works out which of its routes are public, and
// fails if this file disagrees with it. Add a page to routes.ts and
// forget this file, and the test says so.

/** Every public address, exactly as routes.ts spells it. */
export const PUBLIC_ROUTES = [
  "/",
  "/blog",
  "/blog/why-should-i-register-for-a-course-when-i-can-self-learn",
  "/blog/top-7-data-analytics-skills-employers-want-in-nigeria-2025",
  "/blog/how-nysc-members-can-launch-a-career-in-data-analytics-during-service-year",
  "/blog/from-beginner-to-analyst-12-weeks-to-a-data-career-in-abuja",
  "/blog/excel-vs-power-bi-vs-python-which-tool-should-you-learn-first",
  "/blog/sql-for-beginners-why-every-nigerian-graduate-should-learn-it",
  "/blog/driving-inclusion-with-data-when-quality-statistics-meet-accessibility",
  "/blog/deaf-in-tech",
  "/research",
  "/research/nigeria-joint-response-dutch-ministry-of-foreign-affairs-oct-nov-2020",
  "/research/usaid-nigeria-dec-2020-jan-2021",
  "/research/mercy-corps-mar-apr-2021",
  "/research/japan-international-cooperation-agency-oct-nov-2021",
  "/research/social-impact-usaid-nigeria-dec-2021-feb-2022",
  "/research/final-assessment-report-usaid-nigeria-violence-and-conflict-assessment-vca",
  "/research/development-of-business-case-for-reusable-menstrual-products",
  "/who-we-are",
  "/contact-us",
  "/our-team",
  "/our-team/dr-arowolo-ayoola",
  "/our-team/abdulsalam-oluwatosin",
  "/our-team/sefunmi-oluwole",
  "/our-team/oche-loveth",
  "/our-team/felicia-ayodele",
  "/our-team/maranatha-emmaogboji",
  "/our-team/blessing-adem",
  "/our-team/gabriel-matthew",
  "/our-team/isaac-joshua",
  "/our-team/oyekale-eniola-yetunde",
  "/our-team/okona-adaora-stephanie",
  "/our-team/mogaji-adekale-stephen",
  "/our-team/musa-maimusa",
  "/careers",
  "/courses",
  "/courses/data-analytics",
  "/courses/data-science",
  "/courses/bioinformatics",
  "/courses/hr-analysis",
  "/courses/business-analytics",
  "/courses/research-methodology-manuscript-writing",
  "/courses/employability-entrepreneurship",
  "/courses/digital-creation",
  "/courses/kids",
  "/courses/ai-ml-for-kids",
  "/courses/python-coding-for-kids",
  "/consultancy",
  "/training",
  "/privacy-policy",
  "/certifications",
  "/lms",
  "/lms/courses",
];

/**
 * The routes.ts keys that must NOT be in a sitemap, and why. The test
 * reads this, so a new private page has to be classified on purpose
 * rather than quietly left out.
 */
export const NOT_IN_SITEMAP = {
  // Pages that need an address we do not have: they carry a parameter.
  shareCertificate: "carries a :number, so there is no one address",
  verifyCertificate: "carries a :number",
  learnerModule: "carries a :slug",

  // Pages behind a sign in, or that only make sense after an action.
  myCertificate: "behind a sign in",
  staffCertificates: "staff only",
  learnerLogin: "a sign in page",
  myLearning: "behind a sign in",
  staffPortal: "staff only",
  academySignUp: "carries noindex",
  academySignIn: "carries noindex",
  academyReset: "carries noindex",
  academyMe: "behind a sign in, and carries noindex",
  academyCourse: "carries a :slug. Each published course is added to the sitemap from the database instead",

  // The Phase 4 learning pages. All four are behind a sign in and all
  // four carry noindex. They show one person's own progress through a
  // course they paid for, which is nobody else's business and would be
  // meaningless in a search result anyway.
  academyLearn: "behind a sign in, and carries noindex",
  academyLesson: "behind a sign in, and carries noindex",
  academyQuiz: "behind a sign in, and carries noindex",
  academyComplete: "behind a sign in, and carries noindex",

  // The end of a payment or a form. Landing on one from a search result
  // would be meaningless.
  coursesDataAnalyticsPaymentSuccess: "the end of a payment",
  coursesDataAnalyticsRegistrationSuccess: "the end of a form",
};
