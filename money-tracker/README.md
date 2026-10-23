# Telaga — private money tracker and journal for Moni and haavaana

A personal web app for tracking money in rupiah. Works on phone and desktop, deployed on Vercel, locked behind one password.

**What it does**
- Add expenses, income, transfers between wallets, and balance fixes
- Quick entry: type `parkir 40rb, gaji 5jt` and review the drafts before saving (rules, no AI)
- Receipts: **scan a receipt photo** and the app reads the items, tax, service fee, discount, total, shop name and date on your phone (no AI, nothing sent anywhere to be read). You check and fix before saving
- **Import from Gmail:** bank, e-wallet and shop emails become drafts you confirm (setup below)
- Repeating transactions (daily, weekly, monthly, yearly), added automatically when due
- History with search, date ranges, filters, bulk delete and CSV export
- Reports: daily calendar, category donut, spending pace vs last month, and a "follow the money" flow chart
- Budgets per category with a pace marker, a custom month start day, wallets (including credit cards with due dates), and savings goals
- **Journal:** mood on a 5-face scale, optional energy level, activity tags and a note. The overview's painted sky follows your mood (storm → rain → clouds → sun → rainbow)
- **Mood insights:** mood over time with a 7-day average, mood by weekday, how often each mood, which activities go with better days, mood on exercise days, spending on low-mood days, a Mood Meter grid, and a year in pixels
- **Sports:** running (time, distance, automatic pace, effort 1–10, heart rate) and tennis (time on court, singles or doubles, result, score), with weekly distance and personal bests
- **Food journal:** photo of your meal → cut each dish out as a sticker (tap it, or trace it with your finger) → pick it from a food list and set the portion → calories and macros vs your daily goal. Day canvas with draggable stickers, Moments, Month and List views
- **Stock journal:** trades with buys and sells (partial exits), setup, signals, market context, emotion, review; win rate, profit factor, average win vs loss, expectancy, max drawdown, equity curve, results by setup / emotion / plan discipline
- **Calendar:** month view with reminders and events (one-off or repeating) plus each day's mood, workouts and spending; push alerts to your phone

---

## Deploy it (about 20 minutes, all free tiers)

You need: a GitHub account and a Vercel account (sign up to Vercel with GitHub).

### 1. Put the code on GitHub

1. Unzip this project on your computer.
2. On github.com, click **New repository**. Name it `money-tracker`, choose **Private**, and do **not** add a README. Click **Create repository**.
3. In a terminal, inside the unzipped folder:
   ```bash
   git init
   git add .
   git commit -m "First version"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/money-tracker.git
   git push -u origin main
   ```
   (If you prefer no terminal: on the empty repo page choose **uploading an existing file** and drag the folder's contents in. Do not upload `node_modules` or `.env.local`.)

### 2. Create the project on Vercel

1. Go to vercel.com → **Add New… → Project** → pick your `money-tracker` repo → **Import**.
2. Before clicking Deploy, open **Environment Variables** and add these two:

   | Name | Value |
   |---|---|
   | `APP_PASSWORD` | The password you will type to open the app. Make it long (a sentence works). |
   | `SESSION_SECRET` | A random string of 64 characters. Generate one at the terminal with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, or mash the keyboard for 64+ characters. |

3. Click **Deploy**. The first deploy will build fine but the app cannot work yet, because it has no database. That's next.

### 3. Add the database (Neon Postgres)

1. In your Vercel project, open the **Storage** tab → **Create Database** → choose **Neon** (Serverless Postgres) → follow the prompts. Pick the **Free** plan.
2. **Region:** pick **Singapore** if you mostly use the app from Indonesia, or **Frankfurt** if mostly from Europe.
3. Connect it to your `money-tracker` project. Vercel adds `DATABASE_URL` and some other variables for you automatically.
4. Go to **Deployments**, open the menu on the latest deployment, and click **Redeploy** so the app picks up the new variables.

**Match the server region to the database.** `vercel.json` sets the app's server region to Singapore (`sin1`). If you chose Frankfurt for the database, change it to `"fra1"` and push again. If they are far apart, every page will feel slow. *(I'm not fully certain every Vercel plan allows choosing the region this way; if the deploy complains, delete `vercel.json` and set the region in Project → Settings → Functions instead.)*

