/**
 * Data-Lead Africa email sender
 * -----------------------------
 * Collects codes from Supabase and sends them by Gmail. It now handles
 * BOTH kinds:
 *
 *   certificate_code      the six digit code for the certificate claim
 *                         page and the bootcamp learning portal
 *   academy_signup        confirming a new Data-Lead Academy account
 *   academy_recovery      resetting a Data-Lead Academy password
 *   academy_signin        signing in with a link rather than a password
 *   academy_email_change  confirming a changed address
 *
 * Supabase Auth does not send the Academy ones itself. A function in the
 * database called send_email_hook writes them into the same outbox this
 * script already empties, so there is one sender, one place to look, and
 * the health check watches all of it.
 *
 * This runs by itself every minute once the trigger is set up.
 *
 * ====================================================================
 * WHAT CHANGED FROM THE VERSION YOU ARE RUNNING TODAY
 * ====================================================================
 *   1. The sender is datalead.a.info@gmail.com. If this script is owned by
 *      that account, nothing needs setting up at all. See SETUP step 2.
 *   2. The mailer token has moved OUT of this file and into Script
 *      Properties, so the code can be shared without the secret.
 *   3. It reads the new purpose column and picks the wording to match.
 *   4. It no longer gives up on a row forever if one send fails.
 *
 * ====================================================================
 * SETUP, once
 * ====================================================================
 * 1. SETTINGS GO IN SCRIPT PROPERTIES, NOT IN THIS FILE.
 *    Click the gear icon (Project Settings), scroll to Script
 *    properties, then Add script property. Add these three:
 *
 *      SUPABASE_URL    https://YOUR-PROJECT-REF.supabase.co
 *                      (the certification project, the same address the
 *                      website uses. It is in the old version of this file.)
 *      SUPABASE_ANON_KEY   the anon public key, the same one the website
 *                          uses. This one is safe to hold here.
 *      MAILER_TOKEN    the long random mailer token
 *
 *    The token is the one secret that matters. Anybody holding it can
 *    read other people's sign in codes, so it never goes in this file,
 *    never in a Sheet, and never in a chat message.
 *
 * 2. THE SENDER ADDRESS.
 *    Apps Script always sends as the account that owns the script, so
 *    there are only two situations and the script works out which:
 *
 *      If this project is owned by datalead.a.info@gmail.com, there is
 *      NOTHING TO SET UP. It already sends from there.
 *
 *      If it is owned by some other account, then
 *      datalead.a.info@gmail.com has to be added to that account under
 *      Gmail, gear, See all settings, Accounts, Send mail as, Add another
 *      email address. Google emails a confirmation to the gmail account;
 *      open it and click the link.
 *
 *    Either way, RUN checkSenderReady() ONCE. It says which of the two
 *    applies, what learners will actually see, and how many emails a day
 *    this account is allowed. Do not skip it: in the second situation,
 *    without the verification every email silently goes out from the
 *    owning account instead, and you would find that out from a learner.
 *
 * 3. Run testConnection() once and approve the permissions.
 * 4. Run createTrigger() once.
 */

/* ============================================================
   The two things you may want to change.
   ============================================================ */

// The address learners see it come from.
var FROM_ADDRESS = "datalead.a.info@gmail.com";

// What they see as the name.
var FROM_NAME = "Data-Lead Africa";

// Where a reply goes. People reply to automatic email whatever it says,
// so this should be a mailbox somebody actually reads. Leaving it the same
// as the sender is fine; academy@dataleadafrica.com also works once that
// mailbox exists.
var REPLY_TO = "datalead.a.info@gmail.com";

/* ============================================================
   Nothing below here needs changing.
   ============================================================ */

function settings_() {
  var p = PropertiesService.getScriptProperties();
  var s = {
    url: p.getProperty("SUPABASE_URL"),
    key: p.getProperty("SUPABASE_ANON_KEY"),
    token: p.getProperty("MAILER_TOKEN"),
  };
  var missing = [];
  if (!s.url) missing.push("SUPABASE_URL");
  if (!s.key) missing.push("SUPABASE_ANON_KEY");
  if (!s.token) missing.push("MAILER_TOKEN");
  if (missing.length) {
    throw new Error(
      "These script properties are not set: " + missing.join(", ") +
      ". Add them under the gear icon, Project Settings, Script properties."
    );
  }
  s.url = s.url.replace(/\/+$/, "");
  return s;
}

/**
 * Calls one of the mailer functions in Supabase.
 */
