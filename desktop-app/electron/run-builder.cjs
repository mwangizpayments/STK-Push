const path = require('node:path');
const { spawnSync } = require('node:child_process');

const builderPackagePath = require.resolve('electron-builder/package.json');
const builderCliPath = path.join(path.dirname(builderPackagePath), 'cli.js');
const env = {
  ...process.env,
  ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES: 'true',
  NODE_ENV: 'production'
};
const result = spawnSync(process.execPath, [builderCliPath, ...process.argv.slice(2)], {
  env,
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
