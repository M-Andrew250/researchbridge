import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { sendServerError } from '../lib/errors.js';

export const workshopsRouter = Router();

// GET /api/workshops/next — the single soonest upcoming workshop
// across all courses, shown in the homepage's guest promo widget.
// Registered before the parameterised "/" route below so it isn't
// shadowed by it.
workshopsRouter.get('/next', async (req, res) => {
  const { data, error } = await supabase
    .from('workshops')
    .select('*')
    .eq('status', 'upcoming')
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return sendServerError(res, error, 'workshops.next');
  }

  res.json(data);
});

// GET /api/workshops?course=<slug> — upcoming in-person workshops
// for a course, shown in enrol.html's date picker when a visitor
// chooses "In-Person".
workshopsRouter.get('/', async (req, res) => {
  const { course } = req.query;
  if (!course) {
    return res.status(400).json({ error: 'Missing course query parameter.' });
  }

  const { data, error } = await supabase
    .from('workshops')
    .select('*')
    .eq('course_slug', course)
    .eq('status', 'upcoming')
    .order('start_date', { ascending: true });

  if (error) {
    return sendServerError(res, error, 'workshops.list');
  }

  res.json(data);
});
