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

const MESSAGE_STATUSES = ['new', 'read', 'responded'];

// GET /api/admin/contact-messages — every message submitted via the
// site's contact form. Optional ?status= filter; unfiltered =
// everything, newest first.
adminRouter.get('/contact-messages', async (req, res) => {
  const { status } = req.query;

  let query = supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    return sendServerError(res, error, 'admin.contactMessages.list');
  }

  res.json(data);
});

// PATCH /api/admin/contact-messages/:id/status — mark a message
// new/read/responded. body: { status: 'new' | 'read' | 'responded' }
adminRouter.patch('/contact-messages/:id/status', async (req, res) => {
  const { status } = req.body;

  if (!MESSAGE_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${MESSAGE_STATUSES.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('contact_messages')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  res.json(data);
});

const WORKSHOP_STATUSES = ['upcoming', 'closed'];
const WORKSHOP_REQUIRED_FIELDS = ['course_slug', 'venue', 'start_date', 'trainer_name', 'fee'];

function validateWorkshopBody(body) {
  const missing = WORKSHOP_REQUIRED_FIELDS.filter(field => !String(body[field] ?? '').trim());
  if (missing.length > 0) {
    return `Missing required field(s): ${missing.join(', ')}`;
  }
  if (body.status !== undefined && !WORKSHOP_STATUSES.includes(body.status)) {
    return `Status must be one of: ${WORKSHOP_STATUSES.join(', ')}`;
  }
  return null;
}

// GET /api/admin/workshops — every workshop session, for the admin
// scheduling page. Optional ?course=/&status= filters; unfiltered =
// everything, soonest first.
adminRouter.get('/workshops', async (req, res) => {
  const { course, status } = req.query;

  let query = supabase
    .from('workshops')
    .select('*')
    .order('start_date', { ascending: true });

  if (course) query = query.eq('course_slug', course);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    return sendServerError(res, error, 'admin.workshops.list');
  }

  res.json(data);
});

// POST /api/admin/workshops — create a new workshop session.
// body: { course_slug, venue, start_date, trainer_name, fee, status? }
adminRouter.post('/workshops', async (req, res) => {
  const validationError = validateWorkshopBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { course_slug, venue, start_date, trainer_name, fee, status } = req.body;

  const { data, error } = await supabase
    .from('workshops')
    .insert({ course_slug, venue, start_date, trainer_name, fee, status: status || 'upcoming' })
    .select()
    .single();

  if (error) {
    return sendServerError(res, error, 'admin.workshops.create');
  }

  res.status(201).json(data);
});

// PATCH /api/admin/workshops/:id — edit an existing workshop session.
// Same body shape as POST.
adminRouter.patch('/workshops/:id', async (req, res) => {
  const validationError = validateWorkshopBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { course_slug, venue, start_date, trainer_name, fee, status } = req.body;

  const { data, error } = await supabase
    .from('workshops')
    .update({ course_slug, venue, start_date, trainer_name, fee, status: status || 'upcoming' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(404).json({ error: 'Workshop not found.' });
  }

  res.json(data);
});

// DELETE /api/admin/workshops/:id — remove a workshop session. Any
// enrolments pointing at it keep their record (workshop_id just goes
// null — see the ON DELETE SET NULL on enrolments.workshop_id).
adminRouter.delete('/workshops/:id', async (req, res) => {
  const { error } = await supabase
    .from('workshops')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return sendServerError(res, error, 'admin.workshops.delete');
  }

  res.status(204).end();
});
