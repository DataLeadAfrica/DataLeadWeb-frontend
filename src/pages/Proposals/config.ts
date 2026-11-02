// Settings for the proposal form at /staff/proposals.
//
// Everything somebody might want to change later is here, so the page
// itself never has to be edited to add a category or to point at a new
// web app.
//
// SUBMIT_URL is the address of the Google Apps Script web app that saves
// the file into the Drive folder and adds the row to the register. The
// folder and the spreadsheet are named inside that script, not here, so
// nothing in this file gives anybody access to them. If the web app is
// ever redeployed as a NEW deployment (rather than a new version of the
// same one), Google issues a new address and this is the one line to
// change.
//
// The server repeats every check made on the page, and these lists must
// match the TYPES, CATEGORIES, file types and sizes at the top of that
// script. A value the script does not know is refused.

export const SUBMIT_URL =
  "https://script.google.com/macros/s/AKfycbxg-yrulBQBwP5JQalbyKvJlPfJ5YZES7c1dEcZW8Me8dZtGM_dRXGZ3cWLjxxG1rH5/exec";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILE_LABEL = "20 MB";

export const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "zip"];

export const NOTE_MAX = 300;

export const OTHER = "Other";

export const TYPES = [
  "Technical proposal",
  "Concept note",
  "Expression of Interest",
  "Tender / RFP response",
  "Grant application",
  OTHER,
];

export const CATEGORIES = [
  "Humanitarian",
  "Health",
  "Education",
  "Governance",
  "Agriculture and food security",
  "Climate and environment",
  "Gender and social inclusion",
  "Research and evaluation",
  OTHER,
];
