import { supabase } from '../config/supabaseClient.js';

// Shared by: the "one active online course at a time" enrolment
// check, and the dashboard's per-card progress display. Keeping this
// in one place means both always agree on what "100%" means.
export async function getEnrolmentProgress(courseSlug, userId, enrolmentId) {
  const { count: totalLessons, error: totalError } = await supabase
    .from('lessons')
    .select('id, course_modules!inner(course_slug)', { count: 'exact', head: true })
    .eq('course_modules.course_slug', courseSlug);

  if (totalError) throw totalError;

  const { count: completedLessons, error: completedError } = await supabase
    .from('lesson_progress')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('enrolment_id', enrolmentId)
    .eq('completed', true);

  if (completedError) throw completedError;

  const percent = !totalLessons ? 0 : Math.round((completedLessons / totalLessons) * 100);

  return { totalLessons: totalLessons ?? 0, completedLessons: completedLessons ?? 0, percent };
}