function callSupabase_(s, fnName, payload) {
  var res = UrlFetchApp.fetch(s.url + "/rest/v1/rpc/" + fnName, {
    method: "post",
    contentType: "application/json",
    headers: { apikey: s.key, Authorization: "Bearer " + s.key },
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("Supabase said " + code + ": " + body);
  }
  return body ? JSON.parse(body) : null;
}

/* ============================================================
   The emails.
   ============================================================ */

// Everything shares one frame, so all five look like the same company.
function frame_(leadLine, code, note, closing) {
  var plain =
    leadLine + "\n\n" +
    "Your code is " + code + "\n\n" +
    note + "\n\n" +
    closing + "\n\n" +
    "Data-Lead Africa\n" +
    "Plot 759, Bassan Plaza, Central Business District, Abuja\n";

  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;' +
    'margin:0 auto;padding:24px;color:#141414;">' +
      '<p style="font-size:15px;margin:0 0 18px;">' + leadLine + '</p>' +
      '<div style="background:#faf8f4;border:1px solid #e3e0da;border-radius:12px;' +
      'padding:20px;text-align:center;margin:0 0 18px;">' +
        '<div style="font-size:12px;color:#5d5d5d;letter-spacing:.08em;' +
        'text-transform:uppercase;margin-bottom:8px;">Your code</div>' +
        '<div style="font-size:34px;font-weight:700;letter-spacing:.18em;">' +
        code + '</div>' +
      '</div>' +
      '<p style="font-size:14px;color:#5d5d5d;margin:0 0 14px;">' + note + '</p>' +
      '<p style="font-size:13px;color:#5d5d5d;margin:0 0 22px;">' + closing + '</p>' +
      '<hr style="border:0;border-top:1px solid #e3e0da;margin:0 0 14px;">' +
      '<p style="font-size:12px;color:#8a8a8a;margin:0;">Data-Lead Africa<br>' +
      'Plot 759, Bassan Plaza, Central Business District, Abuja</p>' +
    '</div>';

  return { plain: plain, html: html };
}

// Joins a subject onto a frame. Written longhand rather than with
// Object.assign, because that needs the newer Apps Script runtime and this
// file should work on either.
function withSubject_(subject, body) {
  return { subject: subject, plain: body.plain, html: body.html };
}

/**
 * Picks the wording from the purpose. An unknown purpose falls back to the
 * certificate wording, which is what every row was before the Academy
 * existed, so an older row is never mis-sent.
 */
function buildEmail_(code, purpose) {
  var ignore =
    "If you did not ask for this, you can ignore this message. Nothing " +
    "has changed and nobody has been given access to your account.";

  switch (purpose) {
    case "academy_signup":
      return withSubject_(
        "Confirm your Data-Lead Academy account: " + code,
        frame_(
          "Welcome to Data-Lead Academy. Enter this code on the site to confirm " +
            "your email address and open your account.",
          code,
          "The code expires in 10 minutes. If it runs out, ask for another.",
          "If you did not sign up for Data-Lead Academy, you can ignore this " +
            "message and no account will be created."
        )
      );

    case "academy_recovery":
      return withSubject_(
        "Reset your Data-Lead Academy password: " + code,
        frame_(
          "Somebody asked to reset the password for this address at Data-Lead " +
            "Academy. Enter this code on the site to choose a new one.",
          code,
          "The code expires in 10 minutes and can be used once.",
          "If this was not you, ignore this message. Your password has not " +
            "been changed and nobody has been given access to your account."
        )
      );

    case "academy_signin":
      return withSubject_(
        "Your Data-Lead Academy sign in code: " + code,
        frame_(
          "Enter this code on the site to sign in to Data-Lead Academy.",
          code,
          "The code expires in 10 minutes. Please do not forward it: anybody " +
            "who has it can sign in as you.",
          ignore
        )
      );

    case "academy_email_change":
      return withSubject_(
        "Confirm your new email address: " + code,
        frame_(
          "You asked to change the email address on your Data-Lead Academy " +
            "account. Enter this code to confirm the change.",
          code,
          "Until you confirm, your account keeps its old address and your " +
            "access is unaffected.",
          "If you did not ask for this, ignore this message and change your " +
            "password as a precaution."
        )
      );

    case "academy_other":
      return withSubject_(
        "Your Data-Lead Academy code: " + code,
        frame_(
          "Here is the code you asked for on Data-Lead Academy.",
          code,
          "The code expires in 10 minutes.",
          ignore
        )
      );

    default: // certificate_code, and anything older than the purpose column
      return withSubject_(
        "Your Data-Lead Africa certificate code: " + code,
        frame_(
          "Here is the code to see your Data-Lead Africa certificate.",
          code,
          "The code expires in 10 minutes.",
          "If you did not ask for this, you can ignore this message. Nobody " +
            "can see your certificate without the code."
        )
      );
  }
}

/**
 * Works out how this account can send as FROM_ADDRESS. Three answers:
 *
 *   "own"    this script is owned by FROM_ADDRESS, so it already sends
 *            from there and no from: is needed
 *   "alias"  FROM_ADDRESS is a verified Send mail as address on the
 *            owning account, so from: can be used
 *   "no"     neither, so email would go out from the owning account
 *            instead. Learners would see the wrong sender.
 */
function senderMode_() {
  var owner = "";
  try {
    owner = String(Session.getEffectiveUser().getEmail() || "").toLowerCase();
  } catch (err) {
    console.error("Could not read the owning account: " + err);
  }
  if (owner && owner === FROM_ADDRESS.toLowerCase()) {
    return "own";
  }
  try {
    var aliases = GmailApp.getAliases();
    for (var i = 0; i < aliases.length; i++) {
      if (String(aliases[i]).toLowerCase() === FROM_ADDRESS.toLowerCase()) {
        return "alias";
      }
    }
  } catch (err) {
    console.error("Could not list the Send mail as addresses: " + err);
  }
  return "no";
}

/* ============================================================
   The main job. Runs every minute.
   ============================================================ */

function sendPendingCodes() {
  var s = settings_();

  var rows = callSupabase_(s, "mail_fetch_pending", {
    p_token: s.token,
    p_limit: 20,
  });

  if (!rows || rows.length === 0) {
    return;
  }

  var mode = senderMode_();
  var sentIds = [];
  var failed = 0;

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    try {
      var msg = buildEmail_(row.code_plain, row.purpose);
      var options = {
        htmlBody: msg.html,
        name: FROM_NAME,
        replyTo: REPLY_TO,
      };
      // Only needed when sending as a verified alias. When this script is
      // owned by FROM_ADDRESS it is already the sender, and passing from:
      // for your own address is refused by Gmail.
      if (mode === "alias") {
        options.from = FROM_ADDRESS;
      }
      GmailApp.sendEmail(row.to_email, msg.subject, msg.plain, options);
      sentIds.push(row.id);
    } catch (err) {
      // Left in the outbox on purpose. The claim lapses after five
      // minutes and the next run picks it up again. An unsent row is
      // removed by the database after an hour, and the health check
      // alarms on anything sitting longer than 20 minutes.
      failed++;
      console.error("Could not send to " + row.to_email + ": " + err);
    }
  }

  if (sentIds.length > 0) {
    callSupabase_(s, "mail_mark_sent", { p_token: s.token, p_ids: sentIds });
  }

  console.log("Sent " + sentIds.length + ", failed " + failed);

  if (mode === "no") {
    // Worth knowing immediately rather than discovering it in a learner's
    // inbox, so it is logged loudly on every run until it is fixed.
    console.error(
      "WRONG SENDER: this account cannot send as " + FROM_ADDRESS + ", so " +
      "those emails went out from the owning account instead. " +
      "Run checkSenderReady() to see what to do."
    );
  }
}

