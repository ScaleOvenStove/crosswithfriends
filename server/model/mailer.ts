import sgMail from '@sendgrid/mail';

const APP_URL = process.env.APP_URL || 'http://localhost:3020';
const MAIL_FROM = process.env.MAIL_FROM || 'noreply@crosswithfriends.com';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY not set — emails will be logged to console instead of sent');
}

async function sendEmail(to: string, subject: string, text: string, html: string): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[MAIL] To: ${to} | Subject: ${subject}`);
    console.log(`[MAIL] ${text}`);
    return;
  }
  await sgMail.send({to, from: MAIL_FROM, subject, text, html});
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  isEmailChange = false
): Promise<void> {
  const link = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = isEmailChange
    ? 'Confirm your new email — Cross with Friends'
    : 'Verify your email — Cross with Friends';

  const heading = isEmailChange ? 'Confirm Your New Email' : 'Verify Your Email';

  const intro = isEmailChange
    ? 'You requested to change the email address on your Cross with Friends account. Click the button below to confirm this new email address.'
    : 'Thanks for signing up for Cross with Friends! Click the button below to verify your email address.';

  const text = `${heading}\n\n${intro}\n\nVerify: ${link}\n\nThis link expires in 24 hours.\n\nIf you didn't request this, you can safely ignore this email.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
      <h2 style="color: #333; margin-bottom: 16px;">${heading}</h2>
      <p style="color: #555; line-height: 1.5;">${intro}</p>
      <div style="margin: 24px 0;">
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #4a90d9; color: #fff; text-decoration: none; border-radius: 4px; font-weight: 500;">
          Verify Email
        </a>
      </div>
      <p style="color: #888; font-size: 13px;">This link expires in 24 hours.</p>
      <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 12px;">Cross with Friends</p>
    </div>
  `;

  await sendEmail(email, subject, text, html);
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = 'Reset your password — Cross with Friends';

  const text = `Reset Your Password\n\nWe received a request to reset your Cross with Friends password. Click the link below to set a new password.\n\nReset: ${link}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, you can safely ignore this email — your password won't be changed.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
      <h2 style="color: #333; margin-bottom: 16px;">Reset Your Password</h2>
      <p style="color: #555; line-height: 1.5;">We received a request to reset your Cross with Friends password. Click the button below to set a new password.</p>
      <div style="margin: 24px 0;">
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #4a90d9; color: #fff; text-decoration: none; border-radius: 4px; font-weight: 500;">
          Reset Password
        </a>
      </div>
      <p style="color: #888; font-size: 13px;">This link expires in 1 hour.</p>
      <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 12px;">Cross with Friends</p>
    </div>
  `;

  await sendEmail(email, subject, text, html);
}
