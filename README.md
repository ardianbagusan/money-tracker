# Telaga: a personal money tracker and life journal

A private web app I built to track my own money in rupiah, and to keep a journal of mood, sports, food and trades in the same place. It works on phone and desktop, is deployed on Vercel, and is locked behind a password.

**Live demo:** not public, because it holds personal data. [Add screenshots or a short demo video here.]

## Why I built it

This is a personal project for my own use. I wanted a money tracker that fits how I actually spend and live: Indonesian rupiah, quick typing like `parkir 40rb`, and bank or e-wallet emails turned into drafts. I studied how an existing money-tracking app works (Oyenza), decided which features mattered to me, and rebuilt them as my own tool. I then added things I wanted that the original did not have.

I'm sharing it as an example of what I can build and ship on my own: I defined the problem, designed the features, deployed it, and use it every day. The goal was a tool that is clear and easy to use, not just one that works.

## Features

**Money**
- Expenses, income, transfers between wallets, and balance corrections
- Quick entry from plain text with rules, no AI: `parkir 40rb, gaji 5jt` becomes drafts you review before saving
- Receipt scanning: OCR runs in the browser (Tesseract), reads items, tax, service fee, total, shop and date, and you check it before saving
- Import from Gmail: a small Google Apps Script sends bank and e-wallet emails to the app as drafts that you confirm
- Recurring transactions, budgets with a custom month start day, wallets (including credit cards), and savings goals
- History with search, filters, bulk delete and CSV export; reports with a daily calendar, category chart, spending pace and a money-flow chart

**Journal and life tracking**
- Mood journal with insights (mood by weekday, activities linked to better days, spending on low-mood days)
- Sports log for running and tennis
- Food journal: cut dishes out of a meal photo (MediaPipe, on-device) and track calories and macros
- Stock journal: trades, partial exits, win rate, profit factor, expectancy, max drawdown, equity curve
- Calendar with reminders and push notifications

## How it is built

| Part | Choice |
|---|---|
| App | TypeScript web app (React, server actions), installable as a PWA |
| Database | Postgres on Neon (serverless, free tier) |
| Hosting | Vercel (Hobby plan) |
| Auth | Single password, signed session cookie, rate limiting after 5 failed attempts |
| OCR | Tesseract, running client-side |
| Image cutout | MediaPipe interactive segmentation, running client-side |
| Alerts | Web Push with a service worker, triggered by an external cron ping |
| Email import | Google Apps Script posting to an API route |

### Design decisions

- **Privacy first.** Every page, data request and save checks a signed login cookie. Receipt OCR and food cutouts run on the device, so photos are not sent to a third-party service. The site is also marked `noindex`.
- **No AI where rules are enough.** Quick entry and email parsing use plain parsing rules. They are predictable, free to run and easy to debug. The trade-off is that unusual email formats land in a "Couldn't read" list until a rule is added.
- **Free-tier architecture.** The app runs on free tiers, so I kept the server region next to the database and used an external cron service for per-minute reminders, because Vercel's free plan only allows daily cron jobs.
- **Multi-user separation.** The password decides which database opens, so each user's data is fully separate.

### Project structure

```
src/proxy.ts              login check in front of every request
src/app/(app)/            screens: overview, history, reports, budgets, wallets, settings,
                          journal, sports, calendar, food, stocks
src/app/actions.ts        all saves, edits and deletes (each re-checks the login)
src/lib/db.ts             database connection, tables, starter categories
src/lib/parse.ts          quick-entry rules
src/lib/email-parse.ts    bank and e-wallet email parsing
src/lib/receipt.ts, ocr.ts  receipt reading
src/lib/cutout.ts         dish cutouts
src/lib/stocks.ts         stock P&L and statistics
src/lib/push.ts           push alerts
src/app/api/              cron reminders, email import endpoint
```

## Run it locally

Needs Node.js 20 or newer and a Postgres database (a Neon branch works well).

```bash
npm install
cp .env.example .env.local     # fill in the values below
LOCAL_HTTP=1 npm run dev       # LOCAL_HTTP lets the login cookie work over http://localhost
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `APP_PASSWORD` | Password to open the app |
| `SESSION_SECRET` | Random 64+ character string used to sign the login cookie |

Tables and starter categories are created automatically on first sign-in.

## Deploy

1. Push the repo to GitHub.
2. Import it in Vercel and set `APP_PASSWORD` and `SESSION_SECRET`.
3. Add a Neon Postgres database from Vercel's Storage tab, then redeploy.

## Known limitations

- Email import only catches payments that actually send an email, and the parsing rules were written without real samples from every bank.
- The starter calorie values are rough averages I wrote myself, not an official food table.
- Stock prices are typed by hand; nothing is fetched from the market.
- Push notification delivery depends on the browser or OS push service and is not guaranteed to the second.

## About me

Satria, based in Hasselt, Belgium. [One line on your background that fits this application. Add your LinkedIn / GitHub / email.]