/* ============================================================
   Run these by hand.
   ============================================================ */

/**
 * RUN THIS ONCE. It answers three things you cannot otherwise see:
 * which account owns this script, what address learners will actually
 * see, and how many emails a day Google allows this account.
 *
 * The daily number is read from Google rather than assumed, because it
 * differs a lot: a free gmail.com account gets 100 recipients a day
 * through Apps Script and a paid Workspace account gets 1,500. That
 * number is the ceiling on how many people can sign in in one day, so it
 * is worth knowing the real one.
 */
function checkSenderReady() {
  var owner = "(could not read it)";
  try {
    owner = Session.getEffectiveUser().getEmail();
  } catch (err) {
    console.error("Could not read the owning account: " + err);
  }
  console.log("This script is owned by: " + owner);

  try {
    console.log("Emails left to send today: " + MailApp.getRemainingDailyQuota());
    console.log(
      "For reference: a free gmail.com account is allowed 100 a day, a paid " +
      "Workspace account 1,500. Whichever you see above is the real ceiling " +
      "on how many people can sign in in one day.\n" +
      "The database holds its own, lower ceiling in the mail_limits table, " +
      "set to 25 an hour and 80 a day, so that OUR limit fires first and " +
      "shows up in the health check. Hitting Google's limit instead stops " +
      "all sending for up to 24 hours with no warning.\n" +
      "If the number above is 1500, raise ours to match with:\n" +
      "  update mail_limits set per_hour = 200, per_day = 1200 where id = 1;"
    );
  } catch (err) {
    console.error("Could not read the daily allowance: " + err);
  }

  var mode = senderMode_();

  if (mode === "own") {
    console.log(
      "GOOD, and nothing to set up. This script is owned by " + FROM_ADDRESS +
      ", so emails already come from there."
    );
    return;
  }

  var aliases = [];
  try {
    aliases = GmailApp.getAliases();
  } catch (err) {
    console.error("Could not list the Send mail as addresses: " + err);
  }
  console.log("It can also send as: " + (aliases.join(", ") || "(nothing else)"));

  if (mode === "alias") {
    console.log("GOOD. Emails will come from " + FROM_ADDRESS + ".");
    return;
  }

  console.log(
    "NOT READY. This account cannot send as " + FROM_ADDRESS + " yet, so every " +
    "email would go out from " + owner + " instead and learners would see the " +
    "wrong sender.\n\n" +
    "Two ways to fix it, either is fine:\n" +
    "  a. Move this script: open it signed in as " + FROM_ADDRESS + " and make " +
    "a copy there. Then there is nothing else to do.\n" +
    "  b. Or, in Gmail as " + owner + ": gear, See all settings, Accounts, " +
    "Send mail as, Add another email address. Enter " + FROM_ADDRESS + ". " +
    "Google emails a confirmation to that gmail account; open it and click " +
    "the link. Then run this again."
  );
}

