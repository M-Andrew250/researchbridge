import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { sendServerError } from '../lib/errors.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

const STATUSES = ['pending', 'confirmed', 'cancelled'];

// GET /api/admin/enrolments — every enrolment (guest or logged-in),
// with its workshop attached, for the admin enrolment-management
// page. Optional ?status=/&mode= filters; unfiltered = everything,
// newest first.
adminRouter.get('/enrolments', async (req, res) => {
  const { status, mode } = req.query;

  let query = supabase
    .from('enrolments')
    .select('*, workshop:workshops(*)')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (mode) query = query.eq('mode', mode);

  const { data, error } = await query;

  if (error) {
    return sendServerError(res, error, 'admin.enrolments.list');
  }

  res.json(data);
});

// PATCH /api/admin/enrolments/:id/status — confirm/cancel/reset a
// single enrolment. body: { status: 'pending' | 'confirmed' | 'cancelled' }
adminRouter.patch('/enrolments/:id/status', async (req, res) => {
  const { status } = req.body;

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${STATUSES.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('enrolments')
    .update({
      status,
      cancelled_at: status === 'cancelled' ? new Date().toISOString() : null,
      cancellation_reason: status === 'cancelled' ? req.body.reason || null : null,
    })
    .eq('id', req.params.id)
    .select('*, workshop:workshops(*)')
    .single();

  if (error) {
    return res.status(404).json({ error: 'Enrolment not found.' });
  }

  res.json(data);
});
