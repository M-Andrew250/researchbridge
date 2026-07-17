import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { getEnrolmentProgress } from '../lib/enrolmentProgress.js';
import { courseNames } from '../lib/courseNames.js';
import { sendEnrolmentConfirmationEmail, sendEnrolmentCancelledEmail } from '../lib/email.js';
import { sendServerError } from '../lib/errors.js';
import { strictLimiter } from '../middleware/rateLimiters.js';

export const enrolmentsRouter = Router();

// Must match the CHECK constraints in the migrations exactly.
const CATEGORIES = ['Individual', 'Group (5–10 people)', 'Group (10+ people)'];
const MODES = ['Online', 'In-Person'];
const LEVELS = ['Complete Beginner', 'Some Basic Knowledge', 'Intermediate'];

// Selects an enrolment row together with its linked workshop (null
// for online enrolments), used by both /me and /:id below.
const ENROLMENT_SELECT = '*, workshop:workshops(*)';

// POST /api/enrolments — guests and logged-in users can both submit
// (pages/enrol.html). If a valid session is present, the enrolment
// is linked to that profile via user_id. In-person enrolments must
// reference a real, upcoming workshop for that course.
enrolmentsRouter.post('/', strictLimiter, optionalAuth, async (req, res) => {
  const {
    courseSlug, firstName, lastName, email, phone, country,
    organisation, category, mode, level, comments, workshopId,
    marketingOptIn, consentAccepted,
  } = req.body;

  const required = { courseSlug, firstName, lastName, email, phone, country, category, mode, level };
  const missing = Object.entries(required).filter(([, v]) => !v || !String(v).trim());
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing required field(s): ${missing.map(([k]) => k).join(', ')}`,
    });
  }

  if (!consentAccepted) {
    return res.status(400).json({ error: 'Please agree to the ResearchBridge Terms & Privacy policy to continue.' });
  }

  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Invalid category.' });
  }
  if (!MODES.includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode.' });
  }
  if (!LEVELS.includes(level)) {
    return res.status(400).json({ error: 'Invalid level.' });
  }

  // A logged-in user can only have one active (incomplete) online
  // enrolment at a time — they must finish (100%) before starting
  // another. Guests aren't checked: without an account there's no
  // progress to track, so the rule can't meaningfully apply.
  if (mode === 'Online' && req.user) {
    const { data: existingOnline, error: existingError } = await supabase
      .from('enrolments')
      .select('id, course_slug')
      .eq('user_id', req.user.id)
      .eq('mode', 'Online')
      .neq('status', 'cancelled');

    if (existingError) {
      return sendServerError(res, existingError, 'enrolments.create.checkOnline');
    }

    for (const e of existingOnline) {
      const { percent } = await getEnrolmentProgress(e.course_slug, req.user.id, e.id);
      if (percent < 100) {
        return res.status(400).json({
          error: `Please complete your current online course (${e.course_slug}, ${percent}% done) before enrolling in another.`,
        });
      }
    }
  }

  let validatedWorkshopId = null;
  let validatedWorkshop = null;
  if (mode === 'In-Person') {
    // Don't let someone apply twice for the same in-person course.
    // A cancelled prior application doesn't block re-applying.
    if (req.user) {
      const { data: existingApplication, error: existingAppError } = await supabase
        .from('enrolments')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('course_slug', courseSlug)
        .eq('mode', 'In-Person')
        .neq('status', 'cancelled')
        .maybeSingle();

      if (existingAppError) {
        return sendServerError(res, existingAppError, 'enrolments.create.checkInPerson');
      }
      if (existingApplication) {
        return res.status(409).json({
          error: 'You have already applied for this course.',
          existingEnrolmentId: existingApplication.id,
        });
      }
    }

    if (!workshopId) {
      return res.status(400).json({ error: 'Please choose a workshop date.' });
    }
    const { data: workshop, error: workshopError } = await supabase
      .from('workshops')
      .select('*')
      .eq('id', workshopId)
      .eq('course_slug', courseSlug)
      .eq('status', 'upcoming')
      .single();

    if (workshopError || !workshop) {
      return res.status(400).json({ error: 'Selected workshop is no longer available. Please choose another date.' });
    }
    validatedWorkshopId = workshop.id;
    validatedWorkshop = workshop;
  }

  const { data, error } = await supabase
    .from('enrolments')
    .insert({
      user_id: req.user?.id ?? null,
      course_slug: courseSlug,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      country,
      organisation: organisation || null,
      category,
      mode,
      level,
      comments: comments || null,
      workshop_id: validatedWorkshopId,
      marketing_opt_in: !!marketingOptIn,
      consent_accepted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return sendServerError(res, error, 'enrolments.create.insert');
  }

  // Don't let an email hiccup block the response — the enrolment
  // itself already succeeded by this point. Cross-sells the soonest
  // upcoming in-person workshop, skipping the one just booked (if
  // any) so we're never recommending the session they already have.
  supabase
    .from('workshops')
    .select('*')
    .eq('status', 'upcoming')
    .order('start_date', { ascending: true })
    .limit(3)
    .then(({ data: upcoming }) => {
      const candidate = (upcoming || []).find((w) => w.id !== validatedWorkshopId);
      const nextWorkshop = candidate ? {
        id: candidate.id,
        courseSlug: candidate.course_slug,
        courseName: courseNames[candidate.course_slug] || candidate.course_slug,
        venue: candidate.venue,
        start_date: candidate.start_date,
      } : null;

      return sendEnrolmentConfirmationEmail({
        to: email,
        firstName,
        courseName: courseNames[courseSlug] || courseSlug,
        mode,
        category,
        level,
        workshop: validatedWorkshop,
        nextWorkshop,
      });
    })
    .catch((err) => console.error('[email] enrolment confirmation failed:', err.message));

  res.status(201).json(data);
});

// POST /api/enrolments/claim — links any guest (unauthenticated)
// enrolments matching the now-logged-in user's email to their
// account, so an in-person application submitted before creating an
// account becomes visible in their dashboard once they do. Called
// automatically on every sign-in (see main.js's SIGNED_IN handler) —
// safe to call repeatedly, since it only ever touches rows that are
// still unclaimed (user_id is null).
enrolmentsRouter.post('/claim', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('enrolments')
    .update({ user_id: req.user.id })
    .is('user_id', null)
    .ilike('email', req.user.email)
    .select('id');

  if (error) {
    return sendServerError(res, error, 'enrolments.claim');
  }

  res.json({ claimed: data.length });
});

// GET /api/enrolments/me — the logged-in user's own enrolments, with
// workshop details attached, and a learning-progress percentage for
// online enrolments (pages/dashboard.html).
enrolmentsRouter.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('enrolments')
    .select(ENROLMENT_SELECT)
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return sendServerError(res, error, 'enrolments.me');
  }

  const withProgress = await Promise.all(data.map(async (e) => {
    if (e.mode !== 'Online') return { ...e, progressPercent: null };
    // completedAt reflects any stamp getEnrolmentProgress just made
    // in this same call — e.completed_at above would still be the
    // stale pre-update value fetched before that happened.
    const { percent, completedAt } = await getEnrolmentProgress(e.course_slug, req.user.id, e.id);
    return { ...e, progressPercent: percent, completed_at: completedAt };
  }));

  res.json(withProgress);
});

// GET /api/enrolments/:id — a single enrolment's full details,
// including its workshop, for the enrolment detail page. Only the
// owning user can view it.
enrolmentsRouter.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('enrolments')
    .select(ENROLMENT_SELECT)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (error) {
    return res.status(404).json({ error: 'Enrolment not found.' });
  }

  res.json(data);
});

// POST /api/enrolments/:id/cancel — a user voluntarily stopping their
// own enrolment from the dashboard (distinct from an admin cancelling
// one via the Table Editor). body: { reason?: string }. Once
// cancelled, dashboard.html's own filtering removes the card, and
// stats/activity recompute from the remaining enrolments — there's
// nothing else to "sync" since nothing else reads this row's status.
enrolmentsRouter.post('/:id/cancel', requireAuth, async (req, res) => {
  const { reason } = req.body;

  const { data: enrolment, error: fetchError } = await supabase
    .from('enrolments')
    .select('id, status')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (fetchError || !enrolment) {
    return res.status(404).json({ error: 'Enrolment not found.' });
  }
  if (enrolment.status === 'cancelled') {
    return res.status(400).json({ error: 'This enrolment is already cancelled.' });
  }

  const { data, error } = await supabase
    .from('enrolments')
    .update({
      status: 'cancelled',
      cancellation_reason: reason?.trim() || null,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return sendServerError(res, error, 'enrolments.cancel');
  }

  sendEnrolmentCancelledEmail({
    to: data.email,
    firstName: data.first_name,
    courseName: courseNames[data.course_slug] || data.course_slug,
    reason: data.cancellation_reason,
    cancelledByAdmin: false,
  }).catch((err) => console.error('[email] enrolment cancellation (user) failed:', err.message));

  res.json(data);
});
