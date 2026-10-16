// ============================================================
// SELF-SERVICE TRAINING CERTIFICATE: THE ONE FILE TO EDIT
//
// Each training that uses the self-service certificate page has one entry
// below. The page at the address in `path` reads it.
//
// The participant names, the wording printed on the certificate, the pass
// mark, the number of attempts and the question bank all live in the Google
// Sheet behind `endpoint`, so they can be changed without touching the
// website.
// The values here are only what the page shows for the split second
// before the Sheet answers.
// ============================================================

export type TrainingSetup = {
  // The Apps Script web app address (ends in /exec).
  endpoint: string;
  // Used in the programme_slug of the certificate and in file names.
  slug: string;
  // Shown immediately while the Sheet is loading.
  fallback: {
    title: string;
    theme: string;
    dates: string;
    passMark: number;
    maxAttempts: number;
    questionCount: number;
  };
};

export const MOBEP_TRAINING: TrainingSetup = {
  endpoint: "https://script.google.com/macros/s/AKfycbz0X4WgVP3ruGSou6leGd4FEtjqxUBrSHtbmR4iQPpFXLJBw4gwTwB3Z_dt67cvsS13Ag/exec",
  slug: "mobep-power-bi-2026",
  fallback: {
    title: "Applying Microsoft Power BI for Equity-Focused Planning and Budgeting",
    theme:
      "Utilisation of Disaggregated Data for Development Planning and Monitoring the Demographic Dividend",
    dates: "14 to 16 October 2026",
    passMark: 70,
    maxAttempts: 0,
    questionCount: 15,
  },
};
