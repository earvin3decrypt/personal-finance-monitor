import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { resolveDatabasePath } from "@/lib/db-path";
import { todayISO } from "@/lib/format";

const BACKUP_RE = /^sqlite-(\d{4}-\d{2}-\d{2})\.db$/;
const DEFAULT_KEEP_DAYS = 30;

export type BackupInfo = {
  path: string;
  date: string;
  size: number;
};

export type BackupRunResult = {
  created: boolean;
  path?: string;
  pruned: number;
  message: string;
};

export function getBackupsDir(): string {
  return path.join(path.dirname(resolveDatabasePath()), "backups");
}

export function backupFilenameForDate(date: string): string {
  return `sqlite-${date}.db`;
}

export function backupPathForDate(date: string): string {
  return path.join(getBackupsDir(), backupFilenameForDate(date));
}

function ensureBackupsDir(): string {
  const dir = getBackupsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** True for a real non-symlink file under the backups dir named sqlite-YYYY-MM-DD.db. */
export function isAllowedBackupSource(sourcePath: string): boolean {
  if (!sourcePath || sourcePath.includes("\0")) return false;

  let resolved: string;
  let backupsDir: string;
  try {
    resolved = path.resolve(sourcePath);
    backupsDir = path.resolve(getBackupsDir());
  } catch {
    return false;
  }

  if (!resolved.startsWith(backupsDir + path.sep)) return false;
  if (!BACKUP_RE.test(path.basename(resolved))) return false;

  try {
    const stat = fs.lstatSync(resolved);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export function listBackups(): BackupInfo[] {
  const dir = getBackupsDir();
  if (!fs.existsSync(dir)) return [];

  const items: BackupInfo[] = [];
  for (const name of fs.readdirSync(dir)) {
    const match = BACKUP_RE.exec(name);
    if (!match) continue;
    const full = path.join(dir, name);
    try {
      const stat = fs.lstatSync(full);
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
      items.push({ path: full, date: match[1], size: stat.size });
    } catch {
      // skip unreadable entries
    }
  }

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Delete dated backup files older than keepDays (by filename date, not mtime).
 */
export function pruneBackups(keepDays = DEFAULT_KEEP_DAYS): number {
  const cutoff = new Date(`${todayISO()}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - keepDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  let pruned = 0;
  for (const item of listBackups()) {
    if (item.date >= cutoffIso) continue;
    try {
      fs.unlinkSync(item.path);
      pruned += 1;
    } catch (err) {
      console.error("[backups] prune failed:", item.path, err);
    }
  }
  return pruned;
}

function isSqliteFile(filePath: string): boolean {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, buf, 0, 16, 0);
    return bytesRead === 16 && buf.toString("utf8") === "SQLite format 3\u0000";
  } catch {
    return false;
  } finally {
    if (fd != null) fs.closeSync(fd);
  }
}

/**
 * Consistent snapshot via VACUUM INTO (handles WAL safely).
 * Destination must not already exist.
 */
function createBackupFile(destPath: string): void {
  const dbPath = resolveDatabasePath();
  if (!fs.existsSync(dbPath)) {
    throw new Error("Active database file not found");
  }

  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(destPath)) {
    fs.unlinkSync(destPath);
  }

  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    db.prepare(`VACUUM INTO ?`).run(destPath);
  } finally {
    db.close();
  }

  if (!isSqliteFile(destPath)) {
    try {
      fs.unlinkSync(destPath);
    } catch {
      // ignore
    }
    throw new Error("Backup file is not a valid SQLite database");
  }
}

/**
 * Ensure today's dated backup exists (unless force recreates it), then prune.
 */
export function runDailyBackupIfNeeded(options?: {
  force?: boolean;
}): BackupRunResult {
  const force = options?.force === true;
  const date = todayISO();
  const dest = backupPathForDate(date);

  ensureBackupsDir();

  let created = false;
  if (force || !fs.existsSync(dest)) {
    try {
      createBackupFile(dest);
      created = true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create backup";
      console.error("[backups]", message);
      const pruned = pruneBackups();
      return { created: false, pruned, message };
    }
  }

  const pruned = pruneBackups();
  return {
    created,
    path: dest,
    pruned,
    message: created
      ? `Backup saved for ${date}`
      : `Backup for ${date} already exists`,
  };
}
