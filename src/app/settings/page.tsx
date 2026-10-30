import type { Metadata } from "next";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getCategoryTree } from "@/lib/categories";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import {
  Card,
  PageHeader,
  Button,
  Select,
  Label,
} from "@/components/ui";
import { CategoryManager } from "@/components/category-manager";
import { CategorizationRules } from "@/components/categorization-rules";
import { AiCategorizationSettings } from "@/components/ai-categorization-settings";
import { BillNotificationsToggle } from "@/components/bill-notifications-toggle";
import { BlurAmountsToggle } from "@/components/blur-amounts-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  getAiCategorizationPublicSettings,
  getBillNotificationsEnabled,
} from "@/lib/settings";
import path from "path";
import {
  updateBaseCurrency,
  forceSnapshot,
  refreshMarketData,
  importProjectDatabase,
  restoreDatabaseFromLegacy,
  forceDatabaseBackup,
} from "@/app/actions/settings";
import { getDatabasePath } from "@/db";
import { getBackupsDir, listBackups } from "@/lib/backups";
import { listCategorizationRules } from "@/lib/categorization";
import { resolveProjectDatabasePath } from "@/lib/db-path";
import { listAllDatabaseStats } from "@/lib/db-preserve";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = {
  title: "Settings | Personal Finance Monitor",
  description: "Base currency, categories, and data refresh",
};

export default function SettingsPage() {
  const settingsRow = db.select().from(settings).limit(1).all()[0];
  const baseCurrency = settingsRow?.baseCurrency ?? "EUR";
  const billNotificationsEnabled = getBillNotificationsEnabled();
  const categoryTree = getCategoryTree();
  const categorizationRules = listCategorizationRules();
  const aiSettings = getAiCategorizationPublicSettings();
  const activePath = getDatabasePath();
  const projectPath = resolveProjectDatabasePath();
  const sameDb = path.resolve(activePath) === path.resolve(projectPath);
  const databaseLocations = listAllDatabaseStats(activePath);
  const activeStats = databaseLocations.find(
    (d) => path.resolve(d.path) === path.resolve(activePath),
  );
  const backupsDir = getBackupsDir();
  const backups = listBackups();
  const today = todayISO();
  const newestBackup = backups[0];
  const lastBackupLabel = !newestBackup
    ? "No backup yet"
    : newestBackup.date === today
      ? "Last backup: today"
      : `Last backup: ${newestBackup.date}`;
  const otherCopies = databaseLocations.filter(
    (d) =>
      d.exists &&
      d.score >= 0 &&
      path.resolve(d.path) !== path.resolve(activePath),
  );

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure your finance monitor"
      />

      <div className="grid gap-8">
        <Card>
          <h2 className="mb-4 font-medium">Appearance</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Light, dark, or match your system setting.
          </p>
          <ThemeToggle />
          <div className="mt-6 border-t border-border pt-6">
            <p className="mb-1 text-sm font-medium">Blur amounts</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Hide balances and money figures when sharing your screen.
            </p>
            <BlurAmountsToggle />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-medium">Bill reminders</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            In the Mac app, show a dock badge and native notifications when a
            bill is due soon or overdue. Turn this off to silence reminders;
            due dates on the Bills page are unchanged.
          </p>
          <BillNotificationsToggle initialEnabled={billNotificationsEnabled} />
        </Card>

        <Card>
          <h2 className="mb-4 font-medium">Base currency</h2>
          <form action={updateBaseCurrency} className="flex flex-wrap gap-4">
            <div className="min-w-[140px] flex-1">
              <Label htmlFor="baseCurrency">Currency</Label>
              <Select
                id="baseCurrency"
                name="baseCurrency"
                defaultValue={baseCurrency}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="border-b border-border/50 p-6">
            <h2 className="font-medium">Categories & subcategories</h2>
          </div>
          <CategoryManager categoryTree={categoryTree} />
        </Card>

        <Card>
          <h2 className="mb-4 font-medium">Smart categorization</h2>
          <CategorizationRules
            categories={categoryTree}
            rules={categorizationRules}
          />
          <details className="group mt-6 border-t border-border pt-6">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              AI suggestions…
            </summary>
            <div className="mt-4">
              <AiCategorizationSettings initial={aiSettings} />
            </div>
          </details>
        </Card>

        <Card>
          <h2 className="mb-2 font-medium">Your data</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Saved on this Mac. Updating the app does not erase it. A backup is
            made automatically each day (kept 30 days).
          </p>
          <p className="mb-1 text-sm">
            {activeStats
              ? `${activeStats.accounts} accounts · ${activeStats.holdings} holdings`
              : "No data yet"}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">{lastBackupLabel}</p>

          <div className="mb-6 flex flex-wrap gap-3">
            <form action={forceDatabaseBackup}>
              <Button type="submit" variant="secondary">
                Backup now
              </Button>
            </form>
            <a
              href="/api/export"
              className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm [border-width:0.5px] transition-all duration-150 hover:bg-muted active:scale-[0.98]"
            >
              Export CSV
            </a>
          </div>

          {backups.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium">Restore from backup</p>
              <ul className="divide-y divide-border border-y border-border">
                {backups.map((b) => (
                  <li
                    key={b.path}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span>{b.date}</span>
                    <form action={restoreDatabaseFromLegacy}>
                      <input type="hidden" name="sourcePath" value={b.path} />
                      <Button
                        type="submit"
                        variant="secondary"
                        className="h-8 px-2.5 text-xs"
                      >
                        Restore
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              Show file locations…
            </summary>
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  Active database
                </p>
                <code className="block break-all rounded-lg bg-muted px-3 py-2 text-xs">
                  {activePath}
                </code>
              </div>
              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  Backups folder
                </p>
                <code className="block break-all rounded-lg bg-muted px-3 py-2 text-xs">
                  {backupsDir}
                </code>
              </div>

              {otherCopies.length > 0 && (
                <div>
                  <p className="mb-3 text-sm font-medium">
                    Other recoverable copies
                  </p>
                  <ul className="space-y-3">
                    {otherCopies.map((d) => (
                      <li
                        key={d.path}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">
                            Older copy — {d.accounts} accounts
                          </p>
                          <code className="mt-1 block break-all text-xs text-muted-foreground">
                            {d.path}
                          </code>
                        </div>
                        <form action={restoreDatabaseFromLegacy}>
                          <input
                            type="hidden"
                            name="sourcePath"
                            value={d.path}
                          />
                          <Button
                            type="submit"
                            variant="secondary"
                            className="text-xs"
                          >
                            Use this copy
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!sameDb && (
                <div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Import accounts from the project database (only if this one
                    is empty).
                  </p>
                  <form action={importProjectDatabase}>
                    <Button type="submit" variant="secondary">
                      Import accounts from project database
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </details>
        </Card>

        <Card>
          <h2 className="mb-4 font-medium">Data refresh</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Refresh FX rates and stock prices from the internet. When offline,
            the app uses the last cached values.
          </p>
          <div className="flex flex-wrap gap-3">
            <form action={refreshMarketData}>
              <Button type="submit" variant="secondary">
                Refresh prices & FX
              </Button>
            </form>
            <form action={forceSnapshot}>
              <Button type="submit" variant="secondary">
                Record snapshot now
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </>
  );
}
