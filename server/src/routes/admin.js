import { Router } from 'express';
import multer from 'multer';
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

// ── COURSE CONTENT (modules + lessons) ──
// Quiz question/option authoring for exercise/exam lessons is a
// separate follow-up; these routes only manage course structure.

const LESSON_TYPES = ['document', 'video', 'exercise', 'exam'];

// GET /api/admin/course-modules?course=<slug> — every module for a
// course, each with its lessons nested, ordered for display.
adminRouter.get('/course-modules', async (req, res) => {
  const { course } = req.query;
  if (!course) {
    return res.status(400).json({ error: 'Missing course query parameter.' });
  }

  const { data, error } = await supabase
    .from('course_modules')
    .select('*, lessons(*)')
    .eq('course_slug', course)
    .order('order_index', { ascending: true })
    .order('order_index', { referencedTable: 'lessons', ascending: true });

  if (error) {
    return sendServerError(res, error, 'admin.courseModules.list');
  }

  res.json(data);
});

// POST /api/admin/course-modules — body: { course_slug, title, order_index? }
adminRouter.post('/course-modules', async (req, res) => {
  const { course_slug, title, order_index } = req.body;
  if (!String(course_slug ?? '').trim() || !String(title ?? '').trim()) {
    return res.status(400).json({ error: 'Missing required field(s): course_slug, title' });
  }

  const { data, error } = await supabase
    .from('course_modules')
    .insert({ course_slug, title: title.trim(), order_index: Number(order_index) || 0 })
    .select()
    .single();

  if (error) {
    return sendServerError(res, error, 'admin.courseModules.create');
  }

  res.status(201).json(data);
});

// PATCH /api/admin/course-modules/:id — body: { title, order_index? }
adminRouter.patch('/course-modules/:id', async (req, res) => {
  const { title, order_index } = req.body;
  if (!String(title ?? '').trim()) {
    return res.status(400).json({ error: 'Missing required field(s): title' });
  }

  const { data, error } = await supabase
    .from('course_modules')
    .update({ title: title.trim(), order_index: Number(order_index) || 0 })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(404).json({ error: 'Module not found.' });
  }

  res.json(data);
});

// DELETE /api/admin/course-modules/:id — cascades to its lessons
// (and their quiz questions/options) via ON DELETE CASCADE.
adminRouter.delete('/course-modules/:id', async (req, res) => {
  const { error } = await supabase
    .from('course_modules')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return sendServerError(res, error, 'admin.courseModules.delete');
  }

  res.status(204).end();
});

// POST /api/admin/lessons — body: { module_id, title, type, order_index?, content_url?, content_body?, pass_threshold? }
adminRouter.post('/lessons', async (req, res) => {
  const { module_id, title, type, order_index, content_url, content_body, pass_threshold } = req.body;

  if (!String(module_id ?? '').trim() || !String(title ?? '').trim()) {
    return res.status(400).json({ error: 'Missing required field(s): module_id, title' });
  }
  if (!LESSON_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${LESSON_TYPES.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      module_id,
      title: title.trim(),
      type,
      order_index: Number(order_index) || 0,
      content_url: content_url || null,
      content_body: content_body || null,
      pass_threshold: Number(pass_threshold) || 70,
    })
    .select()
    .single();

  if (error) {
    return sendServerError(res, error, 'admin.lessons.create');
  }

  res.status(201).json(data);
});

// PATCH /api/admin/lessons/:id — same body shape as POST (minus module_id, which doesn't move).
adminRouter.patch('/lessons/:id', async (req, res) => {
  const { title, type, order_index, content_url, content_body, pass_threshold } = req.body;

  if (!String(title ?? '').trim()) {
    return res.status(400).json({ error: 'Missing required field(s): title' });
  }
  if (!LESSON_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${LESSON_TYPES.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('lessons')
    .update({
      title: title.trim(),
      type,
      order_index: Number(order_index) || 0,
      content_url: content_url || null,
      content_body: content_body || null,
      pass_threshold: Number(pass_threshold) || 70,
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(404).json({ error: 'Lesson not found.' });
  }

  res.json(data);
});

// DELETE /api/admin/lessons/:id — cascades to its quiz questions/options.
adminRouter.delete('/lessons/:id', async (req, res) => {
  const { error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return sendServerError(res, error, 'admin.lessons.delete');
  }

  res.status(204).end();
});

// ── COURSE MATERIAL UPLOADS ──
// Feeds a document lesson's content_url: learning.js's resolveContentUrl
// treats a non-"http" content_url as a path inside this private bucket
// and signs a short-lived URL to it on each request.

const UPLOAD_BUCKET = 'course-materials';
const ALLOWED_UPLOAD_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    cb(null, ALLOWED_UPLOAD_TYPES.has(file.mimetype));
  },
});

