const fs = require("fs");
const path = require("path");

/**
 * electron-builder strips node_modules from extraResources.
 * Copy the full prebuilt standalone bundle after packaging.
 */
module.exports = async function afterPack(context) {
  const src = path.join(context.packager.projectDir, "dist-standalone");
  if (!fs.existsSync(src)) {
    throw new Error(
      "dist-standalone not found. Run npm run electron:build (standalone step) first.",
    );
  }

  const dest = path.join(
    context.appOutDir,
    "Contents",
    "Resources",
    "standalone",
  );

  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
};
