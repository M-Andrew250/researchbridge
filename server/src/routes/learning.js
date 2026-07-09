import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { verifyOnlineEnrolment } from '../middleware/verifyOnlineEnrolment.js';
import { sendServerError } from '../lib/errors.js';

export const learningRouter = Router();

// Private Storage bucket for uploaded course documents/images. A
// document/image material's content_url is treated as a bucket path
// (not a full URL) when it doesn't start with "http" — resolved to a
// short-lived signed URL here, so a raw link can never be
// shared/guessed to bypass the enrolment check above.
const STORAGE_BUCKET = 'course-materials';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

async function resolveMaterialUrl(material) {
  const needsSigning = (material.type === 'document' || material.type === 'image')
    && material.content_url
    && !material.content_url.startsWith('http');

  if (!needsSigning) {
    return material.content_url;
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(material.content_url, SIGNED_URL_TTL_SECONDS);
  return error ? null : data.signedUrl;
}

// A module unlocks once every module before it (by order_index) is
// complete — "complete" meaning every one of its lessons is done
// (document/video: marked completed; exercise/exam: quiz passed).
// The first module is always unlocked. Used both to annotate the
// curriculum for the sidebar and to gate direct lesson-detail access
// server-side (not just hidden in the UI — see verifyOnlineEnrolment's
// own comment on why that matters).
async function computeModuleUnlocks(courseSlug, userId, enrolmentId) {
  const { data: modules, error: modulesError } = await supabase
    .from('course_modules')
    .select('*, lessons(*)')
    .eq('course_slug', courseSlug)
    .order('order_index', { ascending: true })
    .order('order_index', { referencedTable: 'lessons', ascending: true });

  if (modulesError) throw modulesError;

  const { data: progressRows, error: progressError } = await supabase
    .from('lesson_progress')
    .select('lesson_id, completed, quiz_score, quiz_passed')
    .eq('user_id', userId)
    .eq('enrolment_id', enrolmentId);

  if (progressError) throw progressError;

  const progressByLesson = Object.fromEntries(progressRows.map(p => [p.lesson_id, p]));

  function isLessonDone(lesson) {
    const progress = progressByLesson[lesson.id];
    return (lesson.type === 'exercise' || lesson.type === 'exam')
      ? !!progress?.quiz_passed
      : !!progress?.completed;
  }

  let allPriorComplete = true;
  const moduleUnlocked = {};
  const moduleCompleted = {};

  for (const m of modules) {
    moduleUnlocked[m.id] = allPriorComplete;
    const thisComplete = m.lessons.length > 0 && m.lessons.every(isLessonDone);
    moduleCompleted[m.id] = thisComplete;
    allPriorComplete = allPriorComplete && thisComplete;
  }

  return { modules, progressByLesson, moduleUnlocked, moduleCompleted, isLessonDone };
}

// GET /api/enrolments/:enrolmentId/curriculum
// Modules + lessons for this enrolment's course, each lesson tagged
// with this user's completion state, plus the overall percentage
// that drives the progress ring.
learningRouter.get('/:enrolmentId/curriculum', requireAuth, verifyOnlineEnrolment, async (req, res) => {
  let unlocks;
  try {
    unlocks = await computeModuleUnlocks(req.enrolment.course_slug, req.user.id, req.enrolment.id);
  } catch (err) {
    return sendServerError(res, err, 'learning.curriculum.unlocks');
  }
  const { modules, progressByLesson, moduleUnlocked, moduleCompleted } = unlocks;

  let totalLessons = 0;
  let completedLessons = 0;

  const modulesOut = modules.map(m => ({
    id: m.id,
    title: m.title,
    unlocked: moduleUnlocked[m.id],
    completed: moduleCompleted[m.id],
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
        locked: !moduleUnlocked[m.id],
      };
    }),
  }));

  const overallPercent = totalLessons === 0
    ? 0
    : Math.round((completedLessons / totalLessons) * 100);

  // Surface the last lesson this user had open, so the frontend can
  // offer to resume there instead of dropping them at a blank state.
  let lastLesson = null;
  if (req.enrolment.last_lesson_id) {
    for (const m of modulesOut) {
      const match = m.lessons.find(l => l.id === req.enrolment.last_lesson_id);
      if (match) {
        lastLesson = { id: match.id, title: match.title, moduleTitle: m.title };
        break;
      }
    }
  }

  res.json({
    courseSlug: req.enrolment.course_slug,
    modules: modulesOut,
    overallPercent,
    totalLessons,
    completedLessons,
    lastLesson,
  });
});

