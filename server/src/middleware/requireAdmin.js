import { supabase } from '../config/supabaseClient.js';

// Chains after requireAuth (needs req.user already set). Checks the
// profiles table's is_admin flag rather than a hardcoded email list,
// so granting/revoking admin access is a Table Editor edit, not a
// code change + redeploy.
export async function requireAdmin(req, res, next) {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', req.user.id)
    .single();

  if (error || !data?.is_admin) {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  next();
}
