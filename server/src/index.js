import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { enrolmentsRouter } from './routes/enrolments.js';
import { contactRouter } from './routes/contact.js';
import { workshopsRouter } from './routes/workshops.js';
import { learningRouter } from './routes/learning.js';
import { notificationsRouter } from './routes/notifications.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { generalLimiter } from './middleware/rateLimiters.js';

// Fail loudly rather than silently falling back to a wildcard ('*')
// CORS policy if this gets forgotten during deployment — an open
// CORS policy on an API that reads/writes user data is a real risk,
// not something that should happen by accident.
if (!process.env.CORS_ORIGIN) {
  console.error(
    'FATAL: CORS_ORIGIN is not set in server/.env. Set it to the exact ' +
    'origin(s) allowed to call this API (comma-separated) — refusing to ' +
    'start with an open CORS policy.'
  );
  process.exit(1);
}

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN.split(',') }));
app.use(express.json());
app.use('/api', generalLimiter);

app.use('/api/health', healthRouter);
app.use('/api/enrolments', enrolmentsRouter);
app.use('/api/enrolments', learningRouter);
app.use('/api/contact', contactRouter);
app.use('/api/workshops', workshopsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`ResearchBridge API listening on http://localhost:${port}`);
});