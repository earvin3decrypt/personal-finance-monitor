const GROUP_THRESHOLD = 3;

function alertKey(item) {
  return `${item.id}:${item.nextDueDate}:${item.stage}`;
}

function formatAmount(amount, currency, locale) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function bodyForItem(item, locale) {
  const money = formatAmount(item.amount, item.currency, locale);
  if (item.stage === "overdue") {
    const n = Math.abs(item.daysUntilDue);
    return n === 1
      ? `${money} overdue by 1 day`
      : `${money} overdue by ${n} days`;
  }
  if (item.stage === "due-today") {
    return `${money} due today`;
  }
  const n = item.daysUntilDue;
  return n === 1 ? `${money} due in 1 day` : `${money} due in ${n} days`;
}

/**
 * Decide which notifications to show and which keys to keep after a poll.
 *
 * When notifications are disabled, badge is cleared, nothing is shown, and
 * fresh keys are not marked sent so turning reminders back on still alerts.
 *
 * @param {{
 *   items: Array<{id:number,name:string,amount:number,currency:string,nextDueDate:string,daysUntilDue:number,stage:string}>,
 *   sentKeys: Iterable<string>,
 *   notificationsEnabled: boolean,
 *   locale?: string,
 * }} input
 */
function planReminderUpdate(input) {
  const items = Array.isArray(input.items) ? input.items : [];
  const notificationsEnabled = input.notificationsEnabled !== false;
  const locale = input.locale;
  const sent = new Set(
    [...(input.sentKeys ?? [])].filter((k) => typeof k === "string"),
  );

  const currentKeys = new Set(items.map(alertKey));
  for (const key of [...sent]) {
    if (!currentKeys.has(key)) sent.delete(key);
  }

  if (!notificationsEnabled) {
    return {
      badgeCount: 0,
      notifications: [],
      nextSentKeys: [...sent],
    };
  }

  const fresh = items.filter((item) => !sent.has(alertKey(item)));
  /** @type {Array<{title: string, body: string}>} */
  const notifications = [];

  if (fresh.length > GROUP_THRESHOLD) {
    notifications.push({
      title: "Bills need attention",
      body: `${fresh.length} bills need attention`,
    });
    for (const item of fresh) sent.add(alertKey(item));
  } else {
    for (const item of fresh) {
      notifications.push({
        title: item.name,
        body: bodyForItem(item, locale),
      });
      sent.add(alertKey(item));
    }
  }

  return {
    badgeCount: items.length,
    notifications,
    nextSentKeys: [...sent],
  };
}

module.exports = {
  GROUP_THRESHOLD,
  alertKey,
  formatAmount,
  bodyForItem,
  planReminderUpdate,
};
