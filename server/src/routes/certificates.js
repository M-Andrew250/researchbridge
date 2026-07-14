import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { courseNames } from '../lib/courseNames.js';
import { sendServerError } from '../lib/errors.js';

export const certificatesRouter = Router();

// The certificate ID printed on a certificate is just its enrolment's
// own uuid — no separate certificates table needed. Reject obviously
// malformed input before it reaches the database.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/certificates/verify/:id — public (no auth) so anyone
// holding a certificate can confirm it's genuine. Only ever returns
// the fields already printed on the certificate itself — never email,
// phone, or any other enrolment detail.
certificatesRouter.get('/verify/:id', async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) {
    return res.status(400).json({ valid: false, error: 'That doesn’t look like a valid certificate ID.' });
  }

  const { data, error } = await supabase
    .from('enrolments')
    .select('first_name, last_name, course_slug, mode, status, completed_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return sendServerError(res, error, 'certificates.verify');
  }

  const isGenuine = !!data
    && data.mode === 'Online'
    && data.status === 'confirmed'
    && !!data.completed_at;

  if (!isGenuine) {
    return res.json({ valid: false });
  }

  res.json({
    valid: true,
    studentName: `${data.first_name} ${data.last_name}`,
    courseName: courseNames[data.course_slug] || data.course_slug,
    completedAt: data.completed_at,
  });
});