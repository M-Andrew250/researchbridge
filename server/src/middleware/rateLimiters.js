import rateLimit from 'express-rate-limit';

// The automated test suite fires many legitimate requests in rapid
// succession from a single IP — that's exactly what these limiters
// are designed to catch, so it needs an explicit opt-out rather than
// a real bypass a production caller could trigger.
const isTest = process.env.NODE_ENV === 'test';
const skip = () => isTest;

// Applied globally to every /api route as a baseline — generous
// enough that no legitimate user session hits it.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many requests. Please try again later.' },
});

// Applied to the public write endpoints a bot could spam without
// ever needing an account: submitting enrolments/contact messages,
// and probing which phone numbers are registered.
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: 'Too many requests. Please try again later.' },
});