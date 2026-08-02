type EmailResult = {
  sent: boolean;
  message: string;
};

type ModerationEmailInput = {
  to: string;
  fullName: string;
  reason: string;
  rulesUrl: string;
  restorationDate?: string | null;
};

type InviteEmailInput = {
  to: string;
  fullName: string;
  role: string;
  inviteUrl: string;
};

type AppealNoticeInput = {
  to: string;
  dashboardUrl: string;
};

const brandName = "CampusPress AI";

export async function sendModerationWarningEmail(input: ModerationEmailInput) {
  return sendBrandedEmail({
    to: input.to,
    subject: "CampusPress AI account warning",
    heading: "Account warning",
    body: [
      `Hello ${input.fullName},`,
      "Your account has been flagged for a rules violation. Your access remains active.",
      `Reason: ${input.reason}`,
      "Continued violations may lead to a suspension or permanent ban.",
    ],
    action: { label: "Read the platform rules", href: input.rulesUrl },
  });
}

export async function sendSuspensionNoticeEmail(input: ModerationEmailInput) {
  return sendBrandedEmail({
    to: input.to,
    subject: "CampusPress AI account suspended",
    heading: "Account suspended",
    body: [
      `Hello ${input.fullName},`,
      "Your account has been suspended for a rules violation.",
      `Reason: ${input.reason}`,
      input.restorationDate
        ? `Your account is scheduled to restore on ${input.restorationDate}.`
        : "An administrator must restore this account before access resumes.",
      "You can submit one appeal for this suspension from the account status screen.",
    ],
    action: { label: "Read the platform rules", href: input.rulesUrl },
  });
}

export async function sendBanNoticeEmail(input: ModerationEmailInput) {
  return sendBrandedEmail({
    to: input.to,
    subject: "CampusPress AI account permanently banned",
    heading: "Account permanently banned",
    body: [
      `Hello ${input.fullName},`,
      "Your account has been permanently banned for a rules violation.",
      `Reason: ${input.reason}`,
      "There is no appeal path for a permanent ban.",
    ],
    action: { label: "Read the platform rules", href: input.rulesUrl },
  });
}

export async function sendSuspensionAppealSubmittedEmail(input: AppealNoticeInput) {
  return sendBrandedEmail({
    to: input.to,
    subject: "CampusPress AI suspension appeal submitted",
    heading: "Suspension appeal submitted",
    body: [
      "A suspended user submitted an appeal.",
      "Log in to the admin dashboard to review the explanation and submitted ID photo.",
      "The appeal content is intentionally not included in this email.",
    ],
    action: { label: "Open admin dashboard", href: input.dashboardUrl },
  });
}

export async function sendSuspensionAppealAcceptedEmail(input: ModerationEmailInput) {
  return sendBrandedEmail({
    to: input.to,
    subject: "CampusPress AI suspension lifted",
    heading: "Suspension lifted",
    body: [
      `Hello ${input.fullName},`,
      "Your suspension appeal was accepted.",
      "Your CampusPress AI account is active again. You can sign in and continue using the platform.",
    ],
    action: { label: "Open CampusPress AI", href: appBaseUrl() },
  });
}

export async function sendSuspensionAppealRejectedEmail(input: ModerationEmailInput) {
  return sendBrandedEmail({
    to: input.to,
    subject: "CampusPress AI account permanently banned",
    heading: "Account permanently banned",
    body: [
      `Hello ${input.fullName},`,
      "Your suspension appeal was rejected.",
      "Your account is now permanently banned for a rules violation. There is no further appeal path.",
      `Reason: ${input.reason}`,
    ],
    action: { label: "Read the platform rules", href: input.rulesUrl },
  });
}

export async function sendAdminInviteEmail(input: InviteEmailInput) {
  return sendBrandedEmail({
    to: input.to,
    subject: `CampusPress AI ${roleLabel(input.role)} invitation`,
    heading: "Complete your CampusPress AI setup",
    body: [
      `Hello ${input.fullName},`,
      `You have been invited as ${roleLabel(input.role)} on CampusPress AI.`,
      "Use the secure setup link to create your password and review the role orientation.",
    ],
    action: { label: "Complete setup", href: input.inviteUrl },
  });
}

async function sendBrandedEmail({
  action,
  body,
  heading,
  subject,
  to,
}: {
  action: { label: string; href: string };
  body: string[];
  heading: string;
  subject: string;
  to: string;
}): Promise<EmailResult> {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!resendKey || !from) {
    return { sent: false, message: "Resend email is not configured." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html: brandedHtml({ action, body, heading }),
      text: `${heading}\n\n${body.join("\n\n")}\n\n${action.label}: ${action.href}`,
    }),
  }).catch(() => null);

  if (!response?.ok) {
    return { sent: false, message: "CampusPress could not send the branded email." };
  }

  return { sent: true, message: "Branded email sent." };
}

function brandedHtml({
  action,
  body,
  heading,
}: {
  action: { label: string; href: string };
  body: string[];
  heading: string;
}) {
  const paragraphs = body
    .map((line) => `<p style="margin:0 0 14px 0;color:#52525b;font-size:16px;line-height:1.7;">${escapeHtml(line)}</p>`)
    .join("");

  return `
    <div style="margin:0;background:#fafafa;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
      <table role="presentation" style="margin:0 auto;max-width:600px;width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e4e4e7;border-top:4px solid #c9a227;">
        <tr>
          <td style="padding:32px 32px 16px 32px;">
            <img src="${appBaseUrl()}/chrisland-logo.webp" alt="Chrisland University crest" width="56" height="56" style="display:block;object-fit:contain;">
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 8px 32px;">
            <p style="margin:0 0 12px 0;color:#4c1d95;font-size:13px;font-weight:700;">${brandName}</p>
            <h1 style="margin:0;color:#18181b;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.1;font-weight:600;">${escapeHtml(heading)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 32px 8px 32px;">
            ${paragraphs}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px 32px;">
            <a href="${escapeAttribute(action.href)}" style="display:inline-block;background:#4c1d95;color:#ffffff;text-decoration:none;border-radius:6px;padding:12px 18px;font-size:14px;font-weight:700;">${escapeHtml(action.label)}</a>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #e4e4e7;padding:20px 32px;color:#71717a;font-size:12px;line-height:1.6;">
            Chrisland University campus journalism, powered by CampusPress AI.
          </td>
        </tr>
      </table>
    </div>
  `;
}

function appBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  return "https://campuspress-ai.vercel.app";
}

function roleLabel(role: string) {
  if (role === "admin") {
    return "administrator";
  }
  if (role === "subadmin") {
    return "subadministrator";
  }
  return role;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
