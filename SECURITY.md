# Security

## Threat model

Personal Finance Monitor is a **single-user, local-only** app. It has no login, no user accounts, and no cloud sync. All data lives in a SQLite file on your own machine.

Because there is no authentication, **do not expose the app to a network you don't trust** (for example by deploying `npm start` on a public server or forwarding its port). Anyone who can reach it can read and change your data.

The only network calls the app makes are:

- Yahoo Finance chart API — stock/ETF prices (ticker symbols only)
- Frankfurter — currency exchange rates
- Ollama on `127.0.0.1` — optional monthly insight, runs locally

No balances, transactions, or account names are sent anywhere.

## Your data

- Dev database: `data/sqlite.db` (git-ignored)
- Mac app database: `~/Library/Application Support/personal-finance-monitor/data/sqlite.db`

Never commit these files, and don't paste real balances or screenshots of real data into issues or pull requests.

## Reporting a vulnerability

Please open a [private security advisory](https://github.com/earvin3decrypt/personal-finance-monitor/security/advisories/new) instead of a public issue. Include steps to reproduce and the affected version or commit.
