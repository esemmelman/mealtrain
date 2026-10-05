# Gmail confirmations

The `anne-katz-notify` function can send directly through Gmail as `Meal Train <esemmoc@gmail.com>`. It uses only the `gmail.send` OAuth scope. The existing Resend path remains active until the `ANNE_EMAIL_PROVIDER=gmail` secret is set.

## One-time Google authorization

1. In [Google Cloud Console](https://console.cloud.google.com/), select or create a project and enable the **Gmail API**.
2. Configure Google Auth Platform branding, audience, and data access. Add the scope `https://www.googleapis.com/auth/gmail.send`. If the app is in Testing, add `esemmoc@gmail.com` as a test user. Move the audience to **In production** before generating the long-lived authorization; external Testing refresh tokens normally expire after seven days with this scope. Personal use does not normally require completing app verification, but Google can display an unverified-app notice.
3. Under Clients, create a **Desktop app** OAuth client and download its JSON into this repository as `gmail-client.json` (ignored by Git).
4. Run `node scripts/authorize-gmail.mjs gmail-client.json` locally. Open the printed URL, choose `esemmoc@gmail.com`, and authorize sending. The helper saves credentials to `.env.gmail`, which is also ignored by Git. Do not paste credentials into chat or commit them.
5. Open [bnaimitzvah Edge Function secrets](https://supabase.com/dashboard/project/fgomaujsdblpzxhnnqrg/functions/secrets). Add `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` using the values in `.env.gmail`.
6. Once all three credentials are saved, add `ANNE_EMAIL_PROVIDER` with value `gmail`. This activates Gmail for Meal Train only. DayFlow's other email functions and Resend secrets are unaffected.
7. Tell Codex that authorization is complete so it can verify sending and retry the pending confirmation. Never recreate the meal signup to retry email.

## Delivery and retries

Messages keep the existing confirmation text and subject `Anne`. Organizer and participant are sent separate emails. The function stores `gmail_organizer_id` and `gmail_participant_id` privately on the signup and skips recipients already accepted by Gmail on retries. Both recipients are attempted even if one fails, and failure logs identify the role and Google status without logging addresses, tokens, or message text. A two-minute send lease prevents overlapping calls for the same signup.

Gmail has no Resend-style idempotency key. If Gmail accepts an email but the response is lost or its database status cannot be recorded, a retry can still send a duplicate. A deterministic Message-ID is included for tracing, not as a guarantee of deduplication. Acceptance is not proof of inbox delivery.

Keri's original organizer confirmation was sent through Resend. A first Gmail retry can send another organizer confirmation because the original system did not store per-recipient message IDs. Confirm that original organizer delivery before deciding whether to skip it.

References: [Gmail sending](https://developers.google.com/workspace/gmail/api/guides/sending), [Google offline authorization](https://developers.google.com/identity/protocols/oauth2/web-server#offline), [Supabase secrets](https://supabase.com/docs/guides/functions/secrets).