// GET /api/enrolments/:enrolmentId/lessons/:lessonId
// Full lesson content. For exercise/exam lessons, includes the quiz
// questions/options with is_correct stripped out — the answer key
// never reaches the browser before grading.
learningRouter.get('/:enrolmentId/lessons/:lessonId', requireAuth, verifyOnlineEnrolment, async (req, res) => {
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('*, module:course_modules!inner(id, course_slug)')
    .eq('id', req.params.lessonId)
    .single();

  if (lessonError || !lesson || lesson.module.course_slug !== req.enrolment.course_slug) {
    return res.status(404).json({ error: 'Lesson not found.' });
  }

  let unlocks;
  try {
    unlocks = await computeModuleUnlocks(req.enrolment.course_slug, req.user.id, req.enrolment.id);
  } catch (err) {
    return sendServerError(res, err, 'learning.lesson.unlocks');
  }
  if (!unlocks.moduleUnlocked[lesson.module.id]) {
    return res.status(403).json({ error: 'Complete the previous module to unlock this lesson.' });
  }

  // Remember this as "where they were" for the resume-prompt on next visit.
  const { error: lastLessonError } = await supabase
    .from('enrolments')
    .update({ last_lesson_id: lesson.id, last_viewed_at: new Date().toISOString() })
    .eq('id', req.enrolment.id);
  if (lastLessonError) {
    console.error('[learning.lastLesson]', lastLessonError.message);
  }

  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('completed, quiz_score, quiz_passed, quiz_attempts, last_position_seconds')
    .eq('user_id', req.user.id)
    .eq('enrolment_id', req.enrolment.id)
    .eq('lesson_id', lesson.id)
    .maybeSingle();

  const { data: materials, error: materialsError } = await supabase
    .from('lesson_materials')
    .select('id, title, type, content_url, content_body, order_index')
    .eq('lesson_id', lesson.id)
    .order('order_index', { ascending: true });

  if (materialsError) {
    return sendServerError(res, materialsError, 'learning.lesson.materials');
  }

  const out = {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type,
    materials: await Promise.all(materials.map(async m => ({
      id: m.id,
      title: m.title,
      type: m.type,
      contentUrl: await resolveMaterialUrl(m),
      contentBody: m.content_body,
    }))),
    completed: !!progress?.completed,
    quizScore: progress?.quiz_score ?? null,
    quizPassed: progress?.quiz_passed ?? null,
    quizAttempts: progress?.quiz_attempts ?? 0,
    videoPosition: progress?.last_position_seconds ?? 0,
  };

  if (lesson.type === 'exercise' || lesson.type === 'exam') {
    // is_correct is fetched here (server-side only) purely to compute
    // allowMultiple — it's stripped out below before the response is
    // built, same guarantee as before: the answer key never reaches
    // the browser ahead of grading.
    const { data: questions, error: qError } = await supabase
      .from('quiz_questions')
      .select('id, question_text, order_index, quiz_options(id, option_text, order_index, is_correct)')
      .eq('lesson_id', lesson.id)
      .order('order_index', { ascending: true })
      .order('order_index', { referencedTable: 'quiz_options', ascending: true });

    if (qError) {
      return sendServerError(res, qError, 'learning.lesson.questions');
    }

    out.questions = questions.map(q => ({
      id: q.id,
      questionText: q.question_text,
      allowMultiple: q.quiz_options.filter(o => o.is_correct).length > 1,
      options: q.quiz_options.map(o => ({ id: o.id, optionText: o.option_text })),
    }));
    out.passThreshold = lesson.pass_threshold;
  }

  res.json(out);
});

// POST /api/enrolments/:enrolmentId/lessons/:lessonId/video-position
// body: { position: number } — how many seconds into the video the
// user has watched. Saved periodically by the player so it can resume
// from here next time, distinct from /complete which marks it done.
learningRouter.post('/:enrolmentId/lessons/:lessonId/video-position', requireAuth, verifyOnlineEnrolment, async (req, res) => {
  const position = Number(req.body.position);
  if (!Number.isFinite(position) || position < 0) {
    return res.status(400).json({ error: 'position must be a non-negative number.' });
  }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, type')
    .eq('id', req.params.lessonId)
    .single();

  if (!lesson || lesson.type !== 'video') {
    return res.status(400).json({ error: 'Only video lessons track playback position.' });
  }

  const { error } = await supabase
    .from('lesson_progress')
    .upsert({
      user_id: req.user.id,
      enrolment_id: req.enrolment.id,
      lesson_id: lesson.id,
      last_position_seconds: position,
    }, { onConflict: 'user_id,enrolment_id,lesson_id' });

  if (error) {
    return sendServerError(res, error, 'learning.videoPosition');
  }

  res.status(204).end();
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
    return sendServerError(res, error, 'learning.completeLesson');
  }

  res.json(data);
});

function gradeAnswer(question, submittedIds) {
  const correctIds = new Set(question.quiz_options.filter(o => o.is_correct).map(o => o.id));
  const submitted = new Set(submittedIds);
  const isCorrect = submitted.size === correctIds.size && [...submitted].every(id => correctIds.has(id));
  return { isCorrect, correctIds: [...correctIds] };
}

