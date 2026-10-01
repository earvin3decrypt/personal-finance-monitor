# Personal Finance Monitor

Single-user web app to track expenses, bank accounts, stock/ETF holdings, and net worth across multiple currencies. Runs entirely locally with SQLite — works offline for all core features; live prices and FX rates fall back to cached values when offline.

> **Local-only by design.** There is no login and no cloud sync. Run it on your own machine and don't expose it to the internet. See [SECURITY.md](SECURITY.md).

## Stack

- Next.js 15 (App Router)
- SQLite + Drizzle ORM
- Tailwind CSS v4
- Recharts, lucide-react
- Yahoo Finance chart API (prices), Frankfurter (FX)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The database file is created automatically at `data/sqlite.db` on first run when you use `npm run dev`.

**Important:** The Mac app and `npm run dev` use **different** database files:

| How you run | Database location |
|-------------|-------------------|
| `npm run dev` | `<project>/data/sqlite.db` |
| Mac `.app` | `~/Library/Application Support/personal-finance-monitor/data/sqlite.db` |

Data lives in Application Support, not inside the app, so updating the `.dmg` does not delete it. On each launch the app picks the richest database if an older folder (e.g. `PersonalFinanceMonitor`) has more data. **Settings → Database** lists all locations and lets you restore from a backup copy.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — net worth, trend chart, breakdown, recent expenses |
| `/accounts` | Bank accounts CRUD |
| `/expenses` | Log income/expenses with category picker, daily chart, category breakdown |
| `/goals` | Category budgets with spending limits and savings goals with progress rings |
| `/portfolio` | Holdings with live/cached prices and P/L |
| `/settings` | Base currency, categories, manual refresh |

## Daily snapshots

Record today's portfolio value:

```bash
curl http://localhost:3000/api/public/snapshot
```

The dashboard also auto-records a snapshot on load if none exists for today.

## Building the Mac app (.dmg)

```bash
npm run electron:build
```

This will:
1. Rebuild `better-sqlite3` for your system Node
2. Build Next.js in standalone mode
3. Package everything into an Electron `.dmg`

Output goes to `dist-electron/`. Open the DMG, drag the app to Applications, and launch — no terminal needed.

If you had a previous broken build, force-quit all **Personal Finance Monitor** processes in Activity Monitor before installing the new DMG.

**Install:** open `dist-electron/Personal Finance Monitor-0.1.0-arm64.dmg`, drag to Applications, then right-click → **Open** the first time (unsigned app).

The database is stored in `~/Library/Application Support/personal-finance-monitor/data/sqlite.db`.

## Offline behavior

- Accounts, expenses, holdings, and settings work without internet.
- FX and stock prices use the last cached values when APIs are unreachable.
- An amber banner indicates when stale cached data is in use.

## Configuration

Optional environment variables are listed in [`.env.example`](.env.example). Copy it to `.env.local` to override the database path or the local Ollama model used for monthly insights.

## Privacy

- Your database is never part of the repository — `data/` is git-ignored.
- The eye toggle next to the theme switcher blurs every amount, handy when sharing your screen.

## Contributing

Issues and pull requests are welcome. Please use made-up numbers in screenshots and bug reports, never your real data.

## License

[MIT](LICENSE). Bank and crypto logos in `public/logos/` are trademarks of their respective owners and are included only to identify accounts in the UI.