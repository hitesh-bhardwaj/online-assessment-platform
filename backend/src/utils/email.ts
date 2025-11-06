import { Resend } from 'resend';

const resendFrom = process.env.RESEND_FROM_EMAIL ?? 'no-reply@hiteshbhardwaj.in';

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
};

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatDateTime = (value?: Date | string | null) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(date);
};

const normalizeMultiline = (value: string) =>
  escapeHtml(value)
    .split(/\r?\n/)
    .map(line => line.trim())
    .join('<br />');

export async function sendSignupVerificationEmail(to: string, verificationLink: string) {
  const resendClient = getResendClient();

  if (!resendClient) {
    console.warn('[email] RESEND_API_KEY not configured. Skipping email send.');
    return;
  }

  try {
    await resendClient.emails.send({
      from: resendFrom,
      to,
      subject: 'Confirm your organization signup',
      html: `
        <p>Hi there,</p>
        <p>Thanks for choosing our assessment platform. Click the button below to verify your work email and finish creating your organization.</p>
        <p><a href="${verificationLink}" style="display:inline-block;padding:12px 20px;border-radius:6px;background:#1C64F2;color:#ffffff;text-decoration:none;font-weight:600;">Verify & Continue</a></p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p><a href="${verificationLink}">${verificationLink}</a></p>
        <p>This link will expire in 24 hours. If you didn't request access, you can safely ignore this email.</p>
        <p>— Online Assessment Platform</p>
      `,
    });
  } catch (error) {
    console.error('[email] Failed to send signup verification email', error);
  }
}

export async function sendLoginOtpEmail(to: string, code: string) {
  const resendClient = getResendClient();

  if (!resendClient) {
    console.warn('[email] RESEND_API_KEY not configured. Skipping OTP email send.');
    return;
  }

  try {
    await resendClient.emails.send({
      from: resendFrom,
      to,
      subject: 'Your sign-in code',
      html: `
        <p>Use the one-time code below to finish signing in. It expires in 5 minutes.</p>
        <p style="font-size:28px; font-weight:700; letter-spacing:8px; text-align:center;">${code}</p>
        <p>If you didn't request this code, you can ignore this email.</p>
        <p>— Online Assessment Platform</p>
      `,
    });
  } catch (error) {
    console.error('[email] Failed to send login OTP email', error);
  }
}

interface CandidateInvitationEmailParams {
  to: string;
  candidateName?: string;
  assessmentTitle: string;
  invitationUrl: string;
  expiresAt?: Date | string | null;
  organizationName?: string;
  customMessage?: string;
  isReminder?: boolean;
}

export async function sendCandidateInvitationEmail({
  to,
  candidateName,
  assessmentTitle,
  invitationUrl,
  expiresAt,
  organizationName,
  customMessage,
  isReminder = false
}: CandidateInvitationEmailParams) {
  const resendClient = getResendClient();

  if (!resendClient) {
    console.warn('[email] RESEND_API_KEY not configured. Skipping candidate invitation email.');
    return;
  }

  const greetingName = candidateName?.trim() || 'there';
  const orgName = organizationName?.trim() || 'Online Assessment Platform';
  const expiryCopy = formatDateTime(expiresAt);
  const subject = `${isReminder ? 'Reminder' : 'Invitation'}: ${assessmentTitle} assessment`;

  const customMessageBlock = customMessage?.trim()
    ? `
        <div style="margin-top:20px;padding:16px;border-left:4px solid #D97706;background:#FFF7ED;">
          <p style="margin:0 0 8px;font-weight:600;color:#92400E;">Additional notes from ${orgName}:</p>
          <p style="margin:0;color:#7C2D12;line-height:1.6;">${normalizeMultiline(customMessage)}</p>
        </div>
      `
    : '';

  const html = `
    <div style="font-family:'Inter','Segoe UI',sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f9fafb;color:#0f172a;">
      <h1 style="font-size:24px;margin-bottom:16px;color:#111827;">${isReminder ? 'We saved your seat.' : 'You\'re invited!'}</h1>
      <p style="margin:0 0 16px;">Hi ${escapeHtml(greetingName)},</p>
      <p style="margin:0 0 16px;line-height:1.6;">
        ${escapeHtml(orgName)} invited you to complete the <strong>${escapeHtml(assessmentTitle)}</strong> assessment.
        Click the button below to launch your secure candidate workspace.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${invitationUrl}" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#1d4ed8;color:#ffffff;font-weight:600;text-decoration:none;">
          ${isReminder ? 'Resume assessment' : 'Start assessment'}
        </a>
      </p>
      <p style="margin:0 0 16px;line-height:1.6;">
        The invitation link is unique to you${expiryCopy ? ` and expires on ${escapeHtml(expiryCopy)}.` : '.'}
        If you run into any issues, reply to this email and the team at ${escapeHtml(orgName)} will help you out.
      </p>
      ${customMessageBlock}
      <p style="margin:24px 0 0;line-height:1.6;">Best of luck!<br/>— ${escapeHtml(orgName)}</p>
      <hr style="margin:32px 0;border:none;border-top:1px solid #e2e8f0;" />
      <p style="margin:0;font-size:12px;color:#64748b;">
        Trouble with the button? Copy and paste this link into your browser:<br />
        <a href="${invitationUrl}" style="color:#2563eb;">${invitationUrl}</a>
      </p>
    </div>
  `;

  const textParts = [
    `Hi ${greetingName},`,
    `${orgName} invited you to complete the ${assessmentTitle} assessment.`,
    `Start: ${invitationUrl}`,
    expiryCopy ? `This link expires on ${expiryCopy}.` : undefined,
    customMessage?.trim() ? `Notes from ${orgName}:\n${customMessage.trim()}` : undefined,
    `Best of luck!\n— ${orgName}`
  ].filter(Boolean) as string[];

  try {
    await resendClient.emails.send({
      from: resendFrom,
      to,
      subject,
      html,
      text: textParts.join('\n\n')
    });
  } catch (error) {
    console.error('[email] Failed to send candidate invitation email', error);
  }
}
