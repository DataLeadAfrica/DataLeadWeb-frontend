/**
 * Data-Lead Academy: the alarm.
 *
 * Calls system_health() in Supabase once a day and emails you ONLY when
 * something is wrong, plus one short "all good" note every Monday so that
 * silence can never hide a dead alarm.
 *
 * WHICH GOOGLE ACCOUNT SHOULD OWN THIS
 * A Workspace account that will outlive any one person's involvement, and that
 * somebody else can be given access to. Do NOT use a personal Gmail. If you can,
 * create or use an operations account and share edit access with one other
 * person, so the alarm does not die with a single login.
 *
 * WHERE THE TOKEN LIVES
 * In Script Properties. Never in this code, never in a Sheet, never in an email.
 * Extensions, Apps Script, then the gear icon, Project Settings, then
 * Script properties, then Add script property. You need four:
 *
 *   SUPABASE_URL        https://YOUR-PROJECT-REF.supabase.co
 *   SUPABASE_ANON_KEY   the publishable (anon) key from Supabase
 *   HEALTH_TOKEN        the long random string you passed to lms_set_health_token
 *   ALERT_EMAIL         where alarms should go, for example you@dataleadafrica.com
 *
 * THE DAILY TRIGGER
 * In the Apps Script editor, click the clock icon (Triggers), then Add Trigger:
 *   Choose which function to run        dailyCheck
 *   Which runs at deployment            Head
 *   Select event source                 Time-driven
 *   Select type of time based trigger   Day timer
 *   Select time of day                  7am to 8am
 * Save. Google will ask you to authorise it once.
 *
 * WHY THIS ALSO KEEPS THE PROJECT AWAKE
 * Supabase pauses a free project after about a week with no traffic, and waking
 * it is a manual step you would only discover when a learner could not sign in.
 * This call arrives from Google's servers, not from inside Supabase, so it counts
 * as real outside traffic. One request a day is enough to keep the project
 * active, which means the alarm pays for itself twice: it tells you when
 * something is broken, and it stops one of the things that breaks.
 */

