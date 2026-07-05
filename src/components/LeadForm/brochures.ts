// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for the brochure dropdown + emails.
//
// To ADD a programme:   add a line below AND upload the matching
//                       PDF to  public/brochures/<file>.
// To REMOVE a programme: delete its line here.
//
// `name`     must match the course name shown on the site.
// `duration` is shown in the brochure email so it reads correctly
//            per course (e.g. HR = "1 month", not a generic "3 months").
// ─────────────────────────────────────────────────────────────
export type Brochure = { name: string; file: string; duration: string };

export const BROCHURES: Brochure[] = [
  { name: "Data Analytics", file: "data-analytics.pdf", duration: "3 months" },
  { name: "AI & Machine Learning", file: "ai-machine-learning.pdf", duration: "3 months" },
  { name: "Business Analytics", file: "business-analytics.pdf", duration: "3 months" },
  { name: "Bioinformatics", file: "bioinformatics.pdf", duration: "3 months" },
  { name: "HR Analytics", file: "hr-analytics.pdf", duration: "1 month" },
  {
    name: "Research Methodology and Manuscript Writing",
    file: "research-methodology.pdf",
    duration: "Intensive",
  },
  {
    name: "Employability & Entrepreneurship",
    file: "employability-entrepreneurship.pdf",
    duration: "2 weeks",
  },
  { name: "Digital Creators", file: "digital-creators.pdf", duration: "1 month" },
  { name: "AI & ML for Kids", file: "ai-ml-for-kids.pdf", duration: "1 month" },
  { name: "Python Coding for Kids", file: "python-coding-for-kids.pdf", duration: "1 month" },
];
