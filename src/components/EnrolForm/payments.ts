// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for enrolment pricing + Paystack links.
//
// `paystack` is the slug at the end of a paystack.shop/pay/<slug> link.
// Every plan below now has a live Paystack page. To change a link, just
// swap its slug here — the "Pay online" button + the email update together.
//
// Installments are offered ONLY on the four 3-month, ₦195k+ courses.
// The installment Paystack page charges the PER-payment amount; the learner
// pays it `count` times over the programme.
//
// amounts are in naira (₦). Kids courses are full-payment only.
// ─────────────────────────────────────────────────────────────
export const PAYSTACK_BASE = "https://paystack.shop/pay/";

export type PayOption = { amount: number; paystack?: string };
export type InstallOption = {
  total: number;
  per: number;
  count: number;
  paystack?: string; // page charges `per`; learner pays it `count` times
};
export type CoursePayment = {
  full?: PayOption;
  installments?: InstallOption;
  nysc?: PayOption; // NYSC discount — only offered to learners in Nigeria
};

export const PAYMENTS: Record<string, CoursePayment> = {
  "Data Analytics": {
    full: { amount: 250000, paystack: "dla-data-analytics-full-v2" },
    installments: { total: 300000, per: 100000, count: 3, paystack: "dla-data-analytics-installment-v2" },
    nysc: { amount: 150000, paystack: "dla-data-analytics-nysc-v2" },
  },
  "AI & Machine Learning": {
    full: { amount: 250000, paystack: "dla-ai-ml-full-v2" },
    installments: { total: 300000, per: 100000, count: 3, paystack: "dla-ai-ml-installment-v2" },
    nysc: { amount: 150000, paystack: "dla-ai-ml-nysc-v2" },
  },
  Bioinformatics: {
    full: { amount: 300000, paystack: "dla-bioinformatics-full-v2" },
    installments: { total: 360000, per: 120000, count: 3, paystack: "dla-bioinformatics-installment-v2" },
    nysc: { amount: 180000, paystack: "dla-bioinformatics-nysc-v2" },
  },
  "Business Analytics": {
    full: { amount: 195000, paystack: "dla-business-analytics-full-v2" },
    installments: { total: 234000, per: 78000, count: 3, paystack: "dla-business-analytics-installment-v2" },
    nysc: { amount: 117000, paystack: "dla-business-analytics-nysc-v2" },
  },
  "HR Analytics": {
    full: { amount: 195000, paystack: "dla-hr-analytics-full-v2" },
    nysc: { amount: 117000, paystack: "dla-hr-analytics-nysc-v2" },
  },
  "Research Methodology and Manuscript Writing": {
    full: { amount: 100000, paystack: "dla-research-methodology-full-v2" },
    nysc: { amount: 60000, paystack: "dla-research-methodology-nysc-v2" },
  },
  "Employability & Entrepreneurship": {
    full: { amount: 100000, paystack: "dla-employability-full-v2" },
    nysc: { amount: 60000, paystack: "dla-employability-nysc-v2" },
  },
  "Digital Creators": {
    full: { amount: 70000, paystack: "dla-digital-creators-full-v2" },
  },
  "AI & ML for Kids": {
    full: { amount: 70000, paystack: "dla-ai-ml-kids-full-v2" },
  },
  "Python Coding for Kids": {
    full: { amount: 70000, paystack: "dla-python-kids-full" },
  },
};

export function naira(n: number): string {
  return "₦" + n.toLocaleString("en-NG");
}
