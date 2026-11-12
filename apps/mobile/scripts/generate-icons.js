// Compatibility entry point: every placement comes from the shared master.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const result = spawnSync(process.execPath, [
  path.resolve(__dirname, "../../../scripts/generate-brand-assets.mjs"),
], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
