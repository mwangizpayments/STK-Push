import axios from 'axios';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { httpError } from '../utils/httpError.js';

export async function requestStkPush({ amount, phone, transactionId }) {
  if (env.daraja.useMock) {
    return createMockStkResponse();
  }

  ensureDarajaConfig();

  const accessToken = await getDarajaAccessToken();
  const timestamp = createDarajaTimestamp();
  const password = Buffer.from(`${env.daraja.shortcode}${env.daraja.passkey}${timestamp}`).toString(
    'base64'
  );

  const payload = {
    BusinessShortCode: env.daraja.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: env.daraja.transactionType,
    Amount: amount,
    PartyA: phone,
    PartyB: env.daraja.shortcode,
    PhoneNumber: phone,
    CallBackURL: env.daraja.callbackUrl,
    AccountReference: transactionId,
    TransactionDesc: 'Desktop payment'
  };

  const { data } = await axios.post(env.daraja.stkPushUrl, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return data;
}

async function getDarajaAccessToken() {
  const { data } = await axios.get(env.daraja.oauthUrl, {
    auth: {
      username: env.daraja.consumerKey,
      password: env.daraja.consumerSecret
    }
  });

  return data.access_token;
}

function ensureDarajaConfig() {
  const missing = [];

  if (!env.daraja.consumerKey) missing.push('DARAJA_CONSUMER_KEY');
  if (!env.daraja.consumerSecret) missing.push('DARAJA_CONSUMER_SECRET');
  if (!env.daraja.passkey) missing.push('DARAJA_PASSKEY');
  if (!env.daraja.callbackUrl) missing.push('CALLBACK_URL');

  if (missing.length) {
    throw httpError(500, 'Daraja configuration is incomplete', { missing });
  }
}

function createDarajaTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function createMockStkResponse() {
  const suffix = crypto.randomBytes(5).toString('hex').toUpperCase();

  return {
    MerchantRequestID: `MR_${suffix}`,
    CheckoutRequestID: `ws_CO_${Date.now()}_${suffix}`,
    ResponseCode: '0',
    ResponseDescription: 'Success. Request accepted for processing',
    CustomerMessage: 'Success. Request accepted for processing'
  };
}

