import dotenv from 'dotenv';

dotenv.config();

function csv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  corsOrigins: csv(process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173'),
  allowMemoryFallback:
    (process.env.ALLOW_MEMORY_FALLBACK || (process.env.NODE_ENV === 'production' ? 'false' : 'true')) ===
    'true',
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  },
  daraja: {
    useMock: (process.env.DARAJA_USE_MOCK || 'true') !== 'false',
    consumerKey: process.env.DARAJA_CONSUMER_KEY || '',
    consumerSecret: process.env.DARAJA_CONSUMER_SECRET || '',
    passkey: process.env.DARAJA_PASSKEY || '',
    shortcode: process.env.DARAJA_SHORTCODE || '174379',
    transactionType: process.env.DARAJA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
    oauthUrl:
      process.env.DARAJA_OAUTH_URL ||
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPushUrl:
      process.env.DARAJA_STK_PUSH_URL ||
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    callbackUrl: process.env.CALLBACK_URL || ''
  }
};

export const hasSupabaseConfig = Boolean(
  env.supabase.url && (env.supabase.serviceRoleKey || env.supabase.anonKey)
);

export const hasSupabaseAuthConfig = Boolean(env.supabase.url && env.supabase.anonKey);

