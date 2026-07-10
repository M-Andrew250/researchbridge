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

  // Stamp completed_at the first time any caller (dashboard load,
  // quiz submit, etc.) computes 100% for this enrolment — lazily
  // here rather than in every progress-affecting endpoint, since
  // this helper is already the single source of truth for percent.
  // The null guard makes it idempotent: never overwritten once set.
  // Callers need the resulting value (not just whether *this* call
  // set it), since a stale pre-update copy would otherwise leak into
  // API responses built from an enrolment row fetched earlier in the
  // same request.
  let completedAt = null;
  if (percent === 100 && totalLessons > 0) {
    const { data: stamped, error: stampError } = await supabase
      .from('enrolments')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', enrolmentId)
      .is('completed_at', null)
      .select('completed_at')
      .maybeSingle();

    if (stampError) throw stampError;

    if (stamped) {
      completedAt = stamped.completed_at;
    } else {
      // Already stamped by an earlier call — read the existing value.
      const { data: existing, error: fetchError } = await supabase
        .from('enrolments')
        .select('completed_at')
        .eq('id', enrolmentId)
        .single();
      if (fetchError) throw fetchError;
      completedAt = existing.completed_at;
    }
  }

  return { totalLessons: totalLessons ?? 0, completedLessons: completedLessons ?? 0, percent, completedAt };
}
