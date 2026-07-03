import { supabase } from '../config/supabaseClient.js';

// Shared guard for every learning-platform route: the enrolment must
// belong to the requesting user, be an Online enrolment, and be
// confirmed by an admin — matching pages/dashboard.html, which only
// links to the learning platform once a card is marked Confirmed.
// Enforced here too (not just hidden in the UI) so a pending
// enrolment can't be accessed by calling the API directly.
// Attaches the verified row as req.enrolment.
export async function verifyOnlineEnrolment(req, res, next) {
  const { enrolmentId } = req.params;

  const { data, error } = await supabase
    .from('enrolments')
    .select('*')
    .eq('id', enrolmentId)
    .eq('user_id', req.user.id)
    .eq('mode', 'Online')
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Enrolment not found.' });
  }

  if (data.status !== 'confirmed') {
    return res.status(403).json({ error: 'This enrolment is not confirmed yet. The learning platform unlocks once it is.' });
  }

  req.enrolment = data;
  next();
}
