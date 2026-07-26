import 'server-only';

import nodemailer from 'nodemailer';

const ADMIN_ALERT_EMAIL = 'oalsuhaim@wanderloomsa.com';

function smtpConfiguration() {
  const host = String(process.env.SMTP_HOST ?? '').trim();
  const port = Number.parseInt(String(process.env.SMTP_PORT ?? '587'), 10);
  const user = String(process.env.SMTP_USER ?? '').trim();
  const pass = String(process.env.SMTP_PASS ?? '').trim();

  if (!host || !user || !pass || !Number.isFinite(port)) {
    return null;
  }

  return { host, port, user, pass };
}

export function escapeEmailHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * Sends an operational alert without ever throwing into the public user flow.
 * Returns true only when the SMTP server accepts the message.
 */
export async function sendEmailAlert(subject, htmlBody) {
  try {
    const smtp = smtpConfiguration();
    if (!smtp) {
      console.warn(
        '[emailAlert] SMTP is not configured; alert email was skipped.',
      );
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

    await transporter.sendMail({
      from: `Wanderloom Alerts <${smtp.user}>`,
      to: ADMIN_ALERT_EMAIL,
      subject: String(subject),
      html: String(htmlBody),
    });

    return true;
  } catch (error) {
    console.error('[emailAlert] Failed to send admin alert:', error);
    return false;
  }
}
