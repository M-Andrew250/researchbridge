import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { sendServerError } from '../lib/errors.js';
import { strictLimiter } from '../middleware/rateLimiters.js';

export const authRouter = Router();

// GET /api/auth/check-phone?phone=<phone> — called by signup.html
// before creating the account. Email duplicates are already rejected
// by Supabase Auth's own signUp() call (email is the unique identity
// column on auth.users), but phone is just profile metadata with no
// such built-in check, hence this route. Rate-limited — otherwise
// it's an easy way to enumerate which phone numbers have accounts.
authRouter.get('/check-phone', strictLimiter, async (req, res) => {
  const { phone } = req.query;
  if (!phone) {
    return res.status(400).json({ error: 'Missing phone query parameter.' });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (error) {
    return sendServerError(res, error, 'auth.check-phone');
  }

  res.json({ exists: !!data });
});
