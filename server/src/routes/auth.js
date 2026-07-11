import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { sendServerError } from '../lib/errors.js';
import { strictLimiter } from '../middleware/rateLimiters.js';

export const authRouter = Router();

// GET /api/auth/check-phone?phone=<phone> — called by signup.html
// before creating the account. Email duplicates are already rejected
// by Supabase Auth's own signUp() call (email is the unique identity
// column on auth.users), but phone is just profile metadata with no
// such built-in check, hence this route. Rate-limited — otherwise
// it's an easy way to enumerate which phone numbers have accounts.
authRouter.get('/check-phone', strictLimiter, async (req, res) => {
  const { phone } = req.query;
  if (!phone) {
    return res.status(400).json({ error: 'Missing phone query parameter.' });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (error) {
    return sendServerError(res, error, 'auth.check-phone');
  }

  res.json({ exists: !!data });
});

// GET /api/auth/me — the logged-in user's own profile row (pages/profile.html).
// RLS blocks the frontend from reading `profiles` directly (see the
// architecture notes at the top of the init migration), so this is
// the one read path for a user's own name/phone/avatar.
authRouter.get('/me', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, phone, avatar_url, is_admin, country')
    .eq('id', req.user.id)
    .single();

  if (error) {
    return sendServerError(res, error, 'auth.me.get');
  }

  res.json({
    fullName: data.full_name,
    phone: data.phone,
    avatarUrl: data.avatar_url,
    isAdmin: data.is_admin,
    country: data.country,
  });
});

// PATCH /api/auth/me — update the caller's own name/phone/avatar.
// body: { fullName?, phone?, avatarUrl? }. A changed phone is checked
// against every other profile first, same duplicate rule as signup.
authRouter.patch('/me', requireAuth, async (req, res) => {
  const { fullName, phone, avatarUrl } = req.body;
  const updates = {};

  if (fullName !== undefined) {
    if (!String(fullName).trim()) {
      return res.status(400).json({ error: 'Full name cannot be empty.' });
    }
    updates.full_name = fullName.trim();
  }

  if (phone !== undefined) {
    if (!String(phone).trim()) {
      return res.status(400).json({ error: 'Phone number cannot be empty.' });
    }
    const { data: existing, error: existingError } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .neq('id', req.user.id)
      .maybeSingle();

    if (existingError) {
      return sendServerError(res, existingError, 'auth.me.checkPhone');
    }
    if (existing) {
      return res.status(409).json({ error: 'That phone number is already registered to another account.' });
    }
    updates.phone = phone.trim();
  }

  if (avatarUrl !== undefined) {
    updates.avatar_url = avatarUrl;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to update.' });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', req.user.id)
    .select('full_name, phone, avatar_url')
    .single();

  if (error) {
    return sendServerError(res, error, 'auth.me.patch');
  }

  res.json({ fullName: data.full_name, phone: data.phone, avatarUrl: data.avatar_url });
});
