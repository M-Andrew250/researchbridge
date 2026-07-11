import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getEnrolmentProgress } from '../lib/enrolmentProgress.js';
import { sendWelcomeEmail, sendMotivationalEmail } from '../lib/email.js';
import { courseNames } from '../lib/courseNames.js';
import { sendServerError } from '../lib/errors.js';

export const notificationsRouter = Router();

// POST /api/notifications/welcome — called from main.js right after
// a SIGNED_IN auth event (password login, or landing back here via
// an email confirmation link). Idempotent: only actually sends once
// per account, tracked by profiles.welcome_email_sent_at.
notificationsRouter.post('/welcome', requireAuth, async (req, res) => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, welcome_email_sent_at')
    .eq('id', req.user.id)
    .single();

  if (error) {
    return sendServerError(res, error, 'notifications.welcome');
  }

  if (profile.welcome_email_sent_at) {
    return res.json({ sent: false, reason: 'already sent' });
  }

  await sendWelcomeEmail({ to: req.user.email, fullName: profile.full_name });

  await supabase
    .from('profiles')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', req.user.id);

  res.json({ sent: true });
});

// POST /api/notifications/check-progress — called from main.js right
// before signOut() fires. For every Online + Confirmed enrolment that
// isn't yet at 100%, sends a motivational reminder email.
notificationsRouter.post('/check-progress', requireAuth, async (req, res) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', req.user.id)
    .single();
  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  const { data: enrolments, error } = await supabase
    .from('enrolments')
    .select('id, course_slug')
    .eq('user_id', req.user.id)
    .eq('mode', 'Online')
    .eq('status', 'confirmed');

  if (error) {
    return sendServerError(res, error, 'notifications.check-progress');
  }

  const notified = [];
  for (const e of enrolments) {
    const { percent } = await getEnrolmentProgress(e.course_slug, req.user.id, e.id);
    if (percent < 100) {
      await sendMotivationalEmail({
        to: req.user.email,
        firstName,
        courseName: courseNames[e.course_slug] || e.course_slug,
        progressPercent: percent,
        enrolmentId: e.id,
      });
      notified.push({ courseSlug: e.course_slug, percent });
    }
  }

  res.json({ notified });
});
