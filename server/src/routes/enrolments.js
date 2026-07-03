import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { getEnrolmentProgress } from '../lib/enrolmentProgress.js';
import { courseNames } from '../lib/courseNames.js';
import { sendEnrolmentConfirmationEmail } from '../lib/email.js';

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
enrolmentsRouter.post('/', optionalAuth, async (req, res) => {
  const {
    courseSlug, firstName, lastName, email, phone,
    organisation, category, mode, level, comments, workshopId,
  } = req.body;

  const required = { courseSlug, firstName, lastName, email, phone, category, mode, level };
  const missing = Object.entries(required).filter(([, v]) => !v || !String(v).trim());
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing required field(s): ${missing.map(([k]) => k).join(', ')}`,
    });
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
      .eq('mode', 'Online');

    if (existingError) {
      return res.status(500).json({ error: existingError.message });
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
        return res.status(500).json({ error: existingAppError.message });
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
      organisation: organisation || null,
      category,
      mode,
      level,
      comments: comments || null,
      workshop_id: validatedWorkshopId,
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Don't let an email hiccup block the response — the enrolment
  // itself already succeeded by this point.
  sendEnrolmentConfirmationEmail({
    to: email,
    firstName,
    courseName: courseNames[courseSlug] || courseSlug,
    mode,
    category,
    level,
    workshop: validatedWorkshop,
  }).catch((err) => console.error('[email] enrolment confirmation failed:', err.message));

  res.status(201).json(data);
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
    return res.status(500).json({ error: error.message });
  }

  const withProgress = await Promise.all(data.map(async (e) => {
    if (e.mode !== 'Online') return { ...e, progressPercent: null };
    const { percent } = await getEnrolmentProgress(e.course_slug, req.user.id, e.id);
    return { ...e, progressPercent: percent };
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
