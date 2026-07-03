import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const healthRouter = Router();

// Confirms the server is up and can actually reach the Supabase
// database (not just that the process started).
healthRouter.get('/', async (req, res) => {
  const { error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  if (error) {
    return res.status(500).json({ status: 'error', db: 'unreachable', message: error.message });
  }

  res.json({ status: 'ok', db: 'connected' });
});

// Temporary route to verify the auth middleware end-to-end (Step 5).
// Business routes built in Step 6 will use requireAuth the same way.
healthRouter.get('/whoami', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});