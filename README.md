# ResearchBridge Consulting

Website + course platform for ResearchBridge Consulting: marketing
pages, service pages, 8 course pages, user accounts, course
enrolment (online self-paced or in-person workshops), an in-browser
learning platform with progress tracking and quizzes, and
transactional email.

**For the full picture of how everything fits together — pages,
API routes, database schema, auth, email — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).** This file is just
enough to get it running locally.

## Stack

Static HTML/CSS/JS frontend (no build step) + Node/Express API +
Supabase (Postgres, Auth, Storage) + Resend (email).

## Running it locally

You need **two things running at once**: the static frontend and the
Express API.

### 1. Frontend
Serve the repo root with any static file server — during development
this has been **VS Code's Live Server extension** on port 5500. Plain
`file://` won't work; the API calls need a real HTTP origin for CORS.

### 2. Backend
```
cd server
npm install
cp .env.example .env      # then fill in real values, see below
node src/index.js
```
Confirm it's up:
```
curl http://localhost:4000/api/health
# {"status":"ok","db":"connected"}
```

### Environment variables
Copy `server/.env.example` to `server/.env` and fill in:
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Project Settings → API. **Never commit this file** — the service_role key bypasses all database security.
- `CORS_ORIGIN` — must match wherever the frontend is actually being served from (e.g. `http://127.0.0.1:5500,http://localhost:5500` for Live Server).
- `RESEND_API_KEY` / `EMAIL_FROM` — resend.com → API Keys. Without these set, emails are skipped (logged, not sent) rather than failing.

### Database
Schema lives in `supabase/migrations/`, applied in order via the
Supabase SQL Editor (paste each file's contents and run — this has
been the reliable path; the Supabase CLI's `db push` had issues in
this project's setup). If you're setting up a fresh Supabase project,
run every migration in `supabase/migrations/` in filename order.

### Running the tests
```
cd server
npm test
```
This spawns its own copy of the server (a different port than your
dev server, so it's safe to run alongside it) and runs real requests
against your Supabase project, using throwaway test data it cleans up
afterward. Needs `server/.env` filled in first. See
[docs/ARCHITECTURE.md §5.5](docs/ARCHITECTURE.md#55-testing-servertest)
for what's covered.

## Admin tasks

There's no admin UI yet — day-to-day admin work happens directly in
the Supabase **Table Editor**:
- Confirm/cancel an enrolment → `enrolments.status`
- Add a workshop date → `workshops` table
- Add course content (videos, readings, quizzes) → `course_modules` /
  `lessons` / `quiz_questions` / `quiz_options`

Full details on each in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
