const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const envFiles = ['.env', '.env.local', '.env.production', '.env.production.local'];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return values;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex === -1) {
        return values;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      values[key] = value;
      return values;
    }, {});
}

const fileEnv = envFiles.reduce(
  (values, fileName) => ({
    ...values,
    ...parseEnvFile(path.join(appRoot, fileName))
  }),
  {}
);
const getEnv = (name) => String(process.env[name] || fileEnv[name] || '').trim();

const requiredVariables = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const missingVariables = requiredVariables.filter((name) => !getEnv(name));

if (missingVariables.length > 0) {
  console.error(
    `Missing required desktop release environment variables: ${missingVariables.join(', ')}`
  );
  console.error(
    'Set them in desktop-app/.env for local builds, or in GitHub repository Variables/Secrets for release builds.'
  );
  process.exit(1);
}

if (!getEnv('VITE_API_BASE_URL')) {
  console.warn('Warning: VITE_API_BASE_URL is not set; the desktop app will default to http://localhost:5000.');
}

console.log('Desktop release environment verified.');
