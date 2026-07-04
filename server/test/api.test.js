// Integration tests against a real (test) Supabase project — the
// same one server/.env points to. These hit the actual database,
// so they create their own throwaway users/enrolments/content and
// clean up after themselves; they don't touch anything a real user
// created.
//
// Run with: npm test
// (spawns the Express server itself — no need to start it manually.)

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { supabase as serverSupabase } from '../src/config/supabaseClient.js';

// Same public anon key already embedded in js/main.js — safe to
// duplicate here, it's not a secret (see docs/ARCHITECTURE.md §7).
const SUPABASE_URL = 'https://ztrokpqlinqezmnicrpi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0cm9rcHFsaW5xZXptbmljcnBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjYzNDEsImV4cCI6MjA5ODY0MjM0MX0.Tkd234JkFGvdIQFIsj1DjLJxEj6oVyi5mJZTORbvFl0';

const TEST_PORT = 4099; // separate from the dev server's default 4000
const API = `http://localhost:${TEST_PORT}`;

let serverProcess;

before(async () => {
  serverProcess = spawn(process.execPath, ['src/index.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'test' },
  });

  // Wait for the server to actually accept connections rather than a
  // fixed sleep — poll the health endpoint.
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const res = await fetch(`${API}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Test server did not become healthy in time.');
});

after(() => {
  serverProcess.kill();
});

// ── Test helpers ──
async function createTestUser(overrides = {}) {
  const email = `rbc-test-${Date.now()}-${Math.random().toString(36).slice(2)}@gmail.com`;
  const password = 'TestPassword123!';
  const { data } = await serverSupabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: 'Test User', ...overrides },
  });
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: signIn } = await anon.auth.signInWithPassword({ email, password });
  return {
    userId: data.user.id,
    email,
    authHeader: { Authorization: `Bearer ${signIn.session.access_token}` },
  };
}

async function deleteTestUser(userId) {
  await serverSupabase.auth.admin.deleteUser(userId);
}

// ── AUTH ──
describe('auth', () => {
  test('check-phone reports false for an unused number, true once registered', async () => {
    const phone = `+250700${Date.now().toString().slice(-6)}`;

    const before = await (await fetch(`${API}/api/auth/check-phone?phone=${encodeURIComponent(phone)}`)).json();
    assert.equal(before.exists, false);

    const { data: user } = await serverSupabase.auth.admin.createUser({
      email: `rbc-phonetest-${Date.now()}@gmail.com`,
      password: 'TestPassword123!', email_confirm: true,
      user_metadata: { full_name: 'Phone Test', phone },
    });

    const after = await (await fetch(`${API}/api/auth/check-phone?phone=${encodeURIComponent(phone)}`)).json();
    assert.equal(after.exists, true);

    await deleteTestUser(user.user.id);
  });

  test('check-phone requires the phone query parameter', async () => {
    const res = await fetch(`${API}/api/auth/check-phone`);
    assert.equal(res.status, 400);
  });
});

// ── ENROLMENTS ──
describe('enrolments', () => {
  test('rejects a submission missing required fields', async () => {
    const res = await fetch(`${API}/api/enrolments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseSlug: 'excel' }),
    });
    assert.equal(res.status, 400);
  });

  test('rejects an invalid category/mode/level', async () => {
    const base = {
      courseSlug: 'excel', firstName: 'A', lastName: 'B',
      email: 'a@example.org', phone: '+250700000000',
      category: 'Individual', mode: 'Online', level: 'Complete Beginner',
    };
    for (const bad of [{ category: 'Not A Real Category' }, { mode: 'Carrier Pigeon' }, { level: 'Wizard' }]) {
      const res = await fetch(`${API}/api/enrolments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...base, ...bad }),
      });
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(bad)}`);
    }
  });

  test('blocks a second active Online enrolment until the first reaches 100%, then allows it', async () => {
    const user = await createTestUser();
    const { data: mod } = await serverSupabase.from('course_modules').insert({
      course_slug: 'python', title: 'Test Module', order_index: 999,
    }).select().single();
    const { data: lesson } = await serverSupabase.from('lessons').insert({
      module_id: mod.id, title: 'Test Lesson', type: 'document', order_index: 1, content_body: 'x',
    }).select().single();

    const enrol = (courseSlug, mode) => fetch(`${API}/api/enrolments`, {
      method: 'POST', headers: { ...user.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseSlug, firstName: 'A', lastName: 'B', email: user.email, phone: '+250700000000',
        category: 'Individual', mode, level: 'Complete Beginner',
      }),
    });

    const first = await enrol('python', 'Online');
    assert.equal(first.status, 201);
    const firstData = await first.json();

    const second = await enrol('excel', 'Online');
    assert.equal(second.status, 400, 'a second incomplete online enrolment should be blocked');

    // The learning platform only unlocks once an admin confirms the
    // enrolment (verifyOnlineEnrolment checks status, not just mode)
    // — simulate that admin action before interacting with lessons.
    await serverSupabase.from('enrolments').update({ status: 'confirmed' }).eq('id', firstData.id);

    const completeRes = await fetch(`${API}/api/enrolments/${firstData.id}/lessons/${lesson.id}/complete`, {
      method: 'POST', headers: user.authHeader,
    });
    if (!completeRes.ok) console.log('DEBUG complete failed:', completeRes.status, await completeRes.text());

    const third = await enrol('excel', 'Online');
    if (third.status !== 201) console.log('DEBUG third enrol failed:', third.status, await third.clone().text());
    assert.equal(third.status, 201, 'should be allowed once the first course hits 100%');

    await serverSupabase.from('course_modules').delete().eq('id', mod.id);
    await serverSupabase.from('enrolments').delete().eq('user_id', user.userId);
    await deleteTestUser(user.userId);
  });

  test('stopping an incomplete Online enrolment unblocks a new one immediately', async () => {
    const user = await createTestUser();

    const enrol = (courseSlug) => fetch(`${API}/api/enrolments`, {
      method: 'POST', headers: { ...user.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseSlug, firstName: 'A', lastName: 'B', email: user.email, phone: '+250700000000',
        category: 'Individual', mode: 'Online', level: 'Complete Beginner',
      }),
    });

    const first = await enrol('python');
    assert.equal(first.status, 201);
    const firstData = await first.json();

    const blocked = await enrol('excel');
    assert.equal(blocked.status, 400, 'a second incomplete online enrolment should be blocked');

    const cancelRes = await fetch(`${API}/api/enrolments/${firstData.id}/cancel`, {
      method: 'POST', headers: { ...user.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(cancelRes.status, 200);

    const afterCancel = await enrol('excel');
    assert.equal(afterCancel.status, 201, 'cancelling the incomplete course should unblock a new one');

    await serverSupabase.from('enrolments').delete().eq('user_id', user.userId);
    await deleteTestUser(user.userId);
  });

  test('blocks a duplicate In-Person application for the same course, unblocks after cancellation', async () => {
    const user = await createTestUser();
    const { data: workshop } = await serverSupabase.from('workshops').insert({
      course_slug: 'nvivo', venue: 'Test Venue', start_date: '2027-01-01',
      trainer_name: 'Test Trainer', fee: '$100',
    }).select().single();

    const apply = () => fetch(`${API}/api/enrolments`, {
      method: 'POST', headers: { ...user.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseSlug: 'nvivo', firstName: 'A', lastName: 'B', email: user.email, phone: '+250700000000',
        category: 'Individual', mode: 'In-Person', level: 'Complete Beginner', workshopId: workshop.id,
      }),
    });

    const first = await apply();
    assert.equal(first.status, 201);
    const firstData = await first.json();

    const second = await apply();
    assert.equal(second.status, 409);
    const secondData = await second.json();
    assert.equal(secondData.existingEnrolmentId, firstData.id);

    await serverSupabase.from('enrolments').update({ status: 'cancelled' }).eq('id', firstData.id);

    const third = await apply();
    assert.equal(third.status, 201, 'should be allowed again after the prior application was cancelled');

    await serverSupabase.from('workshops').delete().eq('id', workshop.id);
    await serverSupabase.from('enrolments').delete().eq('user_id', user.userId);
    await deleteTestUser(user.userId);
  });

  test('a user can stop their own enrolment, with an optional reason, but not someone else\'s', async () => {
    const user = await createTestUser();
    const { data: enrolment } = await serverSupabase.from('enrolments').insert({
      user_id: user.userId, course_slug: 'excel', first_name: 'A', last_name: 'B',
      email: user.email, phone: '+250700000000', category: 'Individual',
      mode: 'Online', level: 'Complete Beginner',
    }).select().single();

    const cancelRes = await fetch(`${API}/api/enrolments/${enrolment.id}/cancel`, {
      method: 'POST', headers: { ...user.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Changed my mind' }),
    });
    const cancelData = await cancelRes.json();
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelData.status, 'cancelled');
    assert.equal(cancelData.cancellation_reason, 'Changed my mind');
    assert.ok(cancelData.cancelled_at);

    const repeatRes = await fetch(`${API}/api/enrolments/${enrolment.id}/cancel`, {
      method: 'POST', headers: { ...user.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(repeatRes.status, 400, 'cancelling an already-cancelled enrolment should be rejected');

    const { data: enrolment2 } = await serverSupabase.from('enrolments').insert({
      user_id: user.userId, course_slug: 'stata', first_name: 'A', last_name: 'B',
      email: user.email, phone: '+250700000000', category: 'Individual',
      mode: 'Online', level: 'Complete Beginner',
    }).select().single();
    const otherUser = await createTestUser();
    const unauthorizedRes = await fetch(`${API}/api/enrolments/${enrolment2.id}/cancel`, {
      method: 'POST', headers: { ...otherUser.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(unauthorizedRes.status, 404, 'another user should not be able to cancel this enrolment');

    await serverSupabase.from('enrolments').delete().eq('user_id', user.userId);
    await deleteTestUser(user.userId);
    await deleteTestUser(otherUser.userId);
  });
});

// ── LEARNING PLATFORM ──
describe('learning platform', () => {
  let user, mod, docLesson, quizLesson, q1, q1Options, q2, q2Options, enrolmentId;

  before(async () => {
    user = await createTestUser();

    const { data: m } = await serverSupabase.from('course_modules').insert({
      course_slug: 'stata', title: 'Test Module', order_index: 999,
    }).select().single();
    mod = m;

    const { data: doc } = await serverSupabase.from('lessons').insert({
      module_id: mod.id, title: 'Reading', type: 'document', order_index: 1, content_body: 'hello',
    }).select().single();
    docLesson = doc;

    const { data: quiz } = await serverSupabase.from('lessons').insert({
      module_id: mod.id, title: 'Quiz', type: 'exercise', order_index: 2, pass_threshold: 50,
    }).select().single();
    quizLesson = quiz;

    const { data: question1 } = await serverSupabase.from('quiz_questions').insert({
      lesson_id: quizLesson.id, question_text: 'Q1', order_index: 1,
    }).select().single();
    q1 = question1;
    const { data: opts1 } = await serverSupabase.from('quiz_options').insert([
      { question_id: q1.id, option_text: 'Right', is_correct: true, order_index: 1 },
      { question_id: q1.id, option_text: 'Wrong', is_correct: false, order_index: 2 },
    ]).select();
    q1Options = opts1;

    const { data: question2 } = await serverSupabase.from('quiz_questions').insert({
      lesson_id: quizLesson.id, question_text: 'Q2', order_index: 2,
    }).select().single();
    q2 = question2;
    const { data: opts2 } = await serverSupabase.from('quiz_options').insert([
      { question_id: q2.id, option_text: 'Right', is_correct: true, order_index: 1 },
      { question_id: q2.id, option_text: 'Wrong', is_correct: false, order_index: 2 },
    ]).select();
    q2Options = opts2;

    const { data: enrolment } = await serverSupabase.from('enrolments').insert({
      user_id: user.userId, course_slug: 'stata', first_name: 'A', last_name: 'B',
      email: user.email, phone: '+250700000000', category: 'Individual',
      mode: 'Online', level: 'Complete Beginner', status: 'pending',
    }).select().single();
    enrolmentId = enrolment.id;
  });

  after(async () => {
    await serverSupabase.from('course_modules').delete().eq('id', mod.id); // cascades lessons/questions/options
    await serverSupabase.from('enrolments').delete().eq('id', enrolmentId);
    await deleteTestUser(user.userId);
  });

  test('a pending (not yet Confirmed) enrolment cannot access the learning platform', async () => {
    const res = await fetch(`${API}/api/enrolments/${enrolmentId}/curriculum`, { headers: user.authHeader });
    assert.equal(res.status, 403);
  });

  test('curriculum, lesson content, and progress work correctly once confirmed', async () => {
    await serverSupabase.from('enrolments').update({ status: 'confirmed' }).eq('id', enrolmentId);

    const curriculum = await (await fetch(`${API}/api/enrolments/${enrolmentId}/curriculum`, { headers: user.authHeader })).json();
    assert.equal(curriculum.totalLessons, 2);
    assert.equal(curriculum.overallPercent, 0);

    await fetch(`${API}/api/enrolments/${enrolmentId}/lessons/${docLesson.id}/complete`, {
      method: 'POST', headers: user.authHeader,
    });

    const after1 = await (await fetch(`${API}/api/enrolments/${enrolmentId}/curriculum`, { headers: user.authHeader })).json();
    assert.equal(after1.overallPercent, 50);
  });

  test('viewing a lesson is remembered so the curriculum can offer to resume it', async () => {
    const beforeAny = await (await fetch(`${API}/api/enrolments/${enrolmentId}/curriculum`, { headers: user.authHeader })).json();
    assert.equal(beforeAny.lastLesson, null, 'no lesson viewed yet for a fresh enrolment');

    await fetch(`${API}/api/enrolments/${enrolmentId}/lessons/${docLesson.id}`, { headers: user.authHeader });
    const afterDoc = await (await fetch(`${API}/api/enrolments/${enrolmentId}/curriculum`, { headers: user.authHeader })).json();
    assert.equal(afterDoc.lastLesson.id, docLesson.id);

    await fetch(`${API}/api/enrolments/${enrolmentId}/lessons/${quizLesson.id}`, { headers: user.authHeader });
    const afterQuiz = await (await fetch(`${API}/api/enrolments/${enrolmentId}/curriculum`, { headers: user.authHeader })).json();
    assert.equal(afterQuiz.lastLesson.id, quizLesson.id, 'viewing a later lesson should move the resume pointer');
  });

  test("a video lesson's playback position is saved and returned so it can resume", async () => {
    const { data: videoMod } = await serverSupabase.from('course_modules').insert({
      course_slug: 'stata', title: 'Video Module', order_index: 998,
    }).select().single();
    const { data: videoLesson } = await serverSupabase.from('lessons').insert({
      module_id: videoMod.id, title: 'Intro Video', type: 'video', order_index: 1,
      content_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    }).select().single();

    try {
      const before = await (await fetch(`${API}/api/enrolments/${enrolmentId}/lessons/${videoLesson.id}`, { headers: user.authHeader })).json();
      assert.equal(before.videoPosition, 0);

      const saveRes = await fetch(`${API}/api/enrolments/${enrolmentId}/lessons/${videoLesson.id}/video-position`, {
        method: 'POST', headers: { ...user.authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: 42.5 }),
      });
      assert.equal(saveRes.status, 204);

      const after = await (await fetch(`${API}/api/enrolments/${enrolmentId}/lessons/${videoLesson.id}`, { headers: user.authHeader })).json();
      assert.equal(after.videoPosition, 42.5);

      const badRes = await fetch(`${API}/api/enrolments/${enrolmentId}/lessons/${docLesson.id}/video-position`, {
        method: 'POST', headers: { ...user.authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: 10 }),
      });
      assert.equal(badRes.status, 400, 'non-video lessons should reject position saves');
    } finally {
      await serverSupabase.from('course_modules').delete().eq('id', videoMod.id);
    }
  });

  test('quiz questions never include the correct answer before submission', async () => {
    const lesson = await (await fetch(`${API}/api/enrolments/${enrolmentId}/lessons/${quizLesson.id}`, { headers: user.authHeader })).json();
    const raw = JSON.stringify(lesson);
    assert.ok(!raw.includes('is_correct') && !raw.includes('isCorrect'), 'answer key leaked to the client');
  });

  test('quiz grading is correct and happens server-side', async () => {
    const res = await fetch(`${API}/api/enrolments/${enrolmentId}/lessons/${quizLesson.id}/submit-quiz`, {
      method: 'POST', headers: { ...user.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: [
          { questionId: q1.id, optionId: q1Options.find(o => o.is_correct).id },
          { questionId: q2.id, optionId: q2Options.find(o => !o.is_correct).id },
        ],
      }),
    });
    const result = await res.json();
    assert.equal(result.score, 50);
    assert.equal(result.passed, true, 'threshold is 50, a 50% score should pass');
  });

  test("another user cannot access this enrolment's curriculum", async () => {
    const otherUser = await createTestUser();
    const res = await fetch(`${API}/api/enrolments/${enrolmentId}/curriculum`, { headers: otherUser.authHeader });
    assert.equal(res.status, 404);
    await deleteTestUser(otherUser.userId);
  });
});