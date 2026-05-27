import { supabase, supabaseAuth } from '../config/supabase.js';
import { env } from '../config/env.js';

export async function requireAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!supabaseAuth || !token) {
    if (env.nodeEnv !== 'production') {
      req.user = {
        id: req.header('x-user-id') || 'dev-user',
        email: req.header('x-user-email') || 'dev@example.local',
        role: req.header('x-user-role') || 'admin',
        branch_id: req.header('x-branch-id') || ''
      };
      next();
      return;
    }

    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data?.user) {
    res.status(401).json({ message: 'Invalid or expired session' });
    return;
  }

  const user = data.user;
  let profile = null;

  if (supabase) {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('role, branch_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.warn(`Profile lookup failed: ${profileError.message}`);
      }

      profile = profileData;
    } catch (error) {
      console.warn(`Profile lookup failed: ${error.message}`);
    }
  }

  req.user = {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || '',
    role: profile?.role || user.app_metadata?.role || user.user_metadata?.role || 'cashier',
    branch_id: profile?.branch_id || user.user_metadata?.branch_id || ''
  };

  next();
}

export function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      res.status(403).json({ message: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

function extractBearerToken(header = '') {
  if (!header.startsWith('Bearer ')) {
    return '';
  }

  return header.slice('Bearer '.length).trim();
}
