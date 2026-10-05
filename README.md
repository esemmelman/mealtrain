# Meal Train for Anne Katz

A responsive signup form backed by the existing Supabase bnaimitzvah project. No login or build step is required. Serve this directory with a static web server or GitHub Pages.

Submit saves name, meal type, selected dates, email, phone, and comment. Cancel clears unsaved entries. Selected dates preview the entered name; saved names refresh every 15 seconds. Multiple people may sign up for a date.

The dedicated public.anne_katz_mealtrain_signups table is independent of existing tables. schema.sql records the deployed definition; do not run it again against the same database. Browser access allows inserts and reads of names/dates only. Contact details and comments are not exposed through browser reads. The app.js key is intentionally publishable.

Dates are stored as October 10, 14, 18, and 22, 2026. Labels preserve the requested wording, though October 18 and 22 fall on Sunday and Thursday in 2026.

After saving a signup, the browser calls the bnaimitzvah project's anne-katz-notify Edge Function. It reads the saved answers and sends an email through the DayFlow project's dedicated anne-katz-email-relay function, reusing DayFlow's existing RESEND_API_KEY and REMINDER_EMAIL_FROM secrets. The recipient is fixed to esemmoc@gmail.com and the subject is Anne. No email credentials are stored in GitHub or the browser. Email failure leaves the signup saved and displays a notification warning. email_notified_at and Resend's idempotency key prevent duplicate notifications on retries. Email provider acceptance does not guarantee inbox delivery.

Deployment projects: anne-katz-notify belongs to fgomaujsdblpzxhnnqrg (bnaimitzvah); anne-katz-email-relay belongs to ynfjfanvdvpyycoeweca (DayFlow). The function source directories are checked in here for both deployments.
