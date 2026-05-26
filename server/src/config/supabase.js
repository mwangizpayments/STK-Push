import { createClient } from '@supabase/supabase-js';
import { env, hasSupabaseAuthConfig, hasSupabaseConfig } from './env.js';

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
};

export const supabase = hasSupabaseConfig
  ? createClient(env.supabase.url, env.supabase.serviceRoleKey || env.supabase.anonKey, clientOptions)
  : null;

export const supabaseAuth = hasSupabaseAuthConfig
  ? createClient(env.supabase.url, env.supabase.anonKey, clientOptions)
  : null;

