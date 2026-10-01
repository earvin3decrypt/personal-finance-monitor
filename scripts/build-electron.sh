#!/bin/bash
set -e

APP_NAME="Personal Finance Monitor"
APP_DIR="dist-electron/mac-arm64/${APP_NAME}.app"
STANDALONE_DEST="${APP_DIR}/Contents/Resources/standalone"
SQLITE_SRC="node_modules/better-sqlite3/build/Release/better_sqlite3.node"
SQLITE_DST="${STANDALONE_DEST}/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
ELECTRON_BIN="node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"

echo "==> Rebuilding better-sqlite3 for system Node (next build)..."
npm rebuild better-sqlite3

echo "==> Building Next.js (standalone)..."
npm run build

echo "==> Preparing standalone bundle..."
rm -rf dist-standalone
cp -R .next/standalone dist-standalone
cp -R .next/static dist-standalone/.next/static
if [ -d "public" ]; then
  cp -R public dist-standalone/public
fi
rm -rf dist-standalone/data

echo "==> Packaging Electron shell (.app)..."
npx electron-builder --mac dir

echo "==> Rebuilding better-sqlite3 for Electron (required for packaged server)..."
npx electron-rebuild -f -w better-sqlite3

echo "==> Verifying native module loads under Electron..."
ELECTRON_RUN_AS_NODE=1 "$ELECTRON_BIN" -e "require('better-sqlite3');" || {
  echo "ERROR: better-sqlite3 failed to load under Electron. Aborting."
  exit 1
}

echo "==> Copying standalone into app bundle..."
rm -rf "$STANDALONE_DEST"
mkdir -p "$(dirname "$STANDALONE_DEST")"
cp -R dist-standalone "$STANDALONE_DEST"

echo "==> Installing Electron-built better-sqlite3 into standalone..."
mkdir -p "$(dirname "$SQLITE_DST")"
cp "$SQLITE_SRC" "$SQLITE_DST"

echo "==> Verifying server can start..."
ELECTRON_RUN_AS_NODE=1 PORT=3499 HOSTNAME=127.0.0.1 NODE_ENV=production ELECTRON_PACKAGED=true \
  "$ELECTRON_BIN" "$STANDALONE_DEST/server.js" &
SERVER_PID=$!
sleep 5
if curl -sf -o /dev/null "http://127.0.0.1:3499/"; then
  echo "    Server smoke test: OK"
else
  echo "ERROR: Server smoke test failed."
  kill $SERVER_PID 2>/dev/null || true
  exit 1
fi
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo "==> Building DMG..."
npx electron-builder --mac dmg --prepackaged dist-electron/mac-arm64

echo "==> Restoring better-sqlite3 for system Node (dev)..."
npm rebuild better-sqlite3

echo "==> Done! Install from:"
ls -lh dist-electron/*-arm64.dmg 2>/dev/null || ls -lh dist-electron/*.dmg
