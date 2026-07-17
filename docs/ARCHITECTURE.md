# ResearchBridge Consulting — Architecture & Structure

This document explains how the whole system fits together: the static
frontend, the Express API, the Supabase database, authentication, and
the email system. It's meant to get a new coworker from zero to
productive without having to reverse-engineer the code first.

For a quick local setup, see the root [README.md](../README.md).

---

## 1. What this is

ResearchBridge Consulting's website. It's two things bolted together:

1. A **marketing/services site** — homepage, service pages (thesis
   editing, data analysis, research design, capacity building), and 8
   course pages (Excel, Python, Stata, SPSS, R, NVivo, Power BI,
   KoBoToolbox).
2. A **course platform** — visitors can create an account, enrol in a
   course either **Online** (self-paced, with an in-browser learning
   platform) or **In-Person** (tied to a scheduled workshop with a
   venue/date/trainer/fee), track progress, and admins manage
   everything (enrolment status, workshops, course content) directly
   through the Supabase Table Editor — there is no admin UI in the
   app itself yet.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Frontend | Plain HTML/CSS/JavaScript. No framework, no build step, no bundler. |
| Backend | Node.js + Express (`server/`) |
| Database | PostgreSQL, hosted on Supabase |
| Auth | Supabase Auth (email + password, email confirmation required) |
| File storage | Supabase Storage (private bucket, signed URLs) |
| Transactional email | Resend |

