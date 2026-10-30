const { app, BrowserWindow, shell, dialog, session } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const net = require("net");
const fs = require("fs");

let port = 3456;
let serverProcess = null;
let mainWindow = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function getStandalonePath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone");
  }
  return path.join(__dirname, "..", ".next", "standalone");
}

function showError(title, message) {
  dialog.showErrorBox(title, message);
}

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, "127.0.0.1", () => {
      const { port: freePort } = server.address();
      server.close(() => resolve(freePort));
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        findFreePort(startPort + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

function waitForPort(targetPort, host, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function tryConnect() {
      const socket = new net.Socket();
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for port ${targetPort}`));
        } else {
          setTimeout(tryConnect, 200);
        }
      });
      socket.connect(targetPort, host);
    }

    tryConnect();
  });
}

function startNextServer() {
  const standalonePath = getStandalonePath();
  const serverScript = path.join(standalonePath, "server.js");

  if (!fs.existsSync(serverScript)) {
    throw new Error(
      `Server not found at ${serverScript}. Reinstall the application.`,
    );
  }

  const userDataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(userDataDir, { recursive: true });
  const financeDbPath = path.join(userDataDir, "sqlite.db");

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    ELECTRON_PACKAGED: "true",
    FINANCE_DB_PATH: financeDbPath,
  };

  serverProcess = spawn(process.execPath, [serverScript], {
    cwd: standalonePath,
    env,
    stdio: "pipe",
  });

  let serverLog = "";

  serverProcess.stdout?.on("data", (data) => {
    serverLog += data.toString();
    console.log(`[next] ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on("data", (data) => {
    serverLog += data.toString();
    console.error(`[next] ${data.toString().trim()}`);
  });

  serverProcess.on("error", (err) => {
    showError("Server Error", `Failed to start: ${err.message}`);
  });

  serverProcess.on("exit", (code) => {
    if (code !== 0 && code !== null && mainWindow === null) {
      showError(
        "Server Crashed",
        `The app server exited (code ${code}).\n\n${serverLog.slice(-1000)}`,
      );
      app.quit();
    }
  });
}

function appOrigin() {
  return `http://127.0.0.1:${port}`;
}

function isAppUrl(url) {
  return url === appOrigin() || url.startsWith(`${appOrigin()}/`);
}

function isPublicWebUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    host === "0.0.0.0"
  ) {
    return false;
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 127 || a === 10 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
  }

  return true;
}

function openExternalIfPublic(url) {
  if (isPublicWebUrl(url)) shell.openExternal(url);
}

function preventForeignNavigation(event, url) {
  if (isAppUrl(url)) return;
  event.preventDefault();
  openExternalIfPublic(url);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Personal Finance Monitor",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription) => {
      if (errorCode !== -3) {
        showError(
          "Load Failed",
          `Could not load the app UI (${errorDescription}).`,
        );
      }
    },
  );

  mainWindow.webContents.on("will-navigate", preventForeignNavigation);
  mainWindow.webContents.on("will-redirect", preventForeignNavigation);
  mainWindow.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalIfPublic(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

if (gotLock) {
  app.on("ready", async () => {
    try {
      session.defaultSession.setPermissionRequestHandler(
        (_webContents, _permission, callback) => {
          callback(false);
        },
      );
      port = await findFreePort(3456);
      startNextServer();
      await waitForPort(port, "127.0.0.1", 60000);
      createWindow();
    } catch (err) {
      showError(
        "Startup Failed",
        `Could not start Personal Finance Monitor.\n\n${err.message}`,
      );
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill("SIGTERM");
    }
  });

  app.on("activate", () => {
    if (mainWindow === null && serverProcess) {
      createWindow();
    }
  });
}
