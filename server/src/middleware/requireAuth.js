import { supabase } from '../config/supabaseClient.js';

// Verifies the Supabase Auth JWT sent as `Authorization: Bearer <token>`
// by asking Supabase's own Auth server to validate it — this avoids
// hand-rolling JWT signature verification and works regardless of
// which signing algorithm the project uses. On success, attaches the
// authenticated user to req.user for downstream route handlers.
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.' });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }

  req.user = data.user;
  next();
}
