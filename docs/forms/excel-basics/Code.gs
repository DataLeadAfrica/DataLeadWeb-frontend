/**
 * Data-Lead Africa: free Excel Basics training applications
 * ---------------------------------------------------------
 * Receives applications from https://dataleadafrica.com/register/excel-basics/
 * saves each one as a row in the Google Sheet below, and sends the applicant
 * a confirmation email.
 *
 * Setup is in docs/forms/excel-basics/SETUP.md. In short:
 *   1. Paste the sheet ID into SHEET_ID below.
 *   2. Run setup() once from the Apps Script editor.
 *   3. Deploy as a Web app: Execute as Me, access Anyone.
 * For later changes use Manage deployments, then edit, then New version,
 * so the web app URL never changes.
 *
 * Health check: open the web app URL in a private window. It should show
 * {"ok":true,...}. In the editor, run runFullSelfTest() and read the log.
 */

var SHEET_ID = "PASTE_THE_SHEET_ID_HERE";
var SHEET_NAME = "Applications";
var SUMMARY_NAME = "Summary";

// 11:59 pm, Tuesday 13 October 2026, West Africa Time.
var DEADLINE = new Date("2026-10-13T23:59:59+01:00");

var SENDER_NAME = "Data-Lead Africa";
var REPLY_TO = "info@dataleadafrica.com";
var WHATSAPP_DISPLAY = "+234 916 666 1234";
var WHATSAPP_LINK = "https://wa.me/2349166661234";
var LOGO_URL = "https://dataleadafrica.com/assets/dla-logo-email.png";
var SUBJECT = "Application received: free Excel Basics training";

var HEADERS = [
  "Submitted at", "Reference", "Status", "Duplicate of", "Full name", "Email",
  "WhatsApp", "WhatsApp link", "Gender", "Area in Abuja", "Attendance",
  "Education", "Current status", "Organisation and role", "School or institution",
  "Excel use", "Laptop", "Use Excel for", "Heard from", "Heard from (other)",
  "Consent", "UTM source", "UTM medium", "UTM campaign", "Referrer",
  "Source page", "Email status", "Selected"
];

// Column numbers (1 based), looked up by header name so the order lives in one place.
function col_(name) {
  var i = HEADERS.indexOf(name);
  if (i < 0) throw new Error("Unknown column: " + name);
  return i + 1;
}

/* ====================================================================
   WEB APP
   ==================================================================== */

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // Honeypot: real people never fill the hidden "website" field.
    if (String(data.website || "").trim() !== "") return json_({ ok: true });

    lock.waitLock(30000);
    locked = true;

    var sheet = getSheet_();
    var email = String(data.email || "").trim().toLowerCase();
    var phone = normPhone_(data.whatsapp);
    var reference = cleanRef_(data.reference) || makeRef_();

    // A retry of a submission we already saved (same reference): keep one row.
    if (findRow_(sheet, col_("Reference"), reference) > 0) return json_({ ok: true });

    var duplicateOf = findDuplicate_(sheet, email, phone);
    var now = new Date();
    var status = now > DEADLINE ? "Late" : "New";

    var row = {};
    row["Submitted at"] = now;
    row["Reference"] = reference;
    row["Status"] = status;
    row["Duplicate of"] = duplicateOf;
    row["Full name"] = text_(data.fullName, 120);
    row["Email"] = email;
    // The apostrophe keeps "+234..." as text instead of a number.
    row["WhatsApp"] = phone ? "'" + phone : text_(data.whatsapp, 40);
    row["WhatsApp link"] = phone ? "https://wa.me/" + phone.replace(/^\+/, "") : "";
    row["Gender"] = text_(data.gender, 40);
    row["Area in Abuja"] = text_(data.area, 120);
    row["Attendance"] = text_(data.attendance, 40);
    row["Education"] = text_(data.education, 60);
    row["Current status"] = text_(data.status, 60);
    row["Organisation and role"] = text_(data.organisation, 160);
    row["School or institution"] = text_(data.school, 160);
    row["Excel use"] = text_(data.excelUse, 40);
    row["Laptop"] = text_(data.laptop, 60);
    row["Use Excel for"] = text_(data.useExcelFor, 300);
    row["Heard from"] = text_(data.heardFrom, 60);
    row["Heard from (other)"] = text_(data.heardFromOther, 160);
    row["Consent"] = data.consent === true || data.consent === "true" ? "Yes" : "No";
    row["UTM source"] = text_(data.utm_source, 100);
    row["UTM medium"] = text_(data.utm_medium, 100);
    row["UTM campaign"] = text_(data.utm_campaign, 100);
    row["Referrer"] = text_(data.referrer, 300);
    row["Source page"] = text_(data.sourcePage, 200);
    row["Email status"] = duplicateOf ? "Not sent: duplicate" : "Pending";
    row["Selected"] = false;

    var rowIndex = sheet.getLastRow() + 1;
    var values = HEADERS.map(function (h) { return row[h] === undefined ? "" : row[h]; });
    // Plain text everywhere except the date and the checkbox, so typed
    // answers and numbers are stored exactly as sent.
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setNumberFormat("@");
    sheet.getRange(rowIndex, col_("Submitted at")).setNumberFormat("yyyy-mm-dd hh:mm:ss");
    sheet.getRange(rowIndex, col_("Selected")).setNumberFormat("General");
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([values]);
    sheet.getRange(rowIndex, col_("Selected")).insertCheckboxes();
    SpreadsheetApp.flush();

    // Still inside the lock, so the hourly job cannot send the same email twice.
    if (!duplicateOf && email) {
      var sent = trySend_(email, row["Full name"], reference);
      if (sent) sheet.getRange(rowIndex, col_("Email status")).setValue("Sent");
    }
    return json_({ ok: true });
  } catch (err) {
    console.error("doPost failed: " + (err && err.stack ? err.stack : err));
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (e2) { /* ignore */ } }
  }
}

