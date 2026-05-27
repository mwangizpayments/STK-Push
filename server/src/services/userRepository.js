import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { httpError } from '../utils/httpError.js';

const memoryCashiers = [];

export async function createCashier({ branchId, email, password }) {
  if (supabase) {
    try {
      if (!env.supabase.serviceRoleKey) {
        throw httpError(500, 'SUPABASE_SERVICE_ROLE_KEY is required to create cashier accounts');
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'cashier',
          branch_id: branchId
        }
      });

      if (authError) {
        throw httpError(400, authError.message);
      }

      const user = {
        id: authData.user.id,
        email,
        role: 'cashier',
        branch_id: branchId,
        created_at: authData.user.created_at || new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('users')
        .upsert(user, { onConflict: 'id' })
        .select('id, email, role, branch_id, created_at')
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      if (!env.allowMemoryFallback) {
        throw error;
      }

      console.warn(`Supabase cashier create failed; using memory fallback: ${error.message}`);
    }
  }

  const cashier = {
    id: crypto.randomUUID(),
    email,
    role: 'cashier',
    branch_id: branchId,
    created_at: new Date().toISOString()
  };

  memoryCashiers.unshift(cashier);
  return cashier;
}

export async function listCashiers() {
  if (supabase) {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, branch_id, created_at')
      .eq('role', 'cashier')
      .order('created_at', { ascending: false });

    if (error) {
      if (!env.allowMemoryFallback) {
        throw error;
      }

      console.warn(`Supabase cashier query failed; using memory fallback: ${error.message}`);
    } else {
      return data || [];
    }
  }

  return memoryCashiers;
}
