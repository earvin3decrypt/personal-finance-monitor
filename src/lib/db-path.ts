import fs from "fs";
import path from "path";
import os from "os";

/** Folder name under Application Support (must match Electron `app.getPath("userData")`). */
export const APP_DATA_DIR_NAME = "personal-finance-monitor";

export function getAppSupportRoot(): string {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support");
  }
  if (process.platform === "win32") {
    return process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
  }
  return path.join(os.homedir(), ".config");
}

/** Canonical Mac / packaged database path (same folder Electron uses for userData). */
export function resolvePackagedDatabasePath(): string {
  return path.join(
    getAppSupportRoot(),
    APP_DATA_DIR_NAME,
    "data",
    "sqlite.db",
  );
}

/** Resolved absolute path to the SQLite database file. */
export function resolveDatabasePath(): string {
  if (process.env.FINANCE_DB_PATH) {
    return process.env.FINANCE_DB_PATH;
  }

  if (process.env.ELECTRON_PACKAGED === "true") {
    return resolvePackagedDatabasePath();
  }

  return path.join(process.cwd(), "data", "sqlite.db");
}

export function resolveProjectDatabasePath(): string {
  return path.join(process.cwd(), "data", "sqlite.db");
}

/** Older app versions used different Application Support folder names. */
export function listLegacyDatabasePaths(): string[] {
  const root = getAppSupportRoot();
  const candidates = [
    resolvePackagedDatabasePath(),
    path.join(root, "PersonalFinanceMonitor", "data", "sqlite.db"),
    path.join(root, "Personal Finance Monitor", "data", "sqlite.db"),
    resolveProjectDatabasePath(),
  ];

  const seen = new Set<string>();
  const paths: string[] = [];
  for (const p of candidates) {
    const resolved = path.resolve(p);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      paths.push(resolved);
    }
  }
  return paths;
}

export function ensureDataDir(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
