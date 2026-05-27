import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.port, () => {
  console.log(`M-Pesa STK API listening on port ${env.port}`);
  console.log(
    `Runtime: node_env=${env.nodeEnv}, daraja_mock=${env.daraja.useMock}, mock_auto_complete=${env.daraja.mockAutoComplete}, callback_url_set=${Boolean(env.daraja.callbackUrl)}`
  );
  if (env.daraja.callbackUrl) {
    console.log(`Callback URL configured: ${env.daraja.callbackUrl}`);
  }
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
