import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';

export const contactRouter = Router();

// POST /api/contact — the contact form on index.html. Always public,
// no login required.
contactRouter.post('/', async (req, res) => {
  const { firstName, lastName, email, category, serviceInterest, message } = req.body;

  const required = { firstName, lastName, email, message };
  const missing = Object.entries(required).filter(([, v]) => !v || !String(v).trim());
  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing required field(s): ${missing.map(([k]) => k).join(', ')}`,
    });
  }

  const { data, error } = await supabase
    .from('contact_messages')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      category: category || null,
      service_interest: serviceInterest || null,
      message,
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json(data);
});
