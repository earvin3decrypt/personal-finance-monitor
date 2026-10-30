# Security

## Threat model

Personal Finance Monitor is a **single-user, local-only** app. It has no login, no user accounts, and no cloud sync. All data lives in a SQLite file on your own machine.

Because there is no authentication, **do not expose the app to a network you don't trust** (for example by forwarding its port). Anyone who can reach it can read and change your data.

`npm run dev` and `npm start` listen on `127.0.0.1` only. Every request must use a loopback `Host` (`localhost`, `127.0.0.1`, or `::1`). That blocks a browser page on another site from reaching the app through DNS rebinding. Do not put the app behind a reverse proxy.

The only network calls the app makes by default are:

- Yahoo Finance chart API — stock/ETF prices (ticker symbols only)
- Frankfurter — currency exchange rates

If you enable optional AI categorization in Settings, the app may also call your chosen provider (Ollama on loopback, or OpenAI / Anthropic / Gemini). Those requests include the operation description/type and your category names only—not balances or account details. API keys are stored in the local SQLite database.

## Your data

- Dev database: `data/sqlite.db` (git-ignored)
- Mac app database: `~/Library/Application Support/personal-finance-monitor/data/sqlite.db`

Never commit these files, `.env` files, or database backups. Restoring a database from Settings only accepts those known files, not an arbitrary path. Don't paste real balances or screenshots of real data into issues or pull requests.

## Reporting a vulnerability

Please open a [private security advisory](https://github.com/earvin3decrypt/personal-finance-monitor/security/advisories/new) instead of a public issue. Include steps to reproduce and the affected version or commit.
