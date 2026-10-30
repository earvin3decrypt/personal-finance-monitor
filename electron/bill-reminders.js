const { app, Notification } = require("electron");
const fs = require("fs");
const path = require("path");
const { planReminderUpdate } = require("./bill-reminders-logic");

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_DELAY_MS = 5_000;

/** @type {ReturnType<typeof setInterval> | null} */
let intervalId = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let initialTimeoutId = null;
/** @type {(() => string) | null} */
let getOrigin = null;
/** @type {(() => import("electron").BrowserWindow | null) | null} */
let getWindow = null;
/** @type {import("electron").BrowserWindow | null} */
let boundWindow = null;

function storePath() {
  return path.join(app.getPath("userData"), "bill-reminders.json");
}

function readSentKeys() {
  try {
    const raw = fs.readFileSync(storePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.keys)) {
      return new Set(parsed.keys.filter((k) => typeof k === "string"));
    }
  } catch {
    // Missing or corrupt file — start fresh.
  }
  return new Set();
}

function writeSentKeys(keys) {
  try {
    fs.writeFileSync(
      storePath(),
      JSON.stringify({ keys: [...keys] }, null, 2),
      "utf8",
    );
  } catch (err) {
    console.error("[bill-reminders] failed to persist keys:", err);
  }
}

function openBills() {
  const win = getWindow?.() ?? null;
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  const origin = getOrigin?.();
  if (origin) {
    win.loadURL(`${origin}/bills`);
  }
}

function showNotification(title, body) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title,
    body,
    silent: false,
  });
  notification.on("click", () => {
    openBills();
  });
  notification.show();
}

async function checkBills() {
  if (!getOrigin) return;
  let data;
  try {
    const res = await fetch(`${getOrigin()}/api/public/bill-alerts`);
    if (!res.ok) {
      console.error(`[bill-reminders] HTTP ${res.status}`);
      return;
    }
    data = await res.json();
  } catch (err) {
    console.error("[bill-reminders] fetch failed:", err);
    return;
  }

  if (!data?.ok || !Array.isArray(data.items)) {
    console.error("[bill-reminders] unexpected response");
    return;
  }

  const plan = planReminderUpdate({
    items: data.items,
    sentKeys: readSentKeys(),
    notificationsEnabled: data.notificationsEnabled !== false,
  });

  try {
    app.setBadgeCount(plan.badgeCount);
  } catch (err) {
    console.error("[bill-reminders] setBadgeCount failed:", err);
  }

  for (const note of plan.notifications) {
    showNotification(note.title, note.body);
  }

  writeSentKeys(plan.nextSentKeys);
}

function onWindowFocus() {
  void checkBills();
}

function bindFocus(win) {
  if (!win || win === boundWindow) return;
  if (boundWindow && !boundWindow.isDestroyed()) {
    boundWindow.removeListener("focus", onWindowFocus);
  }
  boundWindow = win;
  win.on("focus", onWindowFocus);
  win.on("closed", () => {
    if (boundWindow === win) boundWindow = null;
  });
}

/**
 * @param {{ getOrigin: () => string; getWindow: () => import("electron").BrowserWindow | null }} opts
 */
function startBillReminders(opts) {
  getOrigin = opts.getOrigin;
  getWindow = opts.getWindow;

  if (initialTimeoutId) clearTimeout(initialTimeoutId);
  if (intervalId) clearInterval(intervalId);

  initialTimeoutId = setTimeout(() => {
    void checkBills();
  }, INITIAL_DELAY_MS);

  intervalId = setInterval(() => {
    void checkBills();
  }, CHECK_INTERVAL_MS);

  bindFocus(getWindow?.() ?? null);
}

function stopBillReminders() {
  if (initialTimeoutId) {
    clearTimeout(initialTimeoutId);
    initialTimeoutId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (boundWindow && !boundWindow.isDestroyed()) {
    boundWindow.removeListener("focus", onWindowFocus);
  }
  boundWindow = null;
}

module.exports = {
  startBillReminders,
  stopBillReminders,
  checkBills,
};
