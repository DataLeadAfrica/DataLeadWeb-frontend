// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for enrolment pricing + Paystack links.
//
// `paystack` is the slug at the end of a paystack.shop/pay/<slug> link.
// When you create a new Paystack page, just paste its slug here and the
// "Pay online" button turns on automatically. Leave it off (omit paystack)
// and that plan falls back to bank transfer only.
//
// amounts are in naira (₦). Kids courses are full-payment only.
// ─────────────────────────────────────────────────────────────
export const PAYSTACK_BASE = "https://paystack.shop/pay/";

export type PayOption = { amount: number; paystack?: string };
export type InstallOption = {
  total: number;
  per: number;
  count: number;
  paystack?: string;
};
export type CoursePayment = {
  full?: PayOption;
  installments?: InstallOption;
  nysc?: PayOption; // NYSC discount — only offered to learners in Nigeria
};

export const PAYMENTS: Record<string, CoursePayment> = {
  "Data Analytics": {
    full: { amount: 250000, paystack: "dla-19onetime" },
    installments: { total: 300000, per: 100000, count: 3, paystack: "dla-19-part" },
    nysc: { amount: 150000, paystack: "dla19-nysc" },
  },
  "AI & Machine Learning": {
    full: { amount: 250000, paystack: "AI_ML" },
    installments: { total: 300000, per: 100000, count: 3 },
    nysc: { amount: 150000 },
  },
  Bioinformatics: {
    full: { amount: 300000 },
    installments: { total: 360000, per: 120000, count: 3 },
    nysc: { amount: 180000 },
  },
  "Business Analytics": {
    full: { amount: 195000 },
    installments: { total: 234000, per: 78000, count: 3 },
    nysc: { amount: 117000 },
  },
  "HR Analytics": {
    full: { amount: 195000 },
    installments: { total: 234000, per: 78000, count: 3 },
    nysc: { amount: 117000 },
  },
  "Research Methodology and Manuscript Writing": {
    full: { amount: 100000 },
    installments: { total: 120000, per: 40000, count: 3 },
    nysc: { amount: 60000 },
  },
  "Employability & Entrepreneurship": {
    full: { amount: 100000 },
    installments: { total: 120000, per: 40000, count: 3 },
    nysc: { amount: 60000 },
  },
  "Digital Creators": { full: { amount: 70000 } },
  "AI & ML for Kids": { full: { amount: 70000 } },
  "Python Coding for Kids": { full: { amount: 70000 } },
};

export function naira(n: number): string {
  return "₦" + n.toLocaleString("en-NG");
}