function dailyCheck() {
  var props = PropertiesService.getScriptProperties();
  var url   = props.getProperty('SUPABASE_URL');
  var key   = props.getProperty('SUPABASE_ANON_KEY');
  var token = props.getProperty('HEALTH_TOKEN');
  var to    = props.getProperty('ALERT_EMAIL');

  if (!url || !key || !token || !to) {
    // Nothing else can work, so say so loudly rather than failing quietly.
    if (to) {
      MailApp.sendEmail(to, 'Data-Lead Academy alarm is not set up',
        'The alarm script ran but one of its four script properties is missing:\n\n' +
        'SUPABASE_URL, SUPABASE_ANON_KEY, HEALTH_TOKEN, ALERT_EMAIL\n\n' +
        'Set them under Project Settings, Script properties.');
    }
    throw new Error('Missing script properties. See the comment at the top of this file.');
  }

  var rows, failure = null, httpCode = 0;
  try {
    rows = callHealth(url, key, token);
  } catch (e) {
    failure = String(e);
    httpCode = e.httpCode || 0;
  }

  if (failure) {
    var subject, advice;
    if (httpCode === 0) {
      // Nothing answered at all.
      subject = 'ALARM: Data-Lead Academy database unreachable';
      advice =
        'Nothing answered at the address at all.\n\n' +
        'This usually means the Supabase project is paused, the address in ' +
        'SUPABASE_URL is wrong, or the project is down. Open the Supabase ' +
        'dashboard.';
    } else if (httpCode === 401 || httpCode === 403) {
      subject = 'ALARM: Data-Lead Academy health check was refused';
      advice =
        'The database answered, so it is up. It refused the key.\n\n' +
        'Check SUPABASE_ANON_KEY against the key in the dashboard under ' +
        'Project Settings, API.';
    } else if (httpCode >= 500) {
      subject = 'ALARM: Data-Lead Academy database returned an error';
      advice =
        'The database answered with a server error. If it persists, check ' +
        'the Supabase status page and the project logs.';
    } else {
      // 4xx with a body. The project is UP and answering; the call itself
      // failed. Usually a fault in the health check function, not an outage.
      subject = 'ALARM: Data-Lead Academy health check is broken';
      advice =
        'The database is UP and answering. It is the health check call that ' +
        'failed, so this is almost certainly a fault in the system_health ' +
        'function rather than an outage.\n\n' +
        'Nothing a learner does depends on system_health, so sign in and ' +
        'email are probably unaffected. Confirm that separately before ' +
        'treating this as an emergency.\n\n' +
        'Send the message above on, it names the fault.';
    }
    MailApp.sendEmail(to, subject,
      'The daily health check did not come back.\n\n' + failure +
      '\n\n' + advice +
      '\n\n---\nChecked at ' + nowText());
    return;
  }

  var overall = 'unknown';
  var lines = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.item === 'OVERALL') { overall = r.severity; }
    lines.push(pad(r.severity) + ' ' + r.item + ': ' + r.value);
  }

  // The token being refused is itself an alarm: it means the alarm is blind.
  if (rows.length === 1 && rows[0].item === 'TOKEN') {
    MailApp.sendEmail(to, 'ALARM: Data-Lead Academy health check refused the token',
      'The health check rejected the token in HEALTH_TOKEN, so the alarm is ' +
      'currently blind.\n\n' + lines.join('\n') +
      '\n\nFix: in the Supabase SQL editor run\n' +
      "  select lms_set_health_token('the same string that is in HEALTH_TOKEN');");
    return;
  }

  var body = lines.join('\n') +
    '\n\n---\nChecked at ' + nowText() +
    '\nThis is the daily automatic check. It emails you only when something is ' +
    'wrong, and once every Monday to prove it is still alive.';

  if (overall === 'alarm' || overall === 'warn') {
    var subject = (overall === 'alarm' ? 'ALARM' : 'Warning') +
                  ': Data-Lead Academy needs attention';
    MailApp.sendEmail(to, subject, body);
    return;
  }

  // All well. Stay quiet, except on Mondays.
  var day = new Date().getDay();   // 0 Sunday, 1 Monday
  if (day === 1) {
    MailApp.sendEmail(to, 'All good: Data-Lead Academy weekly check', body);
  }
}

/**
 * Calls the system_health function over Supabase's REST interface.
 * Returns an array of {item, severity, value, detail}.
 */
function callHealth(url, key, token) {
  var endpoint = url.replace(/\/+$/, '') + '/rest/v1/rpc/system_health';
  var res = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key },
    payload: JSON.stringify({ p_token: token }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code !== 200) {
    // Tagged so the email can say what actually happened. A 400 carrying a
    // database error is NOT the project being unreachable, and saying so
    // sends somebody hunting an outage that is not there.
    var e = new Error('Supabase answered ' + code + ': ' + text.slice(0, 500));
    e.httpCode = code;
    e.body = text;
    throw e;
  }
  var parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error('Unexpected answer: ' + text.slice(0, 500));
  }
  return parsed;
}

/** Pads a severity so the email lines up when read on a phone. */
function pad(s) {
  var t = '[' + String(s).toUpperCase() + ']';
  while (t.length < 8) { t = t + ' '; }
  return t;
}

function nowText() {
  return Utilities.formatDate(new Date(), 'Africa/Lagos', 'EEE d MMM yyyy, HH:mm') + ' Lagos time';
}

/**
 * Run this once by hand, from the editor, to check the whole thing works.
 * It emails you whatever it finds, even if everything is fine.
 */
function testNow() {
  var props = PropertiesService.getScriptProperties();
  var to = props.getProperty('ALERT_EMAIL');
  var rows = callHealth(props.getProperty('SUPABASE_URL'),
                        props.getProperty('SUPABASE_ANON_KEY'),
                        props.getProperty('HEALTH_TOKEN'));
  var lines = [];
  for (var i = 0; i < rows.length; i++) {
    lines.push(pad(rows[i].severity) + ' ' + rows[i].item + ': ' + rows[i].value);
  }
  Logger.log(lines.join('\n'));
  MailApp.sendEmail(to, 'TEST: Data-Lead Academy health check',
    lines.join('\n') + '\n\n---\nThis was a manual test run at ' + nowText() + '.');
}
