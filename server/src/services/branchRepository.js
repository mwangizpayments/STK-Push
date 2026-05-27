import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

const memoryBranches = [];
const BRANCH_SELECT = 'id, name, till_number, shortcode, active, created_at, updated_at';

export async function createBranch({ active = true, darajaPasskey, name, shortcode, tillNumber }) {
  const branch = {
    id: crypto.randomUUID(),
    name,
    till_number: tillNumber || null,
    shortcode: shortcode || null,
    active,
    created_at: new Date().toISOString()
  };

  if (darajaPasskey) {
    branch.daraja_passkey = darajaPasskey;
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('branches')
        .insert(branch)
        .select(BRANCH_SELECT)
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase branch insert failed; using memory fallback: ${error.message}`);
    }
  }

  memoryBranches.unshift(branch);
  return sanitizeBranch(branch);
}

export async function listBranches() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select(BRANCH_SELECT)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return mergeBranches([...(data || []), ...memoryBranches.map(sanitizeBranch)]);
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase branch query failed; using memory fallback: ${error.message}`);
    }
  }

  return memoryBranches.map(sanitizeBranch);
}

export async function updateBranch(id, payload) {
  const patch = {
    active: payload.active,
    name: payload.name,
    shortcode: payload.shortcode || null,
    till_number: payload.tillNumber || null,
    updated_at: new Date().toISOString()
  };

  if (payload.darajaPasskey) {
    patch.daraja_passkey = payload.darajaPasskey;
  }

  for (const key of Object.keys(patch)) {
    if (patch[key] === undefined) {
      delete patch[key];
    }
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('branches')
        .update(patch)
        .eq('id', id)
        .select(BRANCH_SELECT)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase branch update failed; using memory fallback: ${error.message}`);
    }
  }

  const branch = memoryBranches.find((item) => item.id === id);
  if (!branch) {
    return null;
  }

  Object.assign(branch, patch);
  return sanitizeBranch(branch);
}

export async function deleteBranch(id) {
  return updateBranch(id, { active: false });
}

function sanitizeBranch(branch) {
  const { daraja_passkey: _darajaPasskey, ...safeBranch } = branch;
  return safeBranch;
}

function mergeBranches(branches) {
  const byId = new Map();

  for (const branch of branches) {
    byId.set(branch.id, branch);
  }

  return [...byId.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}
