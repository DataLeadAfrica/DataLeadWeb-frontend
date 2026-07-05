// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for the brochure dropdown.
//
// To ADD a programme:   add a line below AND upload the matching
//                       PDF to  public/brochures/<file>.
// To REMOVE a programme: delete its line here.
//
// `name` must match the course name shown on the site so the
// brochure button can pre-select the right programme.
// ─────────────────────────────────────────────────────────────
export type Brochure = { name: string; file: string };

export const BROCHURES: Brochure[] = [
  { name: "Data Analytics", file: "data-analytics.pdf" },
  { name: "AI & Machine Learning", file: "ai-machine-learning.pdf" },
  { name: "Business Analytics", file: "business-analytics.pdf" },
  { name: "Bioinformatics", file: "bioinformatics.pdf" },
  { name: "HR Analytics", file: "hr-analytics.pdf" },
  {
    name: "Research Methodology and Manuscript Writing",
    file: "research-methodology.pdf",
  },
  {
    name: "Employability & Entrepreneurship",
    file: "employability-entrepreneurship.pdf",
  },
  { name: "Digital Creators", file: "digital-creators.pdf" },
  { name: "AI & ML for Kids", file: "ai-ml-for-kids.pdf" },
  { name: "Python Coding for Kids", file: "python-coding-for-kids.pdf" },
];
