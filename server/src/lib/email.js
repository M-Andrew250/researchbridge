import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || 'ResearchBridge Consulting <onboarding@resend.dev>';

// Base URL for links inside emails (dashboard, course pages, etc.).
// Emails have no notion of "current origin" the way a browser page
// does, so this has to be an absolute, configured URL rather than
// the relative paths used elsewhere on the site.
const SITE_URL = (process.env.SITE_URL || 'https://researchbridgeconsulting.com').replace(/\/$/, '');

// Where new-enrolment alerts go — separate from RESEND_API_KEY so a
// site that sends student-facing email just fine can still choose not
// to wire up team alerts.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || null;

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
        <a href="${SITE_URL}/pages/dashboard" style="background:#3B9EE8; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600;">
          Go to My Dashboard
        </a>
      </p>
      <p style="margin-top:24px; color:#5A6A85; font-size:14px;">If you have any questions, just reply to this email — we're happy to help.</p>
    `),
  });
}

export async function sendEnrolmentConfirmationEmail({ to, firstName, courseName, mode, category, level, workshop, nextWorkshop }) {
  const workshopBlock = workshop ? `
    <tr><td style="padding:6px 0; color:#5A6A85;">Venue</td><td style="padding:6px 0; font-weight:600;">${workshop.venue}</td></tr>
    <tr><td style="padding:6px 0; color:#5A6A85;">Date</td><td style="padding:6px 0; font-weight:600;">${new Date(workshop.start_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
    <tr><td style="padding:6px 0; color:#5A6A85;">Trainer</td><td style="padding:6px 0; font-weight:600;">${workshop.trainer_name}</td></tr>
    <tr><td style="padding:6px 0; color:#5A6A85;">Fee</td><td style="padding:6px 0; font-weight:600;">${workshop.fee}</td></tr>
  ` : '';

  const nextWorkshopBlock = nextWorkshop ? `
    <div style="margin-top:28px; padding:20px; background:#F0F6FF; border-radius:10px; border:1px solid #C8D9EF;">
      <p style="margin:0 0 10px; font-weight:700; color:#0A1F44;">📅 Next In-Person Training</p>
      <p style="margin:0 0 4px; font-weight:600;">${nextWorkshop.courseName}</p>
      <p style="margin:0 0 16px; color:#5A6A85; font-size:14px;">
        ${new Date(nextWorkshop.start_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} · ${nextWorkshop.venue}
      </p>
      <a href="${SITE_URL}/pages/enrol?course=${nextWorkshop.courseSlug}&mode=In-Person&workshop=${nextWorkshop.id}" style="background:#3B9EE8; color:#ffffff; padding:10px 20px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">
        Reserve Your Seat →
      </a>
    </div>
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
      <p style="margin-top:24px;">
        <a href="${SITE_URL}/#courses" style="background:#ffffff; color:#1E5EBC; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; border:1.5px solid #3B9EE8; display:inline-block;">
          Explore Other Courses
        </a>
      </p>
      ${nextWorkshopBlock}
    `),
  });
}

// Internal alert to the team, fired alongside the student-facing
// receipt above — so a new request doesn't just sit unnoticed in the
// admin panel until someone happens to check it.
export async function sendNewEnrolmentAdminNotification({
  firstName, lastName, email, phone, courseName, mode, category, level, organisation, workshop, comments,
}) {
  if (!ADMIN_EMAIL) {
    console.warn('[email] ADMIN_EMAIL not set — skipped new-enrolment admin notification.');
    return;
  }

  const workshopBlock = workshop ? `
    <tr><td style="padding:6px 0; color:#5A6A85;">Venue</td><td style="padding:6px 0; font-weight:600;">${workshop.venue}</td></tr>
    <tr><td style="padding:6px 0; color:#5A6A85;">Date</td><td style="padding:6px 0; font-weight:600;">${new Date(workshop.start_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
  ` : '';

  // Surfaced separately (not just in the table) since this is where a
  // "Course of Interest: Other" submission's actual free-text
  // description lives — the one case where this field isn't just a
  // nice-to-have extra note but the whole reason the request needs a
  // human to look at it.
  const commentsBlock = comments ? `
    <div style="margin-top:16px; padding:16px; background:#F0F6FF; border-radius:10px; border:1px solid #C8D9EF;">
      <p style="margin:0; color:#5A6A85; font-size:14px;"><strong style="color:#0A1F44;">Comments:</strong> ${comments}</p>
    </div>
  ` : '';

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `New enrolment request — ${courseName} (${mode})`,
    html: wrap(`
      <h2 style="color:#0A1F44;">📥 New Enrolment Request</h2>
      <p><strong>${firstName} ${lastName}</strong> just applied for <strong>${courseName}</strong>.</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr><td style="padding:6px 0; color:#5A6A85;">Course</td><td style="padding:6px 0; font-weight:600;">${courseName}</td></tr>
        <tr><td style="padding:6px 0; color:#5A6A85;">Mode</td><td style="padding:6px 0; font-weight:600;">${mode}</td></tr>
        <tr><td style="padding:6px 0; color:#5A6A85;">Category</td><td style="padding:6px 0; font-weight:600;">${category}</td></tr>
        <tr><td style="padding:6px 0; color:#5A6A85;">Level</td><td style="padding:6px 0; font-weight:600;">${level}</td></tr>
        ${workshopBlock}
        <tr><td style="padding:6px 0; color:#5A6A85;">Email</td><td style="padding:6px 0; font-weight:600;">${email}</td></tr>
        <tr><td style="padding:6px 0; color:#5A6A85;">Phone</td><td style="padding:6px 0; font-weight:600;">${phone}</td></tr>
        ${organisation ? `<tr><td style="padding:6px 0; color:#5A6A85;">Organisation</td><td style="padding:6px 0; font-weight:600;">${organisation}</td></tr>` : ''}
      </table>
      ${commentsBlock}
      <p style="margin-top:24px;">
        <a href="${SITE_URL}/pages/admin" style="background:#3B9EE8; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">
          Review in Admin Panel →
        </a>
      </p>
    `),
  });
}

// Sent when an admin flips an enrolment's status to "confirmed" —
// distinct from sendEnrolmentConfirmationEmail above, which fires
// immediately on submission and just acknowledges receipt. This is
// the "you're actually in" moment, so it's the one that should
// congratulate and drive the learner into the course itself. Online
// enrolments unlock the e-learning platform at this exact point (see
// verifyOnlineEnrolment.js), so the CTA sends them straight there;
// in-person enrolments have no e-learning content to open, so it
// points at their enrolment details (venue/date/trainer) instead.
export async function sendEnrolmentApprovedEmail({ to, firstName, courseName, mode, enrolmentId, workshop }) {
  const isOnline = mode === 'Online';

  const cta = isOnline ? `
    <p style="margin-top:28px;">
      <a href="${SITE_URL}/pages/learn?enrolment=${enrolmentId}" style="background:#3B9EE8; color:#ffffff; padding:14px 28px; border-radius:8px; text-decoration:none; font-weight:700; font-size:16px; display:inline-block;">
        Start Learning →
      </a>
    </p>
    <p style="margin-top:20px; color:#5A6A85; font-size:14px;">You can pick up right where you left off any time from your dashboard.</p>
  ` : `
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      <tr><td style="padding:6px 0; color:#5A6A85;">Venue</td><td style="padding:6px 0; font-weight:600;">${workshop?.venue || 'To be confirmed'}</td></tr>
      <tr><td style="padding:6px 0; color:#5A6A85;">Date</td><td style="padding:6px 0; font-weight:600;">${workshop?.start_date ? new Date(workshop.start_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'To be confirmed'}</td></tr>
      <tr><td style="padding:6px 0; color:#5A6A85;">Trainer</td><td style="padding:6px 0; font-weight:600;">${workshop?.trainer_name || 'To be confirmed'}</td></tr>
    </table>
    <p style="margin-top:24px;">
      <a href="${SITE_URL}/pages/enrolment-detail?id=${enrolmentId}" style="background:#3B9EE8; color:#ffffff; padding:14px 28px; border-radius:8px; text-decoration:none; font-weight:700; font-size:16px; display:inline-block;">
        View Enrolment Details →
      </a>
    </p>
  `;

  await sendEmail({
    to,
    subject: isOnline
      ? `🎉 You're confirmed — start learning ${courseName} now!`
      : `🎉 You're confirmed for ${courseName}!`,
    html: wrap(`
      <h2 style="color:#0A1F44;">Congratulations, ${firstName}! 🎉</h2>
      <p>Your enrolment for <strong>${courseName}</strong> has been confirmed${isOnline ? " — you're all set to start learning right now." : ', and we\'re looking forward to having you.'}</p>
      ${cta}
    `),
  });
}

// Covers both cancellation paths — a user stopping their own
// enrolment from the dashboard, and an admin cancelling one from the
// admin panel — since the only real difference is who did it and
// (for the admin path) an optional reason. cancelledByAdmin controls
// the wording; both still land the same "come back any time" CTA.
export async function sendEnrolmentCancelledEmail({ to, firstName, courseName, reason, cancelledByAdmin }) {
  const reasonBlock = reason ? `
    <div style="margin-top:16px; padding:16px; background:#F0F6FF; border-radius:10px; border:1px solid #C8D9EF;">
      <p style="margin:0; color:#5A6A85; font-size:14px;"><strong style="color:#0A1F44;">Reason given:</strong> ${reason}</p>
    </div>
  ` : '';

  await sendEmail({
    to,
    subject: `Your enrolment for ${courseName} has been cancelled`,
    html: wrap(`
      <h2 style="color:#0A1F44;">Hi ${firstName},</h2>
      ${cancelledByAdmin
        ? `<p>Your enrolment for <strong>${courseName}</strong> has been cancelled by our team.</p>`
        : `<p>As requested, we've cancelled your enrolment for <strong>${courseName}</strong>.</p>`}
      ${reasonBlock}
      ${cancelledByAdmin ? `<p style="margin-top:16px; color:#5A6A85; font-size:14px;">If you think this was a mistake or have any questions, just reply to this email — we're happy to help.</p>` : ''}
      <p style="margin-top:24px;">
        <a href="${SITE_URL}/#courses" style="background:#3B9EE8; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">
          Explore Courses
        </a>
      </p>
    `),
  });
}

export async function sendThesisRequestConfirmationEmail({ to, firstName, documentType, serviceType, deadline, fileCount }) {
  await sendEmail({
    to,
    subject: 'We’ve received your document — ResearchBridge Editing',
    html: wrap(`
      <h2 style="color:#0A1F44;">Thanks, ${firstName}! Your document is with us. ✅</h2>
      <p>We've received your submission for editing and proofreading. Here's a summary:</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr><td style="padding:6px 0; color:#5A6A85;">Document Type</td><td style="padding:6px 0; font-weight:600;">${documentType}</td></tr>
        <tr><td style="padding:6px 0; color:#5A6A85;">Service</td><td style="padding:6px 0; font-weight:600;">${serviceType}</td></tr>
        <tr><td style="padding:6px 0; color:#5A6A85;">File(s) Received</td><td style="padding:6px 0; font-weight:600;">${fileCount}</td></tr>
        ${deadline ? `<tr><td style="padding:6px 0; color:#5A6A85;">Your Deadline</td><td style="padding:6px 0; font-weight:600;">${new Date(deadline).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>` : ''}
      </table>
      <p>Our editing team will review your document and reach out with a quote, payment instructions, and turnaround time shortly.</p>
    `),
  });
}

export async function sendMotivationalEmail({ to, firstName, courseName, progressPercent, enrolmentId }) {
  await sendEmail({
    to,
    subject: `Keep going, ${firstName} — you're ${progressPercent}% through ${courseName}!`,
    html: wrap(`
      <h2 style="color:#0A1F44;">You're making progress! 💪</h2>
      <p>Hi ${firstName}, you're currently <strong>${progressPercent}%</strong> of the way through <strong>${courseName}</strong>.</p>
      <p>Every lesson you complete brings you closer to finishing the course. Why not pick up where you left off today?</p>
      <p style="margin-top:24px;">
        <a href="${SITE_URL}/pages/learn?enrolment=${enrolmentId}" style="background:#3B9EE8; color:#ffffff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">
          Continue Learning
        </a>
      </p>
    `),
  });
}
