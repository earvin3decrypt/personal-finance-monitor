import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { resolveDatabasePath } from "@/lib/db-path";
import { ensureDatabasePreserved } from "@/lib/db-preserve";
import * as schema from "./schema";

type Db = BetterSQLite3Database<typeof schema>;

let sqlite: Database.Database | null = null;
let dbInstance: Db | null = null;

function columnExists(
  database: Database.Database,
  table: string,
  column: string,
): boolean {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return cols.some((c) => c.name === column);
}

function dividendsHoldingRequiresMigration(database: Database.Database): boolean {
  const tables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='dividends'",
    )
    .all() as { name: string }[];
  if (tables.length === 0) return false;

  const cols = database.prepare("PRAGMA table_info(dividends)").all() as {
    name: string;
    notnull: number;
  }[];
  const holdingCol = cols.find((c) => c.name === "holding_id");
  return holdingCol != null && holdingCol.notnull === 1;
}

function migrateDividendsNullableHolding(database: Database.Database) {
  if (!dividendsHoldingRequiresMigration(database)) return;

  database.exec(`
    CREATE TABLE dividends_migrated (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      holding_id INTEGER REFERENCES holdings(id) ON DELETE SET NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );
    INSERT INTO dividends_migrated
      SELECT id, holding_id, amount, currency, date, description, created_at
      FROM dividends;
    DROP TABLE dividends;
    ALTER TABLE dividends_migrated RENAME TO dividends;
  `);
}

function seedPsp5Trades(database: Database.Database) {
  const holding = database
    .prepare("SELECT id FROM holdings WHERE UPPER(symbol) = 'PSP5.PA' LIMIT 1")
    .get() as { id: number } | undefined;
  if (!holding) return;

  const tradeCount = database
    .prepare("SELECT COUNT(*) as c FROM holding_trades WHERE holding_id = ?")
    .get(holding.id) as { c: number };
  if (tradeCount.c > 0) return;

  const account = database
    .prepare("SELECT id FROM accounts WHERE id = 4")
    .get() as { id: number } | undefined;
  const accountId = account?.id ?? null;
  const now = new Date().toISOString();

  const insert = database.prepare(`
    INSERT INTO holding_trades (
      holding_id, side, quantity, unit_price, total_amount, currency, date, account_id, created_at
    ) VALUES (?, 'buy', ?, ?, ?, 'EUR', ?, ?, ?)
  `);

  insert.run(holding.id, 3, 32.8, 98.4, "2021-10-28", accountId, now);
  insert.run(holding.id, 4, 32.6425, 130.57, "2022-10-18", accountId, now);

  database
    .prepare(
      "UPDATE holdings SET quantity = 7, cost_basis = 32.71 WHERE id = ?",
    )
    .run(holding.id);
}

/** One-time fix: EWLD.PA avg cost was wrongly set to ~€39.63; broker shows €24.20. */
function correctEwldCostBasis(database: Database.Database) {
  database
    .prepare(
      `UPDATE holdings
       SET cost_basis = 24.20
       WHERE UPPER(symbol) = 'EWLD.PA'
         AND ABS(cost_basis - 24.20) > 0.01`,
    )
    .run();
}

