const path = require('node:path');
const { spawnSync } = require('node:child_process');

const vitePackagePath = require.resolve('vite/package.json');
const viteCliPath = path.join(path.dirname(vitePackagePath), 'bin', 'vite.js');
const result = spawnSync(process.execPath, [viteCliPath, ...process.argv.slice(2)], {
  env: process.env,
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
