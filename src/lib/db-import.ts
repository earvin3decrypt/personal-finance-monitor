import Database from "better-sqlite3";
import fs from "fs";
import {
  ensureDataDir,
  resolveDatabasePath,
  resolveProjectDatabasePath,
} from "@/lib/db-path";

export type ImportResult =
  | { ok: true; imported: number; message: string }
  | { ok: false; message: string };

export function importFromProjectDatabase(): ImportResult {
  const activePath = resolveDatabasePath();
  const projectPath = resolveProjectDatabasePath();

  if (activePath === projectPath) {
    return { ok: false, message: "Active database is already the project file." };
  }

  if (!fs.existsSync(projectPath)) {
    return { ok: false, message: "No project database found at data/sqlite.db." };
  }

  const projectDb = new Database(projectPath, { readonly: true });
  try {
    const projectCount = (
      projectDb.prepare("SELECT COUNT(*) as c FROM accounts").get() as { c: number }
    ).c;
    if (projectCount === 0) {
      return { ok: false, message: "Project database has no accounts to import." };
    }

    ensureDataDir(activePath);
    const activeDb = new Database(activePath);
    try {
      const activeCount = (
        activeDb.prepare("SELECT COUNT(*) as c FROM accounts").get() as { c: number }
      ).c;
      if (activeCount > 0) {
        return {
          ok: false,
          message: `Active database already has ${activeCount} account(s). Import only runs when it is empty.`,
        };
      }

      const rows = projectDb
        .prepare(
          "SELECT name, type, currency, balance, updated_at FROM accounts ORDER BY id",
        )
        .all() as {
        name: string;
        type: string;
        currency: string;
        balance: number;
        updated_at: string;
      }[];

      const insert = activeDb.prepare(
        "INSERT INTO accounts (name, type, currency, balance, updated_at) VALUES (?, ?, ?, ?, ?)",
      );
      const insertMany = activeDb.transaction((accounts: typeof rows) => {
        for (const row of accounts) {
          insert.run(
            row.name,
            row.type,
            row.currency,
            row.balance,
            row.updated_at,
          );
        }
      });
      insertMany(rows);

      return {
        ok: true,
        imported: rows.length,
        message: `Imported ${rows.length} account(s) from the project database.`,
      };
    } finally {
      activeDb.close();
    }
  } finally {
    projectDb.close();
  }
}
