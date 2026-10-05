# Connect Gmail through Apps Script

The private file `.local-mailtrain/MealTrain-Code.txt` is ready to copy. It contains a generated connection token shared only with the server. Do not share it, paste it into chat, or commit it. The template in `apps-script/Code.gs` has no secret.

1. Open https://script.google.com/home/start as **esemmoc@gmail.com**. Create a project if needed, and name it **Meal Train Email**.
2. Open `.local-mailtrain/MealTrain-Code.txt` in Notepad. Copy all its contents. In Apps Script, select **Code.gs**, replace the starter function with the copied code, and save.
3. Click **Deploy → New deployment**. Click the gear beside **Select type**, then select **Web app**.
4. Description: **Meal Train confirmations**. **Execute as: Me (esemmoc@gmail.com)**. **Who has access: Anyone**. The server has no Google browser session, so signed-in-only access will not work. The code requires the private token on every send.
5. Click **Deploy**, then **Authorize access** when prompted. Select **esemmoc@gmail.com** and allow sending mail. If Google shows an unverified-app notice for your own new script, review it and use **Advanced → Go to Meal Train Email** if offered. You do not need to enter credentials into chat.
6. Copy the **Web app URL** ending in **/exec** and send that URL to Codex. Do not send the code or token. Codex will store the URL server-side, check authenticated connectivity and quota, and activate this sender. The URL alone cannot authorize sending.

The backend is deployed but remains on the old sender until a URL is configured. The OAuth Desktop client setup is unnecessary for this route.

Messages use sender name **Meal Train**, subject **Anne**, and the existing confirmation wording. Both recipients are attempted independently. The server stores per-recipient receipts, and the script keeps a private ledger with a lock to avoid duplicating successfully recorded sends. MailApp does not provide provider message IDs or prove inbox delivery. If a send succeeds but the script cannot save its receipt, a retry can still duplicate it.

When editing a deployed script later, use **Deploy → Manage deployments → Edit → New version → Deploy**. Saving code alone does not update the `/exec` deployment.

References: [Apps Script web apps](https://developers.google.com/apps-script/guides/web), [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app).