**Why this split:** the frontend never talks to Postgres directly.
It talks to Supabase Auth directly (that's the standard, secure
pattern — the `anon` key is meant to be public), but all other data
(enrolments, courses, workshops, progress) goes through the Express
API, which uses Supabase's `service_role` key — a privileged key that
must never reach the browser. This is why there are two different
Supabase keys in this project; see [§7](#7-authentication--authorization).

---

## 3. Repository structure

```
researchbridge/
├── index.html                  Homepage
├── css/
│   ├── style.css                Shared site-wide styles (navbar, footer,
│   │                             buttons, hero, home page sections — see
│   │                             its own table of contents at the top)
│   ├── course-page.css          Styles specific to the 8 course pages
│   └── service-page.css         Styles specific to the 4 service pages
├── js/
│   └── main.js                  Loaded on every page. Bootstraps the
│                                 Supabase client, drives the navbar's
│                                 logged-in/out state, scroll effects,
│                                 mobile nav, cookie banner, search, etc.
├── images/, videos/              Static assets
├── pages/
│   ├── login.html, signup.html   Auth pages
│   ├── dashboard.html            Logged-in user's home — enrolments,
│   │                             profile, learning progress
│   ├── enrol.html                The enrolment form (Online/In-Person)
│   ├── enrolment-detail.html     In-Person enrolment detail (venue, date,
│   │                             trainer, fee, Payment/Participation tabs)
│   ├── learn.html                The online learning platform (sidebar,
│   │                             lesson viewer, quizzes, progress ring)
│   ├── thesis-editing.html, data-analysis.html,
│   │   research-design.html, Capacity-building.html
│   │                             Service pages
│   └── courses/
│       └── excel.html, python.html, stata.html, spss.html,
│           R.html, nvivo.html, powerbi.html, kobo.html
│                                 One page per course
├── server/                       Express API (see §5)
│   ├── src/
│   │   ├── index.js              App entry point — mounts all routes
│   │   ├── config/supabaseClient.js   Server-side Supabase client (service_role)
│   │   ├── middleware/           requireAuth, optionalAuth, verifyOnlineEnrolment
│   │   ├── routes/               One file per resource (see §5.2)
│   │   └── lib/                  Shared helpers (email templates, progress
│   │                             calculation, course name lookup)
│   ├── .env.example              Template for required environment variables
│   └── .env                      Real secrets — gitignored, never commit
└── supabase/
    └── migrations/                Every schema change, in order (see §6)
```

---

## 4. Frontend architecture

### No build step
Every page is a plain `.html` file with inline `<script>` blocks for
page-specific logic, plus `<script src="../js/main.js">` for shared
behavior. There's no React/Vue, no npm build for the frontend, no
bundler. To run it locally, you just need a static file server (VS
Code's **Live Server** extension is what's been used throughout
development — see the README for why that matters).

### `js/main.js` — loaded on every page
This one file does a lot of shared work:
- **Bootstraps the Supabase client** (`window.rbcSupabaseReady`, a
  Promise) by loading the Supabase JS SDK from a CDN and creating a
  client with the public `anon` key. Every page's inline scripts
  `await window.rbcSupabaseReady` before touching Supabase.
- **Defines `window.rbcApiBaseUrl`** — the Express API's base URL.
  This is the one line to change when the backend gets deployed
  (currently hardcoded to `http://localhost:4000`).
- **Drives the navbar's auth state** (logged-in vs logged-out) from
  the real Supabase session, not a fake localStorage flag.
- Fires a **welcome email** the first time a `SIGNED_IN` auth event
  happens (password login, or landing back on the site via an email
  confirmation link).
- On **logout**, checks the user's in-progress online courses and
  sends a motivational email for anything below 100% before actually
  signing out.
- Also handles: scroll-reveal animations, the mobile hamburger menu,
  nav dropdowns, the site search, the cookie consent banner, and the
  "back to top" button.

### Course pages
All 8 course pages (`pages/courses/*.html`) follow an identical
structure: hero (with an "Enrol Now" CTA), sticky section nav,
overview, instructor, outcomes, applications, video, testimonials,
outline, FAQ, related courses, footer. (There's no pricing section —
it was removed rather than shipped with placeholder "$XX" numbers;
add one back once real prices exist.) If you're editing one
course page's structure, the same edit almost always needs to be
mirrored across all 8 — they were built from a shared template, not a
shared component (no build step, remember).

### The enrolment flow
`pages/enrol.html` is one form for both modes:
- **Online** — no extra fields.
- **In-Person** — reveals a "Workshop Date" dropdown, populated by
  `GET /api/workshops?course=<slug>` (only real, upcoming workshops
  for that course).

It reads `?course=`, `?mode=`, and `?workshop=` query params to
pre-fill itself — this is how the homepage's "Apply for Training" CTA
drops a visitor straight into a ready-to-submit form.

### The dashboard
`pages/dashboard.html` shows the logged-in user's enrolments as
cards. The routing per card depends on `mode` and `status`:

| Mode | Status | Card behavior |
|---|---|---|
| Online | `confirmed` | Links to `learn.html?enrolment=<id>` |
| Online | `pending` | Not clickable — "unlocks once confirmed" note |
| In-Person | any (not cancelled) | Links to `enrolment-detail.html?id=<id>` |
| any | `cancelled` | **Not shown at all** — filtered out of stats, cards, and activity |

### The learning platform
`pages/learn.html` — left sidebar (modules → lessons, with ✓ for
completed), a center panel that renders whatever's selected (embedded
video, document/PDF link, or an interactive quiz), and an animated
SVG progress ring in the header showing percent complete. All of this
data comes from `GET /api/enrolments/:id/curriculum` and
`GET /api/enrolments/:id/lessons/:id` — see §5.2 and §6 for how
course content is structured and added.

---

## 5. Backend architecture (`server/`)

### 5.1 Running it
```
cd server
npm install        # first time only
node src/index.js  # or: npm run dev  (auto-restarts on file changes)
```
Needs `server/.env` (copy from `.env.example`) with real Supabase and
Resend credentials. See §8 for the full variable list.

### 5.2 Route reference

