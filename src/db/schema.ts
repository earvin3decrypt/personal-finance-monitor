import { sqliteTable, text, real, integer, unique } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  baseCurrency: text("base_currency").notNull().default("EUR"),
  theme: text("theme", { enum: ["light", "dark", "system"] })
    .notNull()
    .default("system"),
  blurAmounts: integer("blur_amounts").notNull().default(0),
});

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["checking", "savings", "cash"] }).notNull(),
  currency: text("currency").notNull(),
  balance: real("balance").notNull().default(0),
  note: text("note"),
  interestRate: real("interest_rate"),
  lastInterestDate: text("last_interest_date"),
  interestPeriod: text("interest_period", { enum: ["month", "day"] })
    .notNull()
    .default("month"),
  updatedAt: text("updated_at").notNull(),
});

export const accountTransfers = sqliteTable("account_transfers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromAccountId: integer("from_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  toAccountId: integer("to_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  sentAmount: real("sent_amount").notNull(),
  sentCurrency: text("sent_currency").notNull(),
  receivedAmount: real("received_amount").notNull(),
  receivedCurrency: text("received_currency").notNull(),
  date: text("date").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  icon: text("icon").notNull().default("tag"),
  parentId: integer("parent_id"),
});

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
  subcategoryId: integer("subcategory_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  type: text("type", { enum: ["expense", "income"] })
    .notNull()
    .default("expense"),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  description: text("description"),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull(),
});

export const budgets = sqliteTable("budgets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  subcategoryId: integer("subcategory_id").references(() => categories.id, {
    onDelete: "cascade",
  }),
  limitAmount: real("limit_amount").notNull(),
  currency: text("currency").notNull(),
  period: text("period", { enum: ["month"] }).notNull().default("month"),
  startDate: text("start_date").notNull(),
});

export const budgetRollovers = sqliteTable(
  "budget_rollovers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    budgetId: integer("budget_id")
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    sourceMonth: text("source_month").notNull(),
    targetMonth: text("target_month").notNull(),
    amount: real("amount").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    budgetSourceUnique: unique().on(t.budgetId, t.sourceMonth),
  }),
);

export const savingsGoals = sqliteTable("savings_goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("target"),
  targetAmount: real("target_amount").notNull(),
  currentAmount: real("current_amount").notNull().default(0),
  currency: text("currency").notNull(),
  deadline: text("deadline"),
  createdAt: text("created_at").notNull(),
});

export const savingsContributions = sqliteTable("savings_contributions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  goalId: integer("goal_id")
    .notNull()
    .references(() => savingsGoals.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull(),
});

export const holdings = sqliteTable("holdings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  assetType: text("asset_type", { enum: ["stock", "etf"] }).notNull(),
  quantity: real("quantity").notNull(),
  costBasis: real("cost_basis").notNull(),
  currency: text("currency").notNull(),
  accountId: integer("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
});

export const holdingTrades = sqliteTable("holding_trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  holdingId: integer("holding_id")
    .notNull()
    .references(() => holdings.id, { onDelete: "cascade" }),
  side: text("side", { enum: ["buy", "sell"] }).notNull(),
  quantity: real("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  totalAmount: real("total_amount").notNull(),
  currency: text("currency").notNull(),
  date: text("date").notNull(),
  accountId: integer("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at").notNull(),
});

export const dividends = sqliteTable("dividends", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  holdingId: integer("holding_id").references(() => holdings.id, {
    onDelete: "set null",
  }),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  date: text("date").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull(),
});

export const priceSnapshots = sqliteTable("price_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  price: real("price").notNull(),
  currency: text("currency").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});

export const portfolioSnapshots = sqliteTable("portfolio_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  totalValueBase: real("total_value_base").notNull(),
  cashValueBase: real("cash_value_base").notNull(),
  investmentsValueBase: real("investments_value_base").notNull(),
  cryptoValueBase: real("crypto_value_base").notNull().default(0),
});

export const cryptoHoldings = sqliteTable("crypto_holdings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  quantity: real("quantity").notNull(),
  costBasis: real("cost_basis"),
  currency: text("currency").notNull().default("USD"),
  updatedAt: text("updated_at").notNull(),
});

export const fxRates = sqliteTable("fx_rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  base: text("base").notNull(),
  quote: text("quote").notNull(),
  rate: real("rate").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});

export const recurringItems = sqliteTable("recurring_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  type: text("type", { enum: ["expense", "income"] })
    .notNull()
    .default("expense"),
  createdAt: text("created_at").notNull(),
  isBill: integer("is_bill").notNull().default(0),
  billingCycle: text("billing_cycle", { enum: ["month", "year"] })
    .notNull()
    .default("month"),
  nextDueDate: text("next_due_date"),
  endDate: text("end_date"),
  reminderDays: integer("reminder_days").notNull().default(3),
  accountId: integer("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  subcategoryId: integer("subcategory_id").references(() => categories.id, {
    onDelete: "set null",
  }),
});

export type Account = typeof accounts.$inferSelect;
export type AccountTransfer = typeof accountTransfers.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type BudgetRollover = typeof budgetRollovers.$inferSelect;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type HoldingTrade = typeof holdingTrades.$inferSelect;
export type CryptoHolding = typeof cryptoHoldings.$inferSelect;
export type Dividend = typeof dividends.$inferSelect;
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type RecurringItem = typeof recurringItems.$inferSelect;