// Health check. Open the web app URL in a private window to see this.
function doGet() {
  var info = { ok: true, service: "excel-basics-applications", deadline: DEADLINE.toISOString() };
  try { info.sheet = getSheet_().getName(); } catch (err) { info.ok = false; info.error = String(err.message || err); }
  return json_(info);
}

/* ====================================================================
   SETUP (run once from the editor)
   ==================================================================== */

function setup() {
  var sheet = getSheet_();
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, HEADERS.length, 150);

  buildSummary_();

  // One hourly trigger that sends any emails left as Pending.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "sendPendingEmails") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("sendPendingEmails").timeBased().everyHours(1).create();

  console.log("Setup complete. Sheet: " + sheet.getName() + ". Emails left today: " + MailApp.getRemainingDailyQuota());
}

function getSheet_() {
  if (!SHEET_ID || SHEET_ID.indexOf("PASTE") === 0) throw new Error("Set SHEET_ID at the top of Code.gs first.");
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME, 0);
  var first = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (String(first[0]) !== HEADERS[0] || String(first[1]) !== HEADERS[1]) {
    if (sheet.getLastRow() > 0 && String(first[0]) !== "") sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight("bold").setBackground("#fdeee2").setFontColor("#141317");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function buildSummary_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sum = ss.getSheetByName(SUMMARY_NAME) || ss.insertSheet(SUMMARY_NAME);
  sum.clear();

  var src = "'" + SHEET_NAME + "'!";
  function range(name) { var c = letter_(col_(name)); return src + c + "2:" + c; }
  var notDup = range("Duplicate of") + ',""';

  var out = [];
  out.push(["Free Excel Basics training: applications", ""]);
  out.push(["Counts below leave out rows marked as duplicates.", ""]);
  out.push(["", ""]);
  out.push(["Total applications (all rows)", "=COUNTA(" + range("Reference") + ")"]);
  out.push(["Total applications (without duplicates)", "=COUNTIFS(" + range("Reference") + ',"<>",' + notDup + ")"]);
  out.push(["Late applications", "=COUNTIFS(" + range("Status") + ',"Late",' + notDup + ")"]);
  out.push(["Emails pending", "=COUNTIF(" + range("Email status") + ',"Pending")']);

  function block(title, column, options) {
    out.push(["", ""]);
    out.push([title, "Count"]);
    options.forEach(function (o) {
      out.push([o, "=COUNTIFS(" + range(column) + ',"' + o.replace(/"/g, '""') + '",' + notDup + ")"]);
    });
  }
  block("Attendance", "Attendance", ["Yes, both days", "Only one day"]);
  block("Laptop", "Laptop", ["Yes, with Excel installed", "Yes, but Excel is not installed yet", "I do not have a laptop"]);
  block("Excel use", "Excel use", ["Never used it", "A little", "I use it often"]);
  block("Heard from", "Heard from", ["LinkedIn", "Instagram", "Facebook", "X (Twitter)", "WhatsApp", "A friend or colleague", "Data-Lead Africa website", "Flyer or poster", "Other"]);
  out.push(["Heard from: left blank", "=COUNTIFS(" + range("Reference") + ',"<>",' + range("Heard from") + ',"",' + notDup + ")"]);

  sum.getRange(1, 1, out.length, 2).setValues(out);

  // Area is typed freely, so group it with a QUERY that lists each area and its count.
  var areaRow = out.length + 2;
  sum.getRange(areaRow, 1).setValue("Area in Abuja (as typed)").setFontWeight("bold");
  var a = letter_(col_("Area in Abuja")), d = letter_(col_("Duplicate of"));
  sum.getRange(areaRow + 1, 1).setFormula(
    "=IFERROR(QUERY({ARRAYFORMULA(PROPER(TRIM(" + src + a + "2:" + a + "))), " + src + d + "2:" + d + "}," +
    "\"select Col1, count(Col1) where Col1 <> '' and Col2 = '' group by Col1 order by count(Col1) desc label Col1 'Area', count(Col1) 'Count'\", 0), \"No applications yet\")"
  );

  sum.getRange(1, 1).setFontWeight("bold").setFontSize(13);
  sum.getRange(2, 1).setFontColor("#5f5e68");
  for (var r = 1; r <= out.length; r++) {
    if (out[r - 1][1] === "Count") sum.getRange(r, 1, 1, 2).setFontWeight("bold").setBackground("#fdeee2");
  }
  sum.setColumnWidth(1, 320);
  sum.setColumnWidth(2, 90);
}

/* ====================================================================
   EMAIL
   ==================================================================== */

// Sends now if today's quota allows. Returns true when sent.
function trySend_(email, fullName, reference) {
  try {
    if (MailApp.getRemainingDailyQuota() <= 0) return false;
    var msg = buildEmail_(fullName, reference);
    MailApp.sendEmail({
      to: email,
      subject: SUBJECT,
      name: SENDER_NAME,
      replyTo: REPLY_TO,
      body: msg.text,
      htmlBody: msg.html
    });
    return true;
  } catch (err) {
    console.error("Email to " + email + " failed: " + err);
    return false;
  }
}

// Runs every hour (created by setup). Sends emails left as Pending.
function sendPendingEmails() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    var sheet = getSheet_();
    var last = sheet.getLastRow();
    if (last < 2) return;
    var values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
    var cStatus = col_("Email status"), cEmail = col_("Email"), cName = col_("Full name"), cRef = col_("Reference");
    for (var i = 0; i < values.length; i++) {
      if (values[i][cStatus - 1] !== "Pending") continue;
      if (MailApp.getRemainingDailyQuota() <= 0) break;
      if (trySend_(values[i][cEmail - 1], values[i][cName - 1], values[i][cRef - 1])) {
        sheet.getRange(i + 2, cStatus).setValue("Sent");
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function buildEmail_(fullName, reference) {
  var first = String(fullName || "").trim().split(/\s+/)[0] || "there";
  var venue = "3rd Floor, Block F, Bassan Plaza, Plot 759, Central Business District, Abuja, FCT";

  var text = [
    "Hello " + first + ",",
    "",
    "Thank you for applying for the free Excel Basics training from Data-Lead Africa. We have received your application.",
    "",
    "Your reference: " + reference,
    "",
    "Dates: Thursday 15 and Friday 16 October 2026",
    "Venue: " + venue,
    "",
    "Please bring a laptop with Microsoft Excel installed.",
    "",
    "What happens next: the team will contact selected applicants by email and WhatsApp, and will share the daily times then.",
    "",
    "Questions? WhatsApp " + WHATSAPP_DISPLAY + " or email " + REPLY_TO + ".",
    "",
    "Data-Lead Africa"
  ].join("\n");

  var h = escape_;
  var html =
    '<div style="margin:0;padding:24px 12px;background:#faf8f4;font-family:Poppins,Segoe UI,Arial,sans-serif;color:#141317">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e6ea;border-radius:16px">' +
    '<tr><td style="padding:24px 28px 8px"><img src="' + LOGO_URL + '" alt="Data-Lead Africa" width="120" style="display:block;width:120px;height:auto;border:0"></td></tr>' +
    '<tr><td style="padding:8px 28px 0">' +
      '<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#141317">Application received</h1>' +
      '<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4b4a53">Hello ' + h(first) + ', thank you for applying for the free Excel Basics training from Data-Lead Africa. We have received your application.</p>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #dcdae2;border-radius:10px"><tr>' +
        '<td style="padding:10px 14px;border-right:1px solid #dcdae2;font-size:12px;font-weight:bold;color:#5f5e68">Reference</td>' +
        '<td style="padding:10px 16px;font-family:Consolas,Menlo,monospace;font-size:18px;font-weight:bold;letter-spacing:1px;color:#141317">' + h(reference) + '</td>' +
      '</tr></table>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#4b4a53">' +
        '<tr><td style="padding:4px 16px 4px 0;font-weight:bold;color:#141317;vertical-align:top">Dates</td><td style="padding:4px 0">Thursday 15 and Friday 16 October 2026</td></tr>' +
        '<tr><td style="padding:4px 16px 4px 0;font-weight:bold;color:#141317;vertical-align:top">Venue</td><td style="padding:4px 0">' + h(venue) + '</td></tr>' +
      '</table>' +
      '<p style="margin:0 0 16px;padding:12px 14px;border-radius:10px;background:#fdeee2;font-size:14px;line-height:1.5;color:#141317"><strong>Please bring a laptop with Microsoft Excel installed.</strong></p>' +
      '<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b4a53">The team will contact selected applicants by email and WhatsApp, and will share the daily times then.</p>' +
      '<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b4a53">Questions? WhatsApp <a href="' + WHATSAPP_LINK + '" style="color:#d94a00">' + WHATSAPP_DISPLAY + '</a> or email <a href="mailto:' + REPLY_TO + '" style="color:#d94a00">' + REPLY_TO + '</a>.</p>' +
    '</td></tr>' +
    '<tr><td style="padding:14px 28px;border-top:1px solid #e7e6ea;font-size:12px;color:#5f5e68">Data-Lead Africa, Bassan Plaza, Central Business District, Abuja</td></tr>' +
    '</table></div>';

  return { text: text, html: html };
}

/* ====================================================================
   SELF TEST (run from the editor, then read View, Logs)
   ==================================================================== */

function runFullSelfTest() {
  var lines = [];
  function ok(label, pass, detail) { lines.push((pass ? "PASS  " : "FAIL  ") + label + (detail ? ": " + detail : "")); }
  try {
    var sheet = getSheet_();
    ok("Sheet opens", true, sheet.getParent().getName() + " / " + sheet.getName());
    var head = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    ok("Header row matches", head.join("|") === HEADERS.join("|"));
  } catch (err) {
    ok("Sheet opens", false, err.message);
  }
  ok("Summary tab exists", !!SpreadsheetApp.openById(SHEET_ID).getSheetByName(SUMMARY_NAME));
  var hasTrigger = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "sendPendingEmails"; });
  ok("Hourly email trigger exists", hasTrigger, hasTrigger ? "" : "run setup()");
  ok("Email quota left today", MailApp.getRemainingDailyQuota() > 0, String(MailApp.getRemainingDailyQuota()));
  ok("Phone normalising", normPhone_("0803 123 4567") === "+2348031234567" && normPhone_("+234 803 123 4567") === "+2348031234567" && normPhone_("8031234567") === "+2348031234567");
  ok("Deadline", true, DEADLINE.toISOString() + (new Date() > DEADLINE ? " (passed: new rows are Late)" : " (open)"));
  console.log(lines.join("\n"));
  return lines.join("\n");
}

/* ====================================================================
   HELPERS
   ==================================================================== */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// +234XXXXXXXXXX from 0803..., 803..., +234... or 234... ("" if not valid).
function normPhone_(input) {
  var d = String(input || "").replace(/[\s\-().]/g, "");
  if (d.charAt(0) === "+") d = d.slice(1);
  if (!/^\d+$/.test(d)) return "";
  if (d.indexOf("234") === 0) d = d.slice(3);
  if (d.charAt(0) === "0") d = d.slice(1);
  return /^[789][01]\d{8}$/.test(d) ? "+234" + d : "";
}

// Text from the form, trimmed and shortened. A leading = + - or @ is made
// safe so the sheet never runs it as a formula.
function text_(v, max) {
  var s = String(v === undefined || v === null ? "" : v).trim();
  if (max && s.length > max) s = s.slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function cleanRef_(v) {
  var s = String(v || "").trim().toUpperCase();
  return /^XL26-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/.test(s) ? s : "";
}

function makeRef_() {
  var chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", out = "XL26-";
  for (var i = 0; i < 5; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

// Row number (2 or more) of the first row whose column holds value, or 0.
function findRow_(sheet, column, value) {
  var last = sheet.getLastRow();
  if (last < 2 || !value) return 0;
  var vals = sheet.getRange(2, column, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]) === value) return i + 2;
  return 0;
}

// Reference of the earliest row with the same email or WhatsApp number, or "".
function findDuplicate_(sheet, email, phone) {
  var last = sheet.getLastRow();
  if (last < 2) return "";
  var n = last - 1;
  var emails = sheet.getRange(2, col_("Email"), n, 1).getValues();
  var phones = sheet.getRange(2, col_("WhatsApp"), n, 1).getValues();
  var refs = sheet.getRange(2, col_("Reference"), n, 1).getValues();
  for (var i = 0; i < n; i++) {
    var e = String(emails[i][0]).trim().toLowerCase();
    var p = String(phones[i][0]).replace(/^'/, "");
    if ((email && e === email) || (phone && p === phone)) return String(refs[i][0]);
  }
  return "";
}

function letter_(n) {
  var s = "";
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function escape_(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
