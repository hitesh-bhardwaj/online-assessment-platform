import { Resend } from 'resend';

const resendFrom = process.env.RESEND_FROM_EMAIL ?? 'no-reply@hiteshbhardwaj.in';

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
};

export async function sendEmailVerificationEmail(to: string, verificationToken: string) {
  const resendClient = getResendClient();

  if (!resendClient) {
    console.warn('[email] RESEND_API_KEY not configured. Skipping email send.');
    console.log(`[email] Verification link: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`);
    return;
  }

  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verificationLink = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

  try {
    await resendClient.emails.send({
      from: resendFrom,
      to,
      subject: 'Verify Your Email Address',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e0e0e0;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #333333;">Verify Your Email Address</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #555555;">
                Thank you for signing up! Please verify your email address to complete your account setup and access all features.
              </p>

              <!-- Verify Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${verificationLink}" style="display: inline-block; padding: 14px 32px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">Verify Email Address</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 21px; color: #777777;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0; font-size: 13px; line-height: 21px; color: #007bff; word-break: break-all;">
                ${verificationLink}
              </p>

              <div style="margin-top: 30px; padding: 20px; background-color: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; line-height: 21px; color: #1976d2;">
                  <strong>ℹ️ Note:</strong><br>
                  This link will expire in 24 hours. If you didn't create this account, please ignore this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #999999;">
                This email was sent by Online Assessment Platform<br>
                If you have questions, please contact support.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    });

    console.log(`[email] Verification email sent to ${to}`);
  } catch (error) {
    console.error('[email] Failed to send verification email:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail(to: string, resetToken: string) {
  const resendClient = getResendClient();

  if (!resendClient) {
    console.warn('[email] RESEND_API_KEY not configured. Skipping email send.');
    console.log(`[email] Password reset link: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`);
    return;
  }

  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

  try {
    await resendClient.emails.send({
      from: resendFrom,
      to,
      subject: 'Reset Your Password',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e0e0e0;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #333333;">Reset Your Password</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #555555;">
                We received a request to reset your password. Click the button below to create a new password:
              </p>

              <!-- Reset Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">Reset Password</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 21px; color: #777777;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0; font-size: 13px; line-height: 21px; color: #007bff; word-break: break-all;">
                ${resetLink}
              </p>

              <div style="margin-top: 30px; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; line-height: 21px; color: #856404;">
                  <strong>⚠️ Security Notice:</strong><br>
                  This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #999999;">
                This email was sent by Online Assessment Platform<br>
                If you have questions, please contact support.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    });

    console.log(`[email] Password reset email sent to ${to}`);
  } catch (error) {
    console.error('[email] Failed to send password reset email:', error);
    throw error;
  }
}
