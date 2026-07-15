// Shared certificate rendering — used by pages/dashboard.html (a
// student's own certificate cards) and pages/verify-certificate.html
// (the public preview shown after a successful verification). Kept in
// one place so both pages draw an identical certificate rather than
// two hand-maintained copies drifting apart.
//
// Wrapped in an IIFE so its internals (drawCertificate, etc.) don't
// leak as bare globals — dashboard.html has its own inline script in
// the same page and would otherwise collide with these names.
(function () {

// Signer name/title/company, logo, signature, and standard wording
// are admin-editable (pages/admin.html's Certificate tab) rather than
// hardcoded — a signer or logo can change without a code deploy.
// Fetched once and reused for every certificate drawn on this page
// load; falls back to today's real values if the settings endpoint is
// ever unreachable, so certificates still generate correctly either way.
let rbcCertSettingsPromise = null;
function loadCertificateSettings() {
  if (!rbcCertSettingsPromise) {
    rbcCertSettingsPromise = fetch(`${window.rbcApiBaseUrl}/api/certificates/settings`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((data) => ({
        signerName: data?.signer_name || 'Andrew MUSHOKAMBERE',
        signerTitle: data?.signer_title || 'Chief Executive Officer',
        signerCompany: data?.signer_company || 'ResearchBridge Consulting Ltd',
        logoUrl: data?.logo_url || '../images/logo.png',
        signatureUrl: data?.signature_url || '../images/ceo-signature.png',
        credentialWording: data?.credential_wording || 'has successfully completed the requirements of the self-paced online course',
        levelSpan: data?.level_span || 'Beginner to Advanced',
      }));
  }
  return rbcCertSettingsPromise;
}

// Cached by URL rather than a fixed path, since the logo/signature may
// point at an admin-uploaded Supabase Storage URL instead of the
// bundled default image. crossOrigin is set defensively for that
// cross-origin case — without it, drawing a cross-origin image onto
// the canvas would "taint" it and toDataURL()/toBlob() (used for the
// PDF and the share image) would throw.
const rbcCertImageCache = new Map();
function loadCertificateImage(url) {
  if (!url) return Promise.resolve(null);
  if (!rbcCertImageCache.has(url)) {
    rbcCertImageCache.set(url, new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return rbcCertImageCache.get(url);
}

// Greedy word-wrap so an admin-editable sentence (the credential
// wording, edited as free text in pages/admin.html) never overflows
// off the edge of the certificate as a single unbroken line — it
// re-flows to as many lines as it needs, and the layout below it
// shifts down to make room.
function wrapCanvasText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

async function drawCertificate(canvas, { studentName, courseName, dateStr, certId }) {
  // Sized to the same landscape ratio as the downloadable PDF (A4
  // landscape, 297x210mm) so the on-screen preview is the same shape
  // as the file a student actually gets, not an arbitrary box.
  const width = 1272;
  const baseFrameHeight = 780;
  const footerStripHeight = 120;
  canvas.width = width;
  const ctx = canvas.getContext('2d');

  try {
    await Promise.all([
      document.fonts.load('700 46px "Playfair Display"'),
      document.fonts.load('700 22px "Playfair Display"'),
      document.fonts.load('italic 600 20px "Playfair Display"'),
      document.fonts.load('400 18px Inter'),
    ]);
    await document.fonts.ready;
  } catch (err) {}

  const settings = await loadCertificateSettings();
  const logo = await loadCertificateImage(settings.logoUrl);
  const signature = await loadCertificateImage(settings.signatureUrl);

  // Wrap the credential wording before laying out anything below it —
  // its line count decides how much extra room the rest of the
  // certificate (and the frame itself) needs to make for it.
  ctx.font = '400 18px Inter, sans-serif';
  const wordingLines = wrapCanvasText(ctx, settings.credentialWording, 720);
  const wordingLineHeight = 24;
  const extra = (wordingLines.length - 1) * wordingLineHeight;

  const frameHeight = baseFrameHeight + extra;
  canvas.height = frameHeight + footerStripHeight;
  const height = canvas.height;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#0A1F44';
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, width - 40, frameHeight);

  ctx.strokeStyle = '#3B9EE8';
  ctx.lineWidth = 2;
  ctx.strokeRect(34, 34, width - 68, frameHeight - 28);

  ctx.textAlign = 'center';

  if (logo) {
    ctx.drawImage(logo, width / 2 - 35, 50, 70, 70);
  }

  ctx.fillStyle = '#1E5EBC';
  ctx.font = '700 22px "Playfair Display", serif';
  ctx.fillText('ResearchBridge Consulting', width / 2, 155);

  ctx.fillStyle = '#0A1F44';
  ctx.font = '700 46px "Playfair Display", serif';
  ctx.fillText('Certificate of Completion', width / 2, 230);

  ctx.fillStyle = '#5A6A85';
  ctx.font = '400 18px Inter, sans-serif';
  ctx.fillText('This certifies that', width / 2, 305);

  ctx.fillStyle = '#0A1F44';
  ctx.font = '700 42px "Playfair Display", serif';
  ctx.fillText(studentName, width / 2, 370);

  const nameWidth = ctx.measureText(studentName).width;
  ctx.strokeStyle = '#3B9EE8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - nameWidth / 2 - 20, 390);
  ctx.lineTo(width / 2 + nameWidth / 2 + 20, 390);
  ctx.stroke();

  ctx.fillStyle = '#5A6A85';
  ctx.font = '400 18px Inter, sans-serif';
  wordingLines.forEach((line, i) => {
    ctx.fillText(line, width / 2, 435 + i * wordingLineHeight);
  });

  const courseNameY = 435 + extra + 50;
  ctx.fillStyle = '#1E5EBC';
  ctx.font = '700 32px "Playfair Display", serif';
  ctx.fillText(courseName, width / 2, courseNameY);

  // Standardised credential attributes — format and level are the
  // same honest statement for every course; the exact completion
  // date (not a fixed duration, since this is self-paced) is printed
  // separately below.
  const attrY = courseNameY + 37;
  ctx.fillStyle = '#5A6A85';
  ctx.font = '600 15px Inter, sans-serif';
  ctx.fillText(`Self-Paced Online Course  ·  ${settings.levelSpan} Level`, width / 2, attrY);

  // Date (left) and signature (right)
  const lineY = attrY + 120;
  ctx.textAlign = 'left';
  ctx.strokeStyle = '#C8D9EF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(120, lineY);
  ctx.lineTo(320, lineY);
  ctx.stroke();
  ctx.fillStyle = '#5A6A85';
  ctx.font = '400 14px Inter, sans-serif';
  ctx.fillText('Date of Completion', 120, lineY + 20);
  ctx.fillStyle = '#0A1F44';
  ctx.font = '600 17px Inter, sans-serif';
  ctx.fillText(dateStr, 120, lineY + 42);

  ctx.textAlign = 'right';

  // CEO's real signature, drawn just above the rule — sized to its
  // own aspect ratio (679x358) rather than stretched.
  if (signature) {
    const sigWidth = 150, sigHeight = sigWidth * (358 / 679);
    ctx.drawImage(signature, width - 120 - sigWidth, lineY - sigHeight - 10, sigWidth, sigHeight);
  }

  ctx.beginPath();
  ctx.moveTo(width - 320, lineY);
  ctx.lineTo(width - 120, lineY);
  ctx.stroke();
  ctx.fillStyle = '#5A6A85';
  ctx.font = '400 14px Inter, sans-serif';
  ctx.fillText('Authorized Signature', width - 120, lineY + 20);
  ctx.fillStyle = '#0A1F44';
  ctx.font = 'italic 600 20px "Playfair Display", serif';
  ctx.fillText(settings.signerName, width - 120, lineY + 44);
  ctx.fillStyle = '#5A6A85';
  ctx.font = '400 13px Inter, sans-serif';
  ctx.fillText(settings.signerTitle, width - 120, lineY + 64);
  ctx.fillText(settings.signerCompany, width - 120, lineY + 82);

  // Verification footer — drawn in its own strip below the frame,
  // positioned off the frame's own (possibly wrapped-taller) bottom
  // edge rather than a fixed offset. The certificate ID is just this
  // enrolment's own uuid, looked up as-is by
  // pages/verify-certificate.html via GET /api/certificates/verify/:id.
  const footerLabelY = frameHeight + 48;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#5A6A85';
  ctx.font = '600 11px Inter, sans-serif';
  ctx.fillText('CERTIFICATE ID', width / 2, footerLabelY);

  ctx.fillStyle = '#0A1F44';
  ctx.font = '600 17px "Courier New", monospace';
  ctx.fillText(certId, width / 2, footerLabelY + 22);

  ctx.fillStyle = '#1E5EBC';
  ctx.font = '600 13px Inter, sans-serif';
  ctx.fillText('Verify at researchbridgeconsulting.com/pages/verify-certificate.html', width / 2, footerLabelY + 44);
}

window.RBCCertificate = { drawCertificate, loadCertificateSettings, loadCertificateImage };

})();
