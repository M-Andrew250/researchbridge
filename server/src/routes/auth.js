import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';

export const authRouter = Router();

// GET /api/auth/check-phone?phone=<phone> — called by signup.html
// before creating the account. Email duplicates are already rejected
// by Supabase Auth's own signUp() call (email is the unique identity
// column on auth.users), but phone is just profile metadata with no
// such built-in check, hence this route.
authRouter.get('/check-phone', async (req, res) => {
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
    return res.status(500).json({ error: error.message });
  }

  res.json({ exists: !!data });
});
