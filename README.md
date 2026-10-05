# Meal Train for Anne Katz

A responsive signup form backed by the existing Supabase bnaimitzvah project. No login or build step is required. Serve this directory with a static web server or GitHub Pages. Dates with a saved signup name have gray, disabled checkboxes.

Submit saves name, meal type, selected dates, email, phone, and comment. Cancel clears unsaved entries. Selected dates preview the entered name; saved names refresh every 15 seconds. Saved signups disable their dates in the form; existing names remain visible.

The dedicated public.anne_katz_mealtrain_signups table is independent of existing tables. schema.sql records the deployed definition; do not run it again against the same database. Browser access allows inserts and reads of names/dates only. Contact details and comments are not exposed through browser reads. The app.js key is intentionally publishable.

Dates are stored as October 10, 14, 18, and 22, 2026. Labels preserve the requested wording, though October 18 and 22 fall on Sunday and Thursday in 2026.

After saving a signup, the browser calls the bnaimitzvah project's anne-katz-notify Edge Function. It reads the saved answers and sends two separate emails through the DayFlow project's dedicated anne-katz-email-relay function, reusing DayFlow's existing RESEND_API_KEY and REMINDER_EMAIL_FROM secrets. One goes to esemmoc@gmail.com and the other to the signup's email address. Both use sender name Meal Train and subject Anne. The body uses the supplied Google Doc's confirmation wording, with <signup-dates> replaced by the selected date labels. The template is a snapshot in email-template.ts, not a live Google Doc fetch. No email credentials are stored in GitHub or the browser. Email failure leaves the signup saved and displays a notification warning. email_notified_at is set only after both emails are accepted; separate Resend idempotency keys prevent duplicate notifications on retries. Email provider acceptance does not guarantee inbox delivery.

Deployment projects: anne-katz-notify belongs to fgomaujsdblpzxhnnqrg (bnaimitzvah); anne-katz-email-relay belongs to ynfjfanvdvpyycoeweca (DayFlow). The function source directories are checked in here for both deployments.

Gmail sending is available in `anne-katz-notify` after the one-time authorization in [GMAIL_SETUP.md](GMAIL_SETUP.md). Set `ANNE_EMAIL_PROVIDER=gmail` only after saving the Gmail credentials. Until then, the existing Resend relay remains selected.
