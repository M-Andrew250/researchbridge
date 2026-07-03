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

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/enrolments', enrolmentsRouter);
app.use('/api/enrolments', learningRouter);
app.use('/api/contact', contactRouter);
app.use('/api/workshops', workshopsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/auth', authRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`ResearchBridge API listening on http://localhost:${port}`);
});