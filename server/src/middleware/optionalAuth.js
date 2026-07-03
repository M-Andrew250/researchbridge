import { supabase } from '../config/supabaseClient.js';

// Like requireAuth, but doesn't reject the request if there's no
// (or an invalid) token — it just leaves req.user unset. Used on
// routes guests are allowed to hit (e.g. submitting an enrolment),
// where we still want to link the record to a profile if the
// visitor happens to be logged in.
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return next();

  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data.user) {
    req.user = data.user;
  }

  next();
}