// POST /api/enrolments/:enrolmentId/lessons/:lessonId/questions/:questionId/check
// body: { optionIds: [...] }
// Grades ONE question against the answer key as a formative "check
// yourself" aid for the per-question submit/retry flow on exercise
// lessons. Never persists anything — submit-quiz below is the only
// thing that records an official score/pass. Exam lessons don't get
// this (no reveal-as-you-go on a real exam); they're graded blind,
// only via submit-quiz.
learningRouter.post('/:enrolmentId/lessons/:lessonId/questions/:questionId/check', requireAuth, verifyOnlineEnrolment, async (req, res) => {
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, type')
    .eq('id', req.params.lessonId)
    .single();

  if (!lesson || lesson.type !== 'exercise') {
    return res.status(400).json({ error: 'Only exercise questions can be checked individually.' });
  }

  const { data: question, error } = await supabase
    .from('quiz_questions')
    .select('id, quiz_options(id, is_correct)')
    .eq('id', req.params.questionId)
    .eq('lesson_id', lesson.id)
    .maybeSingle();

  if (error || !question) {
    return res.status(404).json({ error: 'Question not found.' });
  }

  const submittedIds = Array.isArray(req.body.optionIds) ? req.body.optionIds : [];
  const { isCorrect, correctIds } = gradeAnswer(question, submittedIds);

  res.json({ correct: isCorrect, correctOptionIds: correctIds });
});

const MAX_QUIZ_ATTEMPTS = 3;

// POST /api/enrolments/:enrolmentId/lessons/:lessonId/submit-quiz
// body: { answers: [{ questionId, optionIds: [...] }, ...] }
// Grades server-side against quiz_options.is_correct — a question is
// correct only if the submitted set of option ids exactly matches the
// correct set (works for both single- and multi-answer questions).
// Capped at MAX_QUIZ_ATTEMPTS while not yet passed. Exam lessons never
// get per-question feedback back, even here — only the overall score.
learningRouter.post('/:enrolmentId/lessons/:lessonId/submit-quiz', requireAuth, verifyOnlineEnrolment, async (req, res) => {
  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, type, pass_threshold')
    .eq('id', req.params.lessonId)
    .single();

  if (!lesson || (lesson.type !== 'exercise' && lesson.type !== 'exam')) {
    return res.status(400).json({ error: 'This lesson is not a quiz.' });
  }

  const { data: existingProgress } = await supabase
    .from('lesson_progress')
    .select('quiz_attempts, quiz_passed')
    .eq('user_id', req.user.id)
    .eq('enrolment_id', req.enrolment.id)
    .eq('lesson_id', lesson.id)
    .maybeSingle();

  const attemptsSoFar = existingProgress?.quiz_attempts ?? 0;
  if (!existingProgress?.quiz_passed && attemptsSoFar >= MAX_QUIZ_ATTEMPTS) {
    return res.status(403).json({ error: `Maximum attempts (${MAX_QUIZ_ATTEMPTS}) reached for this quiz.` });
  }

  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];

  const { data: questions, error: qError } = await supabase
    .from('quiz_questions')
    .select('id, quiz_options(id, is_correct)')
    .eq('lesson_id', lesson.id);

  if (qError) {
    return sendServerError(res, qError, 'learning.submitQuiz.questions');
  }
  if (questions.length === 0) {
    return res.status(400).json({ error: 'This quiz has no questions yet.' });
  }

  let correctCount = 0;
  const feedback = questions.map(q => {
    const submitted = answers.find(a => a.questionId === q.id);
    const { isCorrect, correctIds } = gradeAnswer(q, submitted?.optionIds ?? []);
    if (isCorrect) correctCount += 1;
    return { questionId: q.id, correct: isCorrect, correctOptionIds: correctIds };
  });

  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= lesson.pass_threshold;
  const newAttemptCount = attemptsSoFar + 1;

  const { data, error } = await supabase
    .from('lesson_progress')
    .upsert({
      user_id: req.user.id,
      enrolment_id: req.enrolment.id,
      lesson_id: lesson.id,
      completed: true,
      quiz_score: score,
      quiz_passed: passed,
      quiz_attempts: newAttemptCount,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,enrolment_id,lesson_id' })
    .select()
    .single();

  if (error) {
    return sendServerError(res, error, 'learning.submitQuiz.save');
  }

  res.json({
    score,
    passed,
    passThreshold: lesson.pass_threshold,
    attemptsUsed: newAttemptCount,
    attemptsRemaining: Math.max(0, MAX_QUIZ_ATTEMPTS - newAttemptCount),
    feedback: lesson.type === 'exam' ? null : feedback,
    progress: data,
  });
});
