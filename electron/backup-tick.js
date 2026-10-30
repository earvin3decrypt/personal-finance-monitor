const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 30_000;

/** @type {ReturnType<typeof setInterval> | null} */
let intervalId = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let initialTimeoutId = null;
/** @type {(() => string) | null} */
let getOrigin = null;

async function tick() {
  if (!getOrigin) return;
  try {
    const res = await fetch(`${getOrigin()}/api/public/backup-tick`);
    if (!res.ok) {
      console.error(`[backup-tick] HTTP ${res.status}`);
      return;
    }
    const data = await res.json();
    if (data?.created) {
      console.log(`[backup-tick] ${data.message}`);
    }
  } catch (err) {
    console.error("[backup-tick] fetch failed:", err);
  }
}

/**
 * @param {{ getOrigin: () => string }} opts
 */
function startBackupTick(opts) {
  getOrigin = opts.getOrigin;

  if (initialTimeoutId) clearTimeout(initialTimeoutId);
  if (intervalId) clearInterval(intervalId);

  initialTimeoutId = setTimeout(() => {
    void tick();
  }, INITIAL_DELAY_MS);

  intervalId = setInterval(() => {
    void tick();
  }, CHECK_INTERVAL_MS);
}

function stopBackupTick() {
  if (initialTimeoutId) {
    clearTimeout(initialTimeoutId);
    initialTimeoutId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  getOrigin = null;
}

module.exports = {
  startBackupTick,
  stopBackupTick,
};