All routes are mounted under `/api`. Auth column: **public** (no
token needed), **optional** (works either way, links to a user if
logged in), or **required** (`requireAuth` middleware — rejects with
401 if there's no valid Supabase session token).

| Method & Path | Auth | Purpose |
|---|---|---|
| `GET /api/health` | public | Confirms the server is up *and* can query the DB |
| `GET /api/health/whoami` | required | Debug route — echoes back the authenticated user |
| `POST /api/enrolments` | optional | Submit an enrolment. Validates category/mode/level, blocks a 2nd active Online enrolment, blocks a duplicate In-Person application for the same course, validates the chosen workshop, sends a confirmation email |
| `GET /api/enrolments/me` | required | The caller's own enrolments, with workshop details and online progress % attached |
| `GET /api/enrolments/:id` | required | One enrolment's full detail (ownership-checked) |
| `GET /api/enrolments/:id/curriculum` | required | Modules + lessons + per-lesson completion + overall % for an Online, **Confirmed** enrolment |
| `GET /api/enrolments/:id/lessons/:lessonId` | required | Full lesson content; quiz questions come back **without** correct answers |
| `POST /api/enrolments/:id/lessons/:lessonId/complete` | required | Marks a document/video lesson done |
| `POST /api/enrolments/:id/lessons/:lessonId/submit-quiz` | required | Grades a quiz **server-side**, returns score + per-question feedback |
| `POST /api/contact` | public | The homepage contact form |
| `GET /api/workshops?course=<slug>` | public | Upcoming workshops for one course (the enrolment form's date picker) |
| `GET /api/workshops/next` | public | The single soonest upcoming workshop, across all courses (homepage widget) |
| `GET /api/auth/check-phone?phone=<phone>` | public | Used by signup to reject a duplicate phone number before creating the account |
| `POST /api/notifications/welcome` | required | Idempotent — sends the welcome email once per account |
| `POST /api/notifications/check-progress` | required | Emails a motivational nudge for every Confirmed-but-incomplete Online enrolment |

### 5.3 Middleware (`server/src/middleware/`)
- **`requireAuth.js`** — reads the `Authorization: Bearer <token>`
  header, verifies it via `supabase.auth.getUser(token)` (this asks
  Supabase's own Auth server to validate it — no manual JWT
  signature-checking needed), attaches `req.user`.
- **`optionalAuth.js`** — same idea, but never rejects the request if
  there's no/invalid token; just leaves `req.user` unset. Used on
  routes guests are allowed to hit (submitting an enrolment).
- **`verifyOnlineEnrolment.js`** — guards every learning-platform
  route. Checks the enrolment belongs to the caller, is `mode =
  'Online'`, **and** `status = 'confirmed'`. This is enforced
  server-side, not just hidden in the dashboard UI — hitting the API
  directly with a pending enrolment's ID still gets rejected (403).

### 5.4 Shared libs (`server/src/lib/`)
- **`enrolmentProgress.js`** — the one place "what % complete is this
  enrolment" is calculated (lessons completed ÷ total lessons for
  that course). Used by the curriculum route, the dashboard's
  progress bar, the "block a 2nd online course" check, and the
  motivational-email check — so they can never disagree with each
  other.
- **`email.js`** — wraps Resend, defines the 3 email templates
  (welcome, enrolment confirmation, motivational). Failures are
  logged, never thrown — a broken email should never block the
  actual action (signup, enrolment) that triggered it.
- **`courseNames.js`** — slug → display name lookup, used for email
  content (the frontend has its own copy of this map for rendering;
  see the note in §9).

### 5.5 Testing (`server/test/`)
Integration tests using Node's built-in test runner (`node:test` —
no extra dependency). Run with `npm test` from `server/`.