// POST /api/admin/uploads/course-material — multipart form: { file, course_slug }
// Returns { path } to paste into a document lesson's Content URL field.
adminRouter.post('/uploads/course-material', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 20MB).' : 'Could not process the upload.',
      });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing file, or its type/size is not allowed (PDF/Word/PowerPoint/Excel, up to 20MB).' });
  }
  if (!String(req.body.course_slug ?? '').trim()) {
    return res.status(400).json({ error: 'Missing required field: course_slug' });
  }

  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${req.body.course_slug}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .upload(path, req.file.buffer, { contentType: req.file.mimetype });

  if (error) {
    return sendServerError(res, error, 'admin.uploads.courseMaterial');
  }

  res.status(201).json({ path });
});

// ── QUIZ QUESTIONS & OPTIONS (exercise/exam lessons) ──
// Options are fully replaced on every question save (delete existing,
// insert submitted) rather than diffed by id — this is a low-volume
// admin action and it keeps the frontend's "one form, N option rows"
// UX simple.

// GET /api/admin/lessons/:id/questions — questions with their options,
// including is_correct (unlike the learner-facing route — this IS
// the answer key, for the admin authoring panel).
adminRouter.get('/lessons/:id/questions', async (req, res) => {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*, quiz_options(*)')
    .eq('lesson_id', req.params.id)
    .order('order_index', { ascending: true })
    .order('order_index', { referencedTable: 'quiz_options', ascending: true });

  if (error) {
    return sendServerError(res, error, 'admin.questions.list');
  }

  res.json(data);
});

function parseQuestionBody(body) {
  const questionText = String(body.questionText ?? '').trim();
  if (!questionText) {
    return { error: 'Missing required field: questionText' };
  }

  const rawOptions = Array.isArray(body.options) ? body.options : [];
  if (rawOptions.length < 2) {
    return { error: 'A question needs at least 2 options.' };
  }

  const options = rawOptions.map((o, i) => ({
    option_text: String(o.optionText ?? '').trim(),
    is_correct: !!o.isCorrect,
    order_index: i,
  }));

  if (options.some(o => !o.option_text)) {
    return { error: 'Every option needs text.' };
  }
  if (options.filter(o => o.is_correct).length !== 1) {
    return { error: 'Exactly one option must be marked correct.' };
  }

  return { questionText, options };
}

// POST /api/admin/lessons/:id/questions
// body: { questionText, options: [{ optionText, isCorrect }, ...] }
adminRouter.post('/lessons/:id/questions', async (req, res) => {
  const parsed = parseQuestionBody(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const { count } = await supabase
    .from('quiz_questions')
    .select('id', { count: 'exact', head: true })
    .eq('lesson_id', req.params.id);

  const { data: question, error: qError } = await supabase
    .from('quiz_questions')
    .insert({
      lesson_id: req.params.id,
      question_text: parsed.questionText,
      order_index: count ?? 0,
    })
    .select()
    .single();

  if (qError) {
    return sendServerError(res, qError, 'admin.questions.create');
  }

  const { error: oError } = await supabase
    .from('quiz_options')
    .insert(parsed.options.map(o => ({ ...o, question_id: question.id })));

  if (oError) {
    return sendServerError(res, oError, 'admin.questions.create.options');
  }

  const { data: full } = await supabase
    .from('quiz_questions')
    .select('*, quiz_options(*)')
    .eq('id', question.id)
    .single();

  res.status(201).json(full);
});

// PATCH /api/admin/questions/:id — same body shape as POST.
adminRouter.patch('/questions/:id', async (req, res) => {
  const parsed = parseQuestionBody(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const { data: question, error: qError } = await supabase
    .from('quiz_questions')
    .update({ question_text: parsed.questionText })
    .eq('id', req.params.id)
    .select()
    .single();

  if (qError) {
    return res.status(404).json({ error: 'Question not found.' });
  }

  const { error: deleteError } = await supabase
    .from('quiz_options')
    .delete()
    .eq('question_id', question.id);

  if (deleteError) {
    return sendServerError(res, deleteError, 'admin.questions.update.clearOptions');
  }

  const { error: oError } = await supabase
    .from('quiz_options')
    .insert(parsed.options.map(o => ({ ...o, question_id: question.id })));

  if (oError) {
    return sendServerError(res, oError, 'admin.questions.update.options');
  }

  const { data: full } = await supabase
    .from('quiz_questions')
    .select('*, quiz_options(*)')
    .eq('id', question.id)
    .single();

  res.json(full);
});

// DELETE /api/admin/questions/:id — cascades its options.
adminRouter.delete('/questions/:id', async (req, res) => {
  const { error } = await supabase
    .from('quiz_questions')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return sendServerError(res, error, 'admin.questions.delete');
  }

  res.status(204).end();
});
