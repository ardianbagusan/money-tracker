# Telaga: a personal money tracker and life journal

A private web app I built to track my own money in rupiah, and to keep a journal of mood, sports, food and trades in the same place. It works on phone and desktop, is deployed on Vercel, and is locked behind a password.

**Live demo:** not public, because it holds personal data.
<img width="932" height="488" alt="image" src="https://github.com/user-attachments/assets/cf3fce4c-f056-41de-a2b1-e2234fbcb540" />


## Why I built it

This is a personal project for my own use. I wanted a money tracker that fits how I actually spend and live: Indonesian rupiah, quick typing like `parkir 40rb`, and bank or e-wallet emails turned into drafts. I studied how an existing money-tracking app works, decided which features mattered to me, and rebuilt them as my own tool. I then added things I wanted that the original did not have.

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

### Design decisions

- **Privacy first.** Every page, data request and save checks a signed login cookie. Receipt OCR and food cutouts run on the device, so photos are not sent to a third-party service. The site is also marked `noindex`.
- **No AI where rules are enough.** Quick entry and email parsing use plain parsing rules. They are predictable, free to run and easy to debug. The trade-off is that unusual email formats land in a "Couldn't read" list until a rule is added.
- **Free-tier architecture.** The app runs on free tiers, so I kept the server region next to the database and used an external cron service for per-minute reminders, because Vercel's free plan only allows daily cron jobs.
- **Multi-user separation.** The password decides which database opens, so each user's data is fully separate.


## About me

Ardian, based in Indonesia. Communication and Marketing enthusiast
