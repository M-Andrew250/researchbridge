import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { sendServerError } from '../lib/errors.js';

export const thesisPricingRouter = Router();

// GET /api/thesis-pricing — the current admin-set rates for the
// quote calculator on pages/thesis-editing.html. Always public, no
// login required — visitors need this before they've submitted
// anything.
thesisPricingRouter.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('thesis_pricing_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    return sendServerError(res, error, 'thesisPricing.get');
  }

  res.json(data);
});