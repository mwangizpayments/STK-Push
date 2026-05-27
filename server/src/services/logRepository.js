import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

const memoryLogs = [];

export async function createLog({ level = 'info', message, transactionId = null }) {
  const log = {
    id: crypto.randomUUID(),
    transaction_id: transactionId,
    message,
    level,
    created_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { error } = await supabase.from('logs').insert(log);
      if (error) throw error;
      return log;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase log insert failed; using memory fallback: ${error.message}`);
    }
  }

  memoryLogs.unshift(log);
  return log;
}

