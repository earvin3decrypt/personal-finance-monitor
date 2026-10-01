import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import {
  ensureDataDir,
  listLegacyDatabasePaths,
} from "@/lib/db-path";

export type DatabaseStats = {
  path: string;
  exists: boolean;
  accounts: number;
  holdings: number;
  expenses: number;
  dividends: number;
  score: number;
};

export type PreserveResult = {
  restored: boolean;
  message: string;
  fromPath?: string;
  backupPath?: string;
};

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    )
    .get(table) as { name: string } | undefined;
  return row != null;
}

function countTable(db: Database.Database, table: string): number {
  if (!tableExists(db, table)) return 0;
  return (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number })
    .c;
}

export function getDatabaseStats(dbPath: string): DatabaseStats {
  if (!fs.existsSync(dbPath)) {
    return {
      path: dbPath,
      exists: false,
      accounts: 0,
      holdings: 0,
      expenses: 0,
      dividends: 0,
      score: -1,
    };
  }

  const db = new Database(dbPath, { readonly: true });
  try {
    const accounts = countTable(db, "accounts");
    const holdings = countTable(db, "holdings");
    const expenses = countTable(db, "expenses");
    const dividends = countTable(db, "dividends");
    const score =
      accounts * 100 + holdings * 50 + expenses * 10 + dividends * 5;

    return {
      path: dbPath,
      exists: true,
      accounts,
      holdings,
      expenses,
      dividends,
      score,
    };
  } finally {
    db.close();
  }
}

export function listAllDatabaseStats(canonicalPath: string): DatabaseStats[] {
  const paths = listLegacyDatabasePaths();
  if (!paths.includes(path.resolve(canonicalPath))) {
    paths.unshift(path.resolve(canonicalPath));
  }
  return paths.map(getDatabaseStats).sort((a, b) => b.score - a.score);
}

/**
 * On startup, if the canonical database is empty or poorer than a legacy copy,
 * restore from the richest legacy file (with a timestamped backup of the canonical file).
 */
function shouldAutoRestore(): boolean {
  return (
    process.env.FINANCE_DB_PATH != null ||
    process.env.ELECTRON_PACKAGED === "true"
  );
}

export function ensureDatabasePreserved(canonicalPath: string): PreserveResult {
  if (!shouldAutoRestore()) {
    return {
      restored: false,
      message: "Auto-restore runs in the Mac app only.",
    };
  }

  ensureDataDir(canonicalPath);

  const allStats = listAllDatabaseStats(canonicalPath);
  const canonicalStats = getDatabaseStats(canonicalPath);
  const best = allStats[0];

  if (!best || best.score < 0) {
    return {
      restored: false,
      message: "No existing database found; a new one will be created.",
    };
  }

  const canonicalResolved = path.resolve(canonicalPath);
  const bestResolved = path.resolve(best.path);

  if (bestResolved === canonicalResolved) {
    return {
      restored: false,
      message: `Using database at ${canonicalPath} (${canonicalStats.accounts} accounts).`,
    };
  }

  if (best.score <= canonicalStats.score) {
    return {
      restored: false,
      message: `Using database at ${canonicalPath} (${canonicalStats.accounts} accounts).`,
    };
  }

  let backupPath: string | undefined;
  if (fs.existsSync(canonicalPath) && canonicalStats.score >= 0) {
    backupPath = `${canonicalPath}.backup-${Date.now()}`;
    fs.copyFileSync(canonicalPath, backupPath);
  }

  fs.copyFileSync(best.path, canonicalPath);

  return {
    restored: true,
    fromPath: best.path,
    backupPath,
    message: `Restored your data from a previous app location (${best.accounts} accounts, ${best.holdings} holdings).`,
  };
}

export function restoreDatabaseFromPath(
  canonicalPath: string,
  sourcePath: string,
): PreserveResult {
  if (!fs.existsSync(sourcePath)) {
    return { restored: false, message: "Source database file not found." };
  }

  const sourceStats = getDatabaseStats(sourcePath);
  if (sourceStats.score < 0) {
    return { restored: false, message: "Source file is not a valid database." };
  }

  ensureDataDir(canonicalPath);

  let backupPath: string | undefined;
  if (fs.existsSync(canonicalPath)) {
    backupPath = `${canonicalPath}.backup-${Date.now()}`;
    fs.copyFileSync(canonicalPath, backupPath);
  }

  fs.copyFileSync(sourcePath, canonicalPath);

  return {
    restored: true,
    fromPath: sourcePath,
    backupPath,
    message: `Restored ${sourceStats.accounts} account(s) from backup location.`,
  };
}