They're genuine integration tests, not mocked unit tests: `npm test`
spawns the actual Express app as a child process (on port 4099, so it
doesn't collide with a dev server on 4000) and hits it with real HTTP
requests against your real Supabase project. Each test creates its
own throwaway users/enrolments/content with unique emails and deletes
them afterward — they never touch real data, but they do require
`server/.env` to point at a working Supabase project.

Rate limiting (§9 in the code, not this doc — see
`middleware/rateLimiters.js`) is skipped when `NODE_ENV=test`, which
the test file sets automatically on the spawned server. Without this,
the test suite's own rapid sequential requests would trip the same
limits meant to catch a spamming bot.

Current coverage: phone-duplicate checking, enrolment validation
(missing fields, invalid enum values), the one-active-online-course
rule, duplicate in-person application blocking, the confirmed-status
gate on the learning platform, quiz grading correctness, answer-leak
prevention, and cross-user access isolation. Not covered yet: contact
messages, workshops endpoints, email sending itself (the `email.js`
send calls are not asserted against — Resend delivery was verified
manually, see the "Email system" section below).

---

## 6. Database schema (Supabase Postgres)

Every change is a tracked migration in `supabase/migrations/`,
applied in filename (timestamp) order. **Never edit an already-applied
migration** — write a new one.

| Migration | What it did |
|---|---|
| `20260703092622_init_schema.sql` | Core tables: `profiles`, `enrolments`, `contact_messages`. RLS enabled with no client-facing policies (only `service_role`, i.e. the Express backend, touches these). |
| `20260703121437_grant_service_role_privileges.sql` | Fixed a real gap: enabling RLS doesn't itself grant table access — `service_role` needed explicit `GRANT`s too. |
| `20260703142404_add_workshops_and_simplify_mode.sql` | Added `workshops` table. Simplified `enrolments.mode` from 3 options to 2 (`Online` / `In-Person`). Added `enrolments.workshop_id`. |
| `20260703152007_add_learning_platform.sql` | Added `course_modules`, `lessons`, `quiz_questions`, `quiz_options`, `lesson_progress`. |
| `20260703175243_add_welcome_email_tracking.sql` | Added `profiles.welcome_email_sent_at` (idempotency for the welcome email). |

### Table reference

**`profiles`** — one row per Supabase Auth user (extends `auth.users`,
which Supabase manages itself and which holds the actual email/password).
| column | notes |
|---|---|
| `id` | = `auth.users.id` |
| `full_name`, `phone` | from the signup form |
| `welcome_email_sent_at` | null until the welcome email has been sent once |

A trigger (`handle_new_user`) auto-creates this row whenever someone
signs up, reading `full_name`/`phone` from the signup call's metadata.

**`enrolments`** — every enrolment, online or in-person, guest or logged-in.
| column | notes |
|---|---|
| `user_id` | nullable — guests can enrol without an account |
| `course_slug` | matches a course page's filename (`excel`, `python`, …) |
| `mode` | `Online` or `In-Person` |
| `workshop_id` | set only for In-Person, links to `workshops` |
| `status` | `pending` (default) / `confirmed` / `cancelled` — **admin sets this manually in the Table Editor** |

**`workshops`** — admin-managed list of scheduled in-person sessions.
| column | notes |
|---|---|
| `course_slug`, `venue`, `start_date`, `trainer_name`, `fee` | shown on the homepage widget and the enrolment form |
| `status` | `upcoming` (default) / `closed` — set to `closed` to stop it appearing as a bookable date without deleting history |

**`contact_messages`** — the homepage contact form. `status`:
`new` / `read` / `responded`, for your own triage in the Table Editor.

**`course_modules`** → **`lessons`** → **`quiz_questions`** →
**`quiz_options`** — the learning platform's content, admin-managed.
- A `lessons.type` is one of `document`, `video`, `exercise`, `exam`.
- `content_url`: for `video`, an embeddable URL (e.g. YouTube
  `/embed/...`); for `document`, either a full `http...` link **or** a
  path inside the private `course-materials` Storage bucket (resolved
  server-side to a short-lived signed URL — see §5.2's lesson route).
- `exercise`/`exam` lessons have no content of their own — their
  questions live in `quiz_questions`/`quiz_options`, single-correct-
  answer multiple choice, graded server-side.

**`lesson_progress`** — one row per (user, enrolment, lesson).
`completed` drives the progress ring; `quiz_score`/`quiz_passed` are
tracked separately for exercises/exams (a quiz counts as "complete"
once submitted, regardless of pass/fail — the ring measures coverage,
not mastery).

### Access model
RLS is enabled everywhere with **no policies for `anon`/`authenticated`**.
The frontend never queries these tables directly — only the Express
backend, using the `service_role` key, can read/write them. This is a
deliberate choice: it means every access rule (ownership checks,
status gates, validation) lives in one place — the API — instead of
being split between RLS policies and application code.

---

## 7. Authentication & authorization

- **Signup/login happen frontend → Supabase Auth directly** (not
  through the Express API). This is the standard, secure pattern.
- **Email confirmation is required.** Signing up sends a confirmation
  email (sent by Supabase itself, not Resend). Login is blocked with
  a clear "please confirm your email" message until it's clicked.
- Clicking the confirmation link redirects to `emailRedirectTo`
  (set dynamically to `window.location.origin + '/index.html'` in
  `signup.html` — works in local dev and after deployment without
  hardcoding a URL) with the session embedded in the URL; the
  Supabase JS SDK auto-detects and establishes it, so the visitor is
  logged in immediately, no separate manual login required.
- **Two different Supabase keys, two different trust levels:**
  - `anon` key — public, safe to embed in frontend code (it's in
    `js/main.js`, plain to read). Protected by RLS, not secrecy.
  - `service_role` key — lives only in `server/.env`. Bypasses RLS
    entirely. Never sent to the browser. If this leaks, treat it as a
    full database compromise.
- **Passwords are never touched by the Express backend at all** —
  Supabase Auth handles storage/hashing entirely.

---

## 8. Environment variables (`server/.env`)

See `server/.env.example` for the authoritative template. Summary:

| Variable | Where it comes from |
|---|---|
| `PORT` | Just a local port choice, default 4000 |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API |
| `CORS_ORIGIN` | Whatever origin(s) the frontend is served from — comma-separated |
| `RESEND_API_KEY` | resend.com → API Keys |
| `EMAIL_FROM` | A sender address. Sandbox default (`onboarding@resend.dev`) only delivers to your own Resend account email — see §9 |

---

## 9. Email system (Resend)

Three custom emails, all defined in `server/src/lib/email.js`:

| Email | Triggered by |
|---|---|
| Welcome | First `SIGNED_IN` auth event (see `js/main.js`) → `POST /api/notifications/welcome` |
| Enrolment confirmation | Every successful `POST /api/enrolments`, with course/mode/category/level (+ venue/date/trainer/fee if In-Person) |
| Motivational nudge | Clicking "Log Out" while any Online + Confirmed enrolment is below 100% |

**Current limitation:** without a verified sending domain on Resend,
delivery is restricted to the email address the Resend account itself
was signed up with. Verifying a domain requires actually owning one
(DNS-level proof) — this is bundled with the future deployment step,
since the site will need a real domain for its URL at that point too.

**Known duplication:** the course slug → display name map
(`{ excel: 'Excel for Professionals', ... }`) is defined in *five*
places — `server/src/lib/courseNames.js`, and inline in each of
`enrol.html`, `dashboard.html`, `learn.html`, and
`enrolment-detail.html`. This is a consequence of having no frontend
build step (no shared-module imports across static HTML files). If
you add a 9th course, all five need updating.

---

## 10. What's not built yet

- **Deployment.** Everything currently runs locally (Express on
  `localhost:4000`, frontend via Live Server on port 5500). No
  hosting has been set up for either.
- **A real admin UI.** All admin actions (confirming/cancelling
  enrolments, adding workshops, adding course content) happen by hand
  in the Supabase Table Editor. Works, but not built for non-technical
  staff.
- **Payment integration.** `enrolment-detail.html`'s "Payment Details"
  tab is a placeholder.
- **Participation confirmation** tab — also a placeholder.
- **Real course pricing.** Removed the placeholder "$XX" pricing
  section from all 8 course pages rather than ship fake numbers —
  add it back once real prices exist.
- **Exhaustive test coverage.** `server/test/` covers the highest-risk
  business logic (see §5.5) but isn't exhaustive — e.g. contact
  messages and the workshops endpoints have no tests yet.
- **Resend domain verification** — see §9.