### 4. Open it

Visit the URL Vercel gives you (something like `money-tracker-xxxx.vercel.app`) and sign in with your `APP_PASSWORD`. On first sign-in the app creates its tables and starter categories by itself.

**On your phone:** open the URL in Safari or Chrome, then **Share → Add to Home Screen** (iPhone) or **⋮ → Add to Home screen** (Android). It then opens full screen like an app.

---

## Two people, two passwords

The login screen only asks for a password. The password decides whose app opens:

| Person | Password variable in Vercel | Data lives in |
|---|---|---|
| Moni | `APP_PASSWORD` | the original Neon database (all existing data) |
| haavaana | `APP_PASSWORD_2` | a second database called `haavaana`, created automatically on her first sign-in |

The two are completely separate databases, so neither can see the other's money, journal, sports, calendar, alerts or settings.

**To add haavaana:** Vercel → Settings → Environment Variables → add `APP_PASSWORD_2` with her password (must be different from `APP_PASSWORD`) → redeploy. Then she signs in with it.

*If her first sign-in says it couldn't create the database:* in the Neon console open your project → **Databases → New database**, name it `haavaana` (same owner as the existing one), then sign in again.

Names: `APP_NAME_1` / `APP_NAME_2` change the displayed names (defaults Moni and haavaana). When adding to the home screen, iPhone suggests a name you can edit; type the person's name there.

