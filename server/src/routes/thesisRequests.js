import { Router } from 'express';
import multer from 'multer';
import { supabase } from '../config/supabaseClient.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { optionalAuth } from '../middleware/optionalAuth.js';
import { sendThesisRequestConfirmationEmail } from '../lib/email.js';
import { sendServerError } from '../lib/errors.js';
import { strictLimiter } from '../middleware/rateLimiters.js';

export const thesisRequestsRouter = Router();

const DOCUMENT_TYPES = ["Bachelor's Dissertation", "Master's Thesis", 'PhD Thesis', 'Journal Article', 'Other'];
const SERVICE_TYPES = ['Proofreading Only', 'Editing Only', 'Editing & Proofreading', 'Formatting & Referencing Only'];
const PAYMENT_METHODS = ['Bank Transfer', 'Mobile Money', 'Other'];
const UPLOAD_BUCKET = 'thesis-submissions';
const ALLOWED_UPLOAD_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 5 }, // 20MB per file, 5 files max
  fileFilter: (req, file, cb) => {
    cb(null, ALLOWED_UPLOAD_TYPES.has(file.mimetype));
  },
});

// POST /api/thesis-requests — the submission form on
// pages/thesis-editing.html. Guests and logged-in users can both
// submit; if a valid session is present, the request is linked to
// that profile via user_id (same pattern as /api/enrolments).
thesisRequestsRouter.post('/', strictLimiter, optionalAuth, (req, res, next) => {
  upload.array('files', 5)(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        error: err.code === 'LIMIT_FILE_SIZE'
          ? 'One of your files is too large (max 20MB each).'
          : err.code === 'LIMIT_FILE_COUNT'
            ? 'You can upload up to 5 files.'
            : 'Could not process the upload.',
      });
    }
    next();
  });
}, async (req, res) => {
  const {
    firstName, lastName, email, phone, documentType, serviceType,
    wordCount, pageCount, citationStyle, deadline, instructions, paymentMethod,
  } = req.body;

  const required = { firstName, lastName, email, phone, documentType, serviceType };
  const missing = Object.entries(required).filter(([, v]) => !v || !String(v).trim());
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing required field(s): ${missing.map(([k]) => k).join(', ')}`,
    });
  }

  if (!DOCUMENT_TYPES.includes(documentType)) {
    return res.status(400).json({ error: 'Invalid document type.' });
  }
  if (!SERVICE_TYPES.includes(serviceType)) {
    return res.status(400).json({ error: 'Invalid service type.' });
  }
  if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ error: 'Invalid payment method.' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Please attach at least one document (PDF or Word, up to 20MB each).' });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('thesis_requests')
    .insert({
      user_id: req.user?.id ?? null,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      document_type: documentType,
      service_type: serviceType,
      word_count: wordCount ? Number(wordCount) : null,
      page_count: pageCount ? Number(pageCount) : null,
      citation_style: citationStyle || null,
      deadline: deadline || null,
      instructions: instructions || null,
      payment_method: paymentMethod || null,
    })
    .select()
    .single();

  if (insertError) {
    return sendServerError(res, insertError, 'thesisRequests.create.insert');
  }

  const filePaths = [];
  for (const file of req.files) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${inserted.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(UPLOAD_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype });

    if (uploadError) {
      // Roll back the request row rather than leaving a submission
      // the client thinks failed but that sits in the admin queue
      // with missing/partial files.
      await supabase.from('thesis_requests').delete().eq('id', inserted.id);
      return sendServerError(res, uploadError, 'thesisRequests.create.upload');
    }
    filePaths.push(path);
  }

  const { data: finalRequest, error: updateError } = await supabase
    .from('thesis_requests')
    .update({ file_paths: filePaths })
    .eq('id', inserted.id)
    .select()
    .single();

  if (updateError) {
    return sendServerError(res, updateError, 'thesisRequests.create.attachFiles');
  }

  // Don't let an email hiccup block the response — the request
  // itself already succeeded by this point.
  sendThesisRequestConfirmationEmail({
    to: email,
    firstName,
    documentType,
    serviceType,
    deadline: deadline || null,
    fileCount: filePaths.length,
  }).catch((err) => console.error('[email] thesis request confirmation failed:', err.message));

  res.status(201).json(finalRequest);
});

// GET /api/thesis-requests/me — the logged-in user's own requests,
// newest first (pages/dashboard.html).
thesisRequestsRouter.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('thesis_requests')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return sendServerError(res, error, 'thesisRequests.me');
  }

  res.json(data);
});