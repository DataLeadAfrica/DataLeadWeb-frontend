# Excel Basics applications: Google Sheet setup

This connects the application form at https://dataleadafrica.com/register/excel-basics/ to a Google Sheet. Each application becomes a row in the sheet, and the applicant gets a confirmation email.

You only do this once. It takes about 10 minutes.

## Before you start: which Google account?

Google limits how many emails a script can send each day:

- a normal Gmail account: about **100 emails a day**;
- a Google Workspace account (for example an @dataleadafrica.com account): about **1,500 emails a day**.

If you can, do every step below while signed in to the **Data-Lead Africa Workspace account**, so a busy day does not run out of emails.

If the limit is reached, nothing is lost. The application is still saved, its "Email status" shows **Pending**, and the script sends it automatically within the hour once the daily limit resets.

## 1. Create the sheet

1. Go to https://sheets.google.com and create a blank spreadsheet.
2. Name it **Excel Basics applications 2026**.
3. Look at the address bar. The address looks like this:
   `https://docs.google.com/spreadsheets/d/`**`1AbCdEfGh...XyZ`**`/edit`
4. Copy the long part between `/d/` and `/edit`. This is the **sheet ID**. Keep it for step 3.

You do not need to type any headings. The script creates them.

## 2. Open Apps Script and paste the code

1. In the sheet, click **Extensions**, then **Apps Script**. A new tab opens.
2. Click the project name at the top ("Untitled project") and rename it **Excel Basics applications**.
3. In the file called `Code.gs`, select everything and delete it.
4. Open `docs/forms/excel-basics/Code.gs` from the website repo, copy all of it, and paste it into the empty `Code.gs`.
5. Click the **Save** icon.

## 3. Set the sheet ID

1. Near the top of `Code.gs`, find this line:
   `var SHEET_ID = "PASTE_THE_SHEET_ID_HERE";`
2. Replace `PASTE_THE_SHEET_ID_HERE` with the sheet ID from step 1. Keep the quote marks.
3. Click **Save**.

## 4. Run setup once

This gives the script permission to use your sheet and Gmail, and creates the hourly job that sends any Pending emails.

1. In the toolbar, find the function menu (next to **Debug**) and choose **setup**.
2. Click **Run**.
3. Google asks for permission. Click **Review permissions**, choose your account, then **Advanced**, then **Go to Excel Basics applications (unsafe)**, then **Allow**. ("Unsafe" only means Google has not reviewed your own script.)
4. Wait for "Execution completed". Go back to the sheet. You should now see two tabs: **Applications** (with the headings) and **Summary**.

Optional check: choose **runFullSelfTest** in the function menu, click **Run**, and read the log. Every line should start with PASS.

## 5. Deploy as a Web app

1. Click **Deploy** (top right), then **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in:
   - Description: **Excel Basics applications**
   - Execute as: **Me**
   - Who has access: **Anyone** (not "Anyone with Google account")
4. Click **Deploy**, and allow access again if asked.
5. Copy the **Web app URL**. It ends in `/exec`.
6. Send this URL to Claude. It goes into the website form in Stage 2.

To check it works, open the URL in a private (incognito) window. You should see a short line starting with `{"ok":true`.

## 6. Making changes later

If you ever change the code, **do not** create a new deployment, because that gives a new URL and the form would stop saving.

Instead:

1. Click **Deploy**, then **Manage deployments**.
2. Click the **pencil** (edit) icon.
3. Under **Version**, choose **New version**.
4. Click **Deploy**.

The URL stays the same.

## Using the sheet

- **Status** shows **New**, or **Late** if an application arrived after 11:59 pm on Tuesday 13 October 2026.
- **Duplicate of** shows the earlier reference when the same email or WhatsApp number applies again. No second email is sent for duplicates.
- **WhatsApp link** opens a chat with the applicant.
- **Email status** shows **Sent**, **Pending** (goes out within the hour) or **Not sent: duplicate**.
- **Selected** is a tick box for the team.
- The **Summary** tab counts applications by attendance, laptop, Excel use, how they heard about us, and area. Its counts leave out duplicates.

## If applications are not arriving

1. Open the Web app URL in a private window. If it does not show `{"ok":true`, check that **Who has access** is **Anyone**.
2. Run **runFullSelfTest** and read the log.
3. Make sure the latest code is live: **Deploy**, **Manage deployments**, pencil, **New version**, **Deploy**.
4. Make sure `SHEET_ID` is the ID of the right sheet.
