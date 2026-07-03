import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { verifyOnlineEnrolment } from '../middleware/verifyOnlineEnrolment.js';

export const learningRouter = Router();

// Private Storage bucket for uploaded course documents (PDFs etc.).
// A lesson's content_url is treated as a bucket path (not a full
// URL) when it doesn't start with "http" — resolved to a short-lived
// signed URL here, so a raw link can never be shared/guessed to
// bypass the enrolment check above.
const STORAGE_BUCKET = 'course-materials';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

async function resolveContentUrl(lesson) {
  if (lesson.type !== 'document' || !lesson.content_url || lesson.content_url.startsWith('http')) {
    return lesson.content_url;
  }
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(lesson.content_url, SIGNED_URL_TTL_SECONDS);
  return error ? null : data.signedUrl;
}

// GET /api/enrolments/:enrolmentId/curriculum
// Modules + lessons for this enrolment's course, each lesson tagged
// with this user's completion state, plus the overall percentage
// that drives the progress ring.
learningRouter.get('/:enrolmentId/curriculum', requireAuth, verifyOnlineEnrolment, async (req, res) => {
  const { data: modules, error: modulesError } = await supabase
    .from('course_modules')
    .select('*, lessons(*)')
    .eq('course_slug', req.enrolment.course_slug)
    .order('order_index', { ascending: true })
    .order('order_index', { referencedTable: 'lessons', ascending: true });

  if (modulesError) {
    return res.status(500).json({ error: modulesError.message });
  }

  const { data: progressRows, error: progressError } = await supabase
    .from('lesson_progress')
    .select('lesson_id, completed, quiz_score, quiz_passed')
    .eq('user_id', req.user.id)
    .eq('enrolment_id', req.enrolment.id);

  if (progressError) {
    return res.status(500).json({ error: progressError.message });
  }

  const progressByLesson = Object.fromEntries(progressRows.map(p => [p.lesson_id, p]));

  let totalLessons = 0;
  let completedLessons = 0;

  const modulesOut = modules.map(m => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map(l => {
      totalLessons += 1;
      const progress = progressByLesson[l.id];
      if (progress?.completed) completedLessons += 1;
      return {
        id: l.id,
        title: l.title,
        type: l.type,
        completed: !!progress?.completed,
        quizScore: progress?.quiz_score ?? null,
        quizPassed: progress?.quiz_passed ?? null,
      };
    }),
  }));

  const overallPercent = totalLessons === 0
    ? 0
    : Math.round((completedLessons / totalLessons) * 100);

  res.json({
    courseSlug: req.enrolment.course_slug,
    modules: modulesOut,
    overallPercent,
    totalLessons,
    completedLessons,
  });
});

// GET /api/enrolments/:enrolmentId/lessons/:lessonId
// Full lesson content. For exercise/exam lessons, includes the quiz
// questions/options with is_correct stripped out — the answer key
// never reaches the browser before grading.
learningRouter.get('/:enrolmentId/lessons/:lessonId', requireAuth, verifyOnlineEnrolment, async (req, res) => {
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('*, module:course_modules!inner(course_slug)')
    .eq('id', req.params.lessonId)
    .single();

  if (lessonError || !lesson || lesson.module.course_slug !== req.enrolment.course_slug) {
    return res.status(404).json({ error: 'Lesson not found.' });
  }

  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('completed, quiz_score, quiz_passed')
    .eq('user_id', req.user.id)
    .eq('enrolment_id', req.enrolment.id)
    .eq('lesson_id', lesson.id)
    .maybeSingle();

  const out = {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type,
    contentUrl: await resolveContentUrl(lesson),
    contentBody: lesson.content_body,
    completed: !!progress?.completed,
    quizScore: progress?.quiz_score ?? null,
    quizPassed: progress?.quiz_passed ?? null,
  };

  if (lesson.type === 'exercise' || lesson.type === 'exam') {
    const { data: questions, error: qError } = await supabase
      .from('quiz_questions')
      .select('id, question_text, order_index, quiz_options(id, option_text, order_index)')
      .eq('lesson_id', lesson.id)
      .order('order_index', { ascending: true })
      .order('order_index', { referencedTable: 'quiz_options', ascending: true });

    if (qError) {
      return res.status(500).json({ error: qError.message });
    }

    out.questions = questions.map(q => ({
      id: q.id,
      questionText: q.question_text,
      options: q.quiz_options.map(o => ({ id: o.id, optionText: o.option_text })),
    }));
    out.passThreshold = lesson.pass_threshold;
  }

  res.json(out);
});

// POST /api/enrolments/:enrolmentId/lessons/:lessonId/complete
// Marks a document/video lesson as done.
learningRouter.post('/:enrolmentId/lessons/:lessonId/complete', requireAuth, verifyOnlineEnrolment, async (req, res) => {
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, type')
    .eq('id', req.params.lessonId)
    .single();

  if (!lesson || (lesson.type !== 'document' && lesson.type !== 'video')) {
    return res.status(400).json({ error: 'This lesson type is completed by submitting it, not marking it complete.' });
  }

  const { data, error } = await supabase
    .from('lesson_progress')
    .upsert({
      user_id: req.user.id,
      enrolment_id: req.enrolment.id,
      lesson_id: lesson.id,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,enrolment_id,lesson_id' })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// POST /api/enrolments/:enrolmentId/lessons/:lessonId/submit-quiz
// body: { answers: [{ questionId, optionId }, ...] }
// Grades server-side against quiz_options.is_correct — the client
// never sees correct answers before submitting.
learningRouter.post('/:enrolmentId/lessons/:lessonId/submit-quiz', requireAuth, verifyOnlineEnrolment, async (req, res) => {
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, type, pass_threshold')
    .eq('id', req.params.lessonId)
    .single();

  if (!lesson || (lesson.type !== 'exercise' && lesson.type !== 'exam')) {
    return res.status(400).json({ error: 'This lesson is not a quiz.' });
  }

  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];

  const { data: questions, error: qError } = await supabase
    .from('quiz_questions')
    .select('id, quiz_options(id, is_correct)')
    .eq('lesson_id', lesson.id);

  if (qError) {
    return res.status(500).json({ error: qError.message });
  }
  if (questions.length === 0) {
    return res.status(400).json({ error: 'This quiz has no questions yet.' });
  }

  let correctCount = 0;
  const feedback = questions.map(q => {
    const submitted = answers.find(a => a.questionId === q.id);
    const correctOption = q.quiz_options.find(o => o.is_correct);
    const isCorrect = !!submitted && submitted.optionId === correctOption?.id;
    if (isCorrect) correctCount += 1;
    return { questionId: q.id, correct: isCorrect, correctOptionId: correctOption?.id ?? null };
  });

  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= lesson.pass_threshold;

  const { data, error } = await supabase
    .from('lesson_progress')
    .upsert({
      user_id: req.user.id,
      enrolment_id: req.enrolment.id,
      lesson_id: lesson.id,
      completed: true,
      quiz_score: score,
      quiz_passed: passed,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,enrolment_id,lesson_id' })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ score, passed, passThreshold: lesson.pass_threshold, feedback, progress: data });
});
