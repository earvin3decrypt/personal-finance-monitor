import type { Metadata } from "next";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getCategoryTree } from "@/lib/categories";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import {
  Card,
  PageHeader,
  Button,
  Input,
  Select,
  Label,
} from "@/components/ui";
import { CategoryList } from "@/components/category-list";
import { IconPicker } from "@/components/icon-picker";
import { BlurAmountsToggle } from "@/components/blur-amounts-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import path from "path";
import {
  updateBaseCurrency,
  addCategory,
  forceSnapshot,
  refreshMarketData,
  importProjectDatabase,
  restoreDatabaseFromLegacy,
} from "@/app/actions/settings";
import { getDatabasePath } from "@/db";
import { resolveProjectDatabasePath } from "@/lib/db-path";
import { listAllDatabaseStats } from "@/lib/db-preserve";

export const metadata: Metadata = {
  title: "Settings | Personal Finance Monitor",
  description: "Base currency, categories, and data refresh",
};

export default function SettingsPage() {
  const settingsRow = db.select().from(settings).limit(1).all()[0];
  const baseCurrency = settingsRow?.baseCurrency ?? "EUR";
  const categoryTree = getCategoryTree();
  const activePath = getDatabasePath();
  const projectPath = resolveProjectDatabasePath();
  const sameDb = path.resolve(activePath) === path.resolve(projectPath);
  const databaseLocations = listAllDatabaseStats(activePath);
  const activeStats = databaseLocations.find(
    (d) => path.resolve(d.path) === path.resolve(activePath),
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
          <div className="p-6 border-b border-border/50">
            <h2 className="mb-4 font-medium">Categories & subcategories</h2>
            <form action={addCategory} className="flex flex-wrap gap-4">
              <div className="min-w-[140px] flex-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required placeholder="Category name" />
              </div>
              <div>
                <Label htmlFor="parentId">Parent (optional)</Label>
                <Select id="parentId" name="parentId" defaultValue="">
                  <option value="">Top-level category</option>
                  {categoryTree.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <Input id="color" name="color" type="color" defaultValue="#3b82f6" />
              </div>
              <div className="min-w-[160px]">
                <Label htmlFor="icon">Icon</Label>
                <IconPicker name="icon" defaultValue="tag" />
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="secondary">
                  Add
                </Button>
              </div>
            </form>
          </div>
          <div className="p-6 bg-background/30">
            <CategoryList categoryTree={categoryTree} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-medium">Database</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Your data is stored outside the app bundle and is kept when you
            update. On launch, the app automatically uses the richest copy if an
            older location has more data.
          </p>
          <p className="mb-2 text-sm text-muted-foreground">
            Active database
            {activeStats
              ? ` — ${activeStats.accounts} account(s), ${activeStats.holdings} holding(s)`
              : ""}
            :
          </p>
          <code className="mb-4 block break-all rounded-lg bg-muted px-3 py-2 text-xs">
            {activePath}
          </code>

          <p className="mb-3 text-sm font-medium">Other locations on this Mac</p>
          <ul className="mb-4 space-y-3">
            {databaseLocations
              .filter((d) => path.resolve(d.path) !== path.resolve(activePath))
              .map((d) => (
                <li
                  key={d.path}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <code className="block break-all text-xs">{d.path}</code>
                  <p className="mt-2 text-muted-foreground">
                    {d.exists
                      ? `${d.accounts} account(s), ${d.holdings} holding(s), ${d.expenses} expense(s)`
                      : "File not found"}
                  </p>
                  {d.exists && d.score >= 0 && (
                    <form action={restoreDatabaseFromLegacy} className="mt-2">
                      <input type="hidden" name="sourcePath" value={d.path} />
                      <Button type="submit" variant="secondary" className="text-xs">
                        Use this database
                      </Button>
                    </form>
                  )}
                </li>
              ))}
          </ul>

          {!sameDb && (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                Dev project file:{" "}
                <code className="text-xs">{projectPath}</code>. Import accounts
                only when the active database has none.
              </p>
              <form action={importProjectDatabase}>
                <Button type="submit" variant="secondary">
                  Import accounts from project database
                </Button>
              </form>
            </>
          )}
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