/**
 * RUN THIS ONCE to check the settings are right.
 */
function testConnection() {
  var s;
  try {
    s = settings_();
  } catch (err) {
    console.log("STOP: " + err.message);
    return;
  }
  try {
    var answer = callSupabase_(s, "mail_ping", { p_token: s.token });
    console.log("Supabase replied: " + answer);
    if (String(answer).indexOf("BAD TOKEN") === 0) {
      console.log(
        "The token does not match. Check that the MAILER_TOKEN script " +
        "property is exactly the text the database holds."
      );
    } else {
      console.log("Connection is good. Now run checkSenderReady, then createTrigger.");
    }
  } catch (err) {
    console.log("Could not reach Supabase: " + err);
  }
}

/**
 * RUN THIS ONCE to start the automatic sending.
 * Safe to run again: it clears any old trigger first.
 */
function createTrigger() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === "sendPendingCodes") {
      ScriptApp.deleteTrigger(existing[i]);
    }
  }
  ScriptApp.newTrigger("sendPendingCodes").timeBased().everyMinutes(1).create();
  console.log("Done. Codes will now be sent automatically every minute.");
}

/**
 * Run this if you ever want to stop the automatic sending.
 */
function removeTrigger() {
  var existing = ScriptApp.getProjectTriggers();
  var n = 0;
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === "sendPendingCodes") {
      ScriptApp.deleteTrigger(existing[i]);
      n++;
    }
  }
  console.log("Removed " + n + " trigger(s). Codes will no longer be sent.");
}

/**
 * Sends one of each kind to you, so you can see all five.
 * It does not touch the real outbox.
 */
function sendSamplesToMyself() {
  var me = Session.getEffectiveUser().getEmail();
  var mode = senderMode_();
  var kinds = [
    "certificate_code",
    "academy_signup",
    "academy_recovery",
    "academy_signin",
    "academy_email_change",
  ];
  for (var i = 0; i < kinds.length; i++) {
    var msg = buildEmail_("123456", kinds[i]);
    var options = { htmlBody: msg.html, name: FROM_NAME, replyTo: REPLY_TO };
    if (mode === "alias") options.from = FROM_ADDRESS;
    GmailApp.sendEmail(me, "[SAMPLE " + kinds[i] + "] " + msg.subject, msg.plain, options);
  }
  console.log(
    "Five samples sent to " + me + ". " +
    (mode === "no"
      ? "They came from this account, NOT from " + FROM_ADDRESS +
        ". Run checkSenderReady()."
      : "Check the From line reads " + FROM_ADDRESS + ".")
  );
}