**Alerts:** one cron-job.org link (from either person's Settings) sends reminders for both.

---

## Import transactions from Gmail (about 5 minutes, free)

A small script runs inside your own Gmail (Google Apps Script) and sends new transaction emails to the app every 15 minutes. The app never logs in to Google. Nothing is saved as a transaction until you tap **Add**.

1. In the app: **Settings → Import from Gmail → Copy the script**.
2. On a computer, go to **script.google.com**, signed in to the Gmail that receives your bank emails → **New project**.
3. Delete the sample code, paste the script, save.
4. Choose **setup** in the function menu at the top → **Run** → allow the permissions. Google may warn that the app isn't verified; choose **Advanced → Go to (project name)**. It is your own script.
5. New items appear on the overview as "📬 … from email to check", and under **From email**.

**Good to know**
- It only catches payments that send an email. Many banks and e-wallets only notify inside their app; check your inbox to see which of yours email you.
- The rules are general (Indonesian and English wording such as "Nominal", "Total pembayaran", "Merchant:", "dana masuk"). I wrote them without real emails from your banks, so some emails will land in **Couldn't read**. Send me an example (black out account numbers) and a rule can be added for that bank.
- Email transactions come out of the wallet chosen in **Settings → Import from Gmail** (by default your first wallet of type *Bank account*). A wallet named after the sender (e.g. "GoPay") gets that sender's emails instead.
- Each person has their own key and script; drafts go to the right person's data. **New key** in Settings stops an old script.
- Emails are marked with the Gmail label `telaga-imported` so they are never sent twice. To stop importing, delete the project at script.google.com (or its trigger).

## Food journal

**+ → Meal**, take a photo, then **Cut out a dish** for each dish:
- **Tap to cut:** tap the middle of a dish; tap again to add a missed part, or use **Remove a part**. This uses Google's free MediaPipe "Magic Touch" model, run on your phone. The first use downloads the runtime from your app (about 13.5 MB) and the model from Google's official storage (size not published; I couldn't download it to measure). Your browser keeps both afterwards.
- **Trace:** draw around the dish with your finger. Always works, no download. The app switches to this automatically if tap-to-cut can't load.

Only the finished stickers are saved (max 512 px, about 20–60 KB each); the photo itself stays on your phone.

Calories come from the food list, not from the photo. The 64 starter dishes are rough averages I wrote myself, not from an official table, so correct them when you log: the app remembers your version for next time. New dishes you type with calories join your list automatically.

*Optional: host the model yourself* (so nothing is fetched from Google): download
`https://storage.googleapis.com/mediapipe-models/interactive_segmenter_v2/magic_touch/int8/1/interactive_segmentation.task`
and upload it to your GitHub repo as `public/models/interactive_segmentation.task`. The app uses it automatically when it's there.

## Stock journal

**+ → Trade**: ticker, stop and target (reward : risk shows live), buys with price and lots, setup, signals, context and how you felt. Fees fill in from your rates (Stock journal → Stock settings; defaults 0.15% buy and 0.25% sell, which you should check against your broker). Use **Close** on an open position to add the sell and your review; a trade closes by itself when everything bought is sold.

P&L uses the average-cost method and includes fees. Set **starting capital** for the equity curve and drawdown %. Prices are typed by you; nothing is fetched from the market.

## Receipt scanning

In **+ → Expense**, tap **Scan a receipt** and take or pick a photo. The reader (Tesseract) runs on your phone; the first scan downloads about 9 MB, later scans start faster. It fills the lines, total, title, date and a category guess, and tells you whether the lines add up to the total.

For best results: receipt flat, straight on, filling the frame, in good light. Faded thermal paper, creases and handwritten bills read badly. Always check the lines before saving.

## Turn on reminder alerts (about 10 minutes, free)

Alerts need two things: your phone allowing them, and a free service that wakes the app every minute (Vercel's free plan can only run scheduled jobs once a day).

### A. On your iPhone (iOS 16.4 or newer)
1. Install Telaga to your home screen (Safari → Share → **Add to Home Screen**). Alerts do not work in a normal Safari tab.
2. Open Telaga **from the home screen** and sign in.
3. Go to **Calendar** (or **Settings**) → **Alerts on this device** → **Turn on alerts** → **Allow**.
4. Tap **Send a test alert**. You should get a notification within a few seconds.

Repeat on any other device you want alerts on (a laptop browser works too).

### B. The every-minute pinger (cron-job.org)
1. In Telaga, go to **Settings → Reminder sender → Copy the private link**.
2. Create a free account at **cron-job.org**.
3. Create a new cron job: paste the link as the **URL**, set the schedule to **every minute**, and save. *(The site's labels may differ slightly from these words.)*
4. After a minute, its history should show successful runs (status 200).

Test it: add a reminder 3 minutes from now with the alert "At the time", lock your phone and wait.

**How reliable is it?** I tested that the app sends correctly signed, encrypted alerts at the right minute and never sends the same alert twice. Delivery to the phone itself goes through Apple's push service, which I could not test from here. Push alerts are usually quick but are not guaranteed to the second, so don't rely on them for anything critical.

**If the pinger misses a minute**, the next run still sends alerts up to 15 minutes late. If cron-job.org stops working, reminders still show in the calendar; only the alerts stop.

---

## How private is it?

- Every page, every data request and every save checks for a signed login cookie. Without the password, nobody sees anything, even with the URL.
- The reminder link has its own long secret key. It can only trigger alerts that are already due; it cannot read or change your data. Push keys are created automatically and stored in your database.
- After 5 wrong passwords, that network address is locked out for 15 minutes.
- Search engines are told not to list the site (`robots.txt`, `noindex` header and meta tag). This only keeps it out of Google; the password is the real protection.
- Your data lives in your own Neon database. Receipt photos are shrunk in the browser (to roughly 150–300 KB) and stored in that database too.
- **Vercel preview links:** Vercel may protect preview deployments with its own login by default. Your main production URL relies on the app's password, which is enough.

**Change the password:** edit `APP_PASSWORD` in Vercel → Settings → Environment Variables, then redeploy.
**Sign out every device:** change `SESSION_SECRET` and redeploy.

---

## Free tier limits (check current numbers; they change)

- **Neon Free:** 1 GB storage per project and 100 compute-hours per month at the time of writing. A personal tracker with a few thousand transactions and some receipt photos should stay well inside this. The database sleeps after 5 minutes idle, so the first load after a break can take a second or two longer.
- **Vercel Hobby:** for personal, non-commercial use, which this is.

---

## Using it

| Want to… | Do this |
|---|---|
| Add something fast | Type in the box on the overview: `kopi 25rb`, `bensin 50k pakai gopay`, `gaji 7,5jt` |
| Add with full detail | The orange **+** button (or press **N** on desktop) |
| Record a receipt with tax | In the add form: **Add receipt or item breakdown** → add items → **Tax 11%** → **Use as amount** |
| Pay a credit card bill | **Transfer** from your bank wallet to the card |
| Fix a wallet that doesn't match reality | Wallets → **Fix a balance**, type what the wallet really holds |
| Teach quick entry new words | Settings → a category → add keywords, separated by commas |
| Start your month on payday | Budgets → **Starts on day …** |
| Hide amounts in public | The eye button next to a total |
| Write today's journal | Tap a face on the overview, or **+ → Journal** |
| Log a run or tennis | **+ → Run** or **+ → Tennis**; pace fills in by itself |
| Set a reminder | **+ → Reminder**, or tap a day in Calendar |
| Add your own activities (e.g. "Lab", "Mosque", "Gym") | Settings → Journal activities |

Amounts you type accept `rb`, `ribu`, `k`, `jt`, `juta`, and `1,5jt` style decimals.

---

## Updating an existing deployment

Upload the new files over the old ones in GitHub (same way as the first upload: **Add file → Upload files**, drag in everything inside the folder, **Commit changes**). Vercel redeploys by itself in about a minute. New database tables are created automatically on the next sign-in; your existing data is kept.

---

## Run it on your own computer (optional)

Needs Node.js 20 or newer and a Postgres database (a second Neon branch works well).

```bash
npm install
cp .env.example .env.local   # then fill in the three values
LOCAL_HTTP=1 npm run dev     # LOCAL_HTTP lets the login cookie work over plain http://localhost
```

## Project map

```
src/proxy.ts                 login check in front of every request
src/app/login/               sign-in page and rate limit
src/app/(app)/               the screens: overview, history, reports, budgets, wallets, settings
src/app/actions.ts           every save, edit and delete (each re-checks the login)
src/lib/db.ts                database connection, tables, starter categories
src/lib/parse.ts             quick-entry rules ("parkir 40rb")
src/app/(app)/journal/       journal list and mood insights
src/app/(app)/sports/        running and tennis
src/app/(app)/calendar/      month view, reminders
src/app/api/cron/reminders/  sends due alerts when pinged
src/app/api/import/email/    receives emails from the Gmail script
src/lib/email-parse.ts       rules that read bank/e-wallet emails
src/lib/receipt.ts, ocr.ts   receipt reading (text -> items) and the on-device reader
public/ocr/                  the reader and its language files (Indonesian + English)
src/lib/cutout.ts            dish cutouts (MediaPipe tap + finger trace), sticker maker
public/mediapipe/            MediaPipe runtime files, served by the app
src/app/(app)/food/          food journal pages; src/app/food-actions.ts saves
src/lib/stocks.ts            stock P&L, win rate, profit factor, drawdown
src/app/(app)/stocks/        stock journal page; src/app/stock-actions.ts saves
src/lib/push.ts, public/sw.js  push alerts
src/components/              shared UI: sheets, transaction list, charts
```

The illustrations are original paintings drawn in code and saved as the 8 images in `public/art`.
