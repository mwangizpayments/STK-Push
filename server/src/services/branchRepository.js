import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

const memoryBranches = [];

export async function createBranch({ active = true, name, shortcode, tillNumber }) {
  const branch = {
    id: crypto.randomUUID(),
    name,
    till_number: tillNumber || null,
    shortcode: shortcode || null,
    active,
    created_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data, error } = await supabase.from('branches').insert(branch).select('*').single();
      if (error) throw error;
      return data;
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase branch insert failed; using memory fallback: ${error.message}`);
    }
  }

  memoryBranches.unshift(branch);
  return branch;
}

export async function listBranches() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      if (!env.allowMemoryFallback) throw error;
      console.warn(`Supabase branch query failed; using memory fallback: ${error.message}`);
    }
  }

  return memoryBranches;
}
