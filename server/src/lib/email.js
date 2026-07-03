import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || 'ResearchBridge Consulting <onboarding@resend.dev>';

// Shared wrapper so every call site handles a missing/misconfigured
// API key or a delivery failure the same way: log it, never throw.
// Email is a nice-to-have on top of an already-successful action
// (signup, enrolment) — it should never be the reason that action
// fails for the user.
async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipped "${subject}" to ${to}`);
    return;
  }
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
  } catch (err) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, err.message);
  }
}

const brandHeader = `
  <div style="background:#0A1F44; padding:24px 32px;">
    <span style="font-family:Georgia,serif; font-size:20px; font-weight:700; color:#ffffff;">
      Research<span style="color:#3B9EE8;">Bridge</span> Consulting
    </span>
  </div>
`;

const brandFooter = `
  <div style="padding:24px 32px; color:#5A6A85; font-size:12px; border-top:1px solid #C8D9EF;">
    ResearchBridge Consulting · Kigali, Rwanda<br/>
    <a href="mailto:info@researchbridgeconsulting.com" style="color:#1E5EBC;">info@researchbridgeconsulting.com</a>
  </div>
`;

function wrap(bodyHtml) {
  return `
    <div style="font-family:Arial,sans-serif; max-width:560px; margin:0 auto; border:1px solid #C8D9EF; border-radius:12px; overflow:hidden;">
      ${brandHeader}
      <div style="padding:32px; color:#1A1A2E; line-height:1.6;">
        ${bodyHtml}
      </div>
      ${brandFooter}
    </div>
  `;
}

export async function sendWelcomeEmail({ to, fullName }) {
  const firstName = fullName?.split(' ')[0] || 'there';
  await sendEmail({
    to,
    subject: 'Welcome to ResearchBridge Consulting!',
    html: wrap(`
      <h2 style="color:#0A1F44;">Welcome, ${firstName}! 🎉</h2>
      <p>You've successfully logged in to your ResearchBridge account. We're glad to have you here.</p>
      <p>From your dashboard you can enrol in courses, track your learning progress, and manage your training applications — all in one place.</p>
      <p style="margin-top:24px;">
        <a href="#" style="background:#3B9EE8; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
          Go to My Dashboard
        </a>
      </p>
      <p style="margin-top:24px; color:#5A6A85; font-size:14px;">If you have any questions, just reply to this email — we're happy to help.</p>
    `),
  });
}

export async function sendEnrolmentConfirmationEmail({ to, firstName, courseName, mode, category, level, workshop }) {
  const workshopBlock = workshop ? `
    <tr><td style="padding:6px 0; color:#5A6A85;">Venue</td><td style="padding:6px 0; font-weight:600;">${workshop.venue}</td></tr>
    <tr><td style="padding:6px 0; color:#5A6A85;">Date</td><td style="padding:6px 0; font-weight:600;">${new Date(workshop.start_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
    <tr><td style="padding:6px 0; color:#5A6A85;">Trainer</td><td style="padding:6px 0; font-weight:600;">${workshop.trainer_name}</td></tr>
    <tr><td style="padding:6px 0; color:#5A6A85;">Fee</td><td style="padding:6px 0; font-weight:600;">${workshop.fee}</td></tr>
  ` : '';

  await sendEmail({
    to,
    subject: `Enrolment Received — ${courseName}`,
    html: wrap(`
      <h2 style="color:#0A1F44;">Thanks, ${firstName}! Your enrolment is in. ✅</h2>
      <p>We've received your enrolment for <strong>${courseName}</strong>. Here's a summary:</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr><td style="padding:6px 0; color:#5A6A85;">Course</td><td style="padding:6px 0; font-weight:600;">${courseName}</td></tr>
        <tr><td style="padding:6px 0; color:#5A6A85;">Mode</td><td style="padding:6px 0; font-weight:600;">${mode}</td></tr>
        <tr><td style="padding:6px 0; color:#5A6A85;">Category</td><td style="padding:6px 0; font-weight:600;">${category}</td></tr>
        <tr><td style="padding:6px 0; color:#5A6A85;">Level</td><td style="padding:6px 0; font-weight:600;">${level}</td></tr>
        ${workshopBlock}
      </table>
      <p>Our team will review your enrolment and confirm it shortly. You'll be able to see its status any time from your dashboard.</p>
    `),
  });
}

export async function sendMotivationalEmail({ to, firstName, courseName, progressPercent }) {
  await sendEmail({
    to,
    subject: `Keep going, ${firstName} — you're ${progressPercent}% through ${courseName}!`,
    html: wrap(`
      <h2 style="color:#0A1F44;">You're making progress! 💪</h2>
      <p>Hi ${firstName}, you're currently <strong>${progressPercent}%</strong> of the way through <strong>${courseName}</strong>.</p>
      <p>Every lesson you complete brings you closer to finishing the course. Why not pick up where you left off today?</p>
      <p style="margin-top:24px;">
        <a href="#" style="background:#3B9EE8; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
          Continue Learning
        </a>
      </p>
    `),
  });
}