function seedCategories(database: Database.Database) {
  const insertParent = database.prepare(
    "INSERT INTO categories (name, color, icon, parent_id) VALUES (?, ?, ?, NULL)",
  );
  const insertChild = database.prepare(
    "INSERT INTO categories (name, color, icon, parent_id) VALUES (?, ?, ?, ?)",
  );

  const carId = insertParent.run("Car", "#ef4444", "car").lastInsertRowid;
  insertChild.run("Fuel", "#ef4444", "fuel", carId);
  insertChild.run("Car Wash", "#ef4444", "car", carId);
  insertChild.run("Service", "#ef4444", "wrench", carId);

  const aptId = insertParent.run("Apartment", "#3b82f6", "home").lastInsertRowid;
  insertChild.run("Rent", "#3b82f6", "home", aptId);
  insertChild.run("Utilities", "#3b82f6", "zap", aptId);

  insertParent.run("Health", "#22c55e", "heart-pulse");
  insertParent.run("Entertainment", "#8b5cf6", "ferris-wheel");
  insertParent.run("Dining", "#f97316", "utensils");
  insertParent.run("Other", "#64748b", "tag");
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_currency TEXT NOT NULL DEFAULT 'EUR',
      theme TEXT NOT NULL DEFAULT 'system'
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      currency TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      note TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      icon TEXT NOT NULL DEFAULT 'tag',
      parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      subcategory_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      limit_amount REAL NOT NULL,
      currency TEXT NOT NULL,
      period TEXT NOT NULL DEFAULT 'month',
      start_date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'target',
      target_amount REAL NOT NULL,
      current_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL,
      deadline TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS savings_contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      cost_basis REAL NOT NULL,
      currency TEXT NOT NULL,
      account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS dividends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      holding_id INTEGER REFERENCES holdings(id) ON DELETE SET NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS price_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      total_value_base REAL NOT NULL,
      cash_value_base REAL NOT NULL,
      investments_value_base REAL NOT NULL,
      crypto_value_base REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS crypto_holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      cost_basis REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fx_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base TEXT NOT NULL,
      quote TEXT NOT NULL,
      rate REAL NOT NULL,
      fetched_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recurring_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'expense',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS budget_rollovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
      source_month TEXT NOT NULL,
      target_month TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (budget_id, source_month)
    );
    CREATE TABLE IF NOT EXISTS account_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      to_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      sent_amount REAL NOT NULL,
      sent_currency TEXT NOT NULL,
      received_amount REAL NOT NULL,
      received_currency TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );
  `);

  if (!columnExists(database, "accounts", "note")) {
    database.exec(
      "ALTER TABLE accounts ADD COLUMN note TEXT",
    );
  }

  if (!columnExists(database, "accounts", "interest_rate")) {
    database.exec("ALTER TABLE accounts ADD COLUMN interest_rate REAL");
  }

  if (!columnExists(database, "accounts", "last_interest_date")) {
    database.exec("ALTER TABLE accounts ADD COLUMN last_interest_date TEXT");
  }

  if (!columnExists(database, "accounts", "interest_period")) {
    database.exec(
      "ALTER TABLE accounts ADD COLUMN interest_period TEXT NOT NULL DEFAULT 'month'",
    );
  }

  if (!columnExists(database, "categories", "parent_id")) {
    database.exec(
      "ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE",
    );
  }
  if (!columnExists(database, "expenses", "subcategory_id")) {
    database.exec(
      "ALTER TABLE expenses ADD COLUMN subcategory_id INTEGER REFERENCES categories(id) ON DELETE SET NULL",
    );
  }
  if (!columnExists(database, "expenses", "type")) {
    database.exec(
      "ALTER TABLE expenses ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'",
    );
  }
  if (!columnExists(database, "expenses", "created_at")) {
    database.exec(
      "ALTER TABLE expenses ADD COLUMN created_at TEXT NOT NULL DEFAULT ''",
    );
    database.exec(
      "UPDATE expenses SET created_at = date || 'T12:00:00.000Z' WHERE created_at = ''",
    );
  }

  if (!columnExists(database, "savings_goals", "deadline")) {
    database.exec("ALTER TABLE savings_goals ADD COLUMN deadline TEXT");
  }

  if (!columnExists(database, "portfolio_snapshots", "crypto_value_base")) {
    database.exec(
      "ALTER TABLE portfolio_snapshots ADD COLUMN crypto_value_base REAL NOT NULL DEFAULT 0",
    );
  }

  if (!columnExists(database, "budgets", "subcategory_id")) {
    database.exec(
      "ALTER TABLE budgets ADD COLUMN subcategory_id INTEGER REFERENCES categories(id) ON DELETE CASCADE",
    );
  }

  if (!columnExists(database, "recurring_items", "is_bill")) {
    database.exec(
      "ALTER TABLE recurring_items ADD COLUMN is_bill INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!columnExists(database, "recurring_items", "billing_cycle")) {
    database.exec(
      "ALTER TABLE recurring_items ADD COLUMN billing_cycle TEXT NOT NULL DEFAULT 'month'",
    );
  }
  if (!columnExists(database, "recurring_items", "next_due_date")) {
    database.exec("ALTER TABLE recurring_items ADD COLUMN next_due_date TEXT");
  }
  if (!columnExists(database, "recurring_items", "end_date")) {
    database.exec("ALTER TABLE recurring_items ADD COLUMN end_date TEXT");
  }
  if (!columnExists(database, "recurring_items", "reminder_days")) {
    database.exec(
      "ALTER TABLE recurring_items ADD COLUMN reminder_days INTEGER NOT NULL DEFAULT 3",
    );
  }
  if (!columnExists(database, "recurring_items", "account_id")) {
    database.exec(
      "ALTER TABLE recurring_items ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL",
    );
  }
  if (!columnExists(database, "recurring_items", "category_id")) {
    database.exec(
      "ALTER TABLE recurring_items ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL",
    );
  }
  if (!columnExists(database, "recurring_items", "subcategory_id")) {
    database.exec(
      "ALTER TABLE recurring_items ADD COLUMN subcategory_id INTEGER REFERENCES categories(id) ON DELETE SET NULL",
    );
  }

  if (!columnExists(database, "settings", "theme")) {
    database.exec(
      "ALTER TABLE settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'system'",
    );
  }
  if (!columnExists(database, "settings", "blur_amounts")) {
    database.exec(
      "ALTER TABLE settings ADD COLUMN blur_amounts INTEGER NOT NULL DEFAULT 0",
    );
  }

  migrateDividendsNullableHolding(database);

  database.exec(`
    CREATE TABLE IF NOT EXISTS holding_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      holding_id INTEGER NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
      side TEXT NOT NULL CHECK(side IN ('buy', 'sell')),
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      currency TEXT NOT NULL,
      date TEXT NOT NULL,
      account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );
  `);

  seedPsp5Trades(database);
  correctEwldCostBasis(database);

  const settingsCount = database
    .prepare("SELECT COUNT(*) as c FROM settings")
    .get() as { c: number };
  if (settingsCount.c === 0) {
    database.prepare("INSERT INTO settings (base_currency) VALUES (?)").run("EUR");
  }

  const categoriesCount = database
    .prepare("SELECT COUNT(*) as c FROM categories")
    .get() as { c: number };
  if (categoriesCount.c === 0) {
    seedCategories(database);
  }

  database.exec(`
    UPDATE categories
    SET color = (
      SELECT p.color FROM categories p WHERE p.id = categories.parent_id
    )
    WHERE parent_id IS NOT NULL;
  `);
}

function initDatabase(): Db {
  if (dbInstance) return dbInstance;

  const dbPath = resolveDatabasePath();
  const preserve = ensureDatabasePreserved(dbPath);
  if (preserve.restored) {
    console.info(`[db] ${preserve.message} (from ${preserve.fromPath})`);
  }

  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  migrate(sqlite);
  dbInstance = drizzle(sqlite, { schema });

  return dbInstance;
}

export function getDatabasePath(): string {
  return resolveDatabasePath();
}

/** Close the connection so a replaced database file is picked up on next use. */
export function resetDatabaseConnection(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    dbInstance = null;
  }
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = initDatabase();
    const value = instance[prop as keyof Db];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(instance);
    }
    return value;
  },
});
