import assert from "node:assert/strict";

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

assert.ok(accessToken, "Missing SUPABASE_ACCESS_TOKEN");
assert.ok(supabaseUrl, "Missing NEXT_PUBLIC_SUPABASE_URL");

const projectRef = new URL(supabaseUrl).host.split(".")[0];
const logoUrl = "https://campuspress-ai.vercel.app/chrisland-logo.webp";

const confirmationTemplate = brandedTemplate({
  eyebrow: "CampusPress AI",
  heading: "Confirm your email",
  body:
    "Finish creating your CampusPress AI account by confirming this email address.",
  button: "Confirm account",
  footer: "If you did not create this account, you can ignore this email.",
});

const recoveryTemplate = brandedTemplate({
  eyebrow: "CampusPress AI",
  heading: "Reset your password",
  body:
    "Use this secure link to choose a new password for your CampusPress AI account.",
  button: "Reset password",
  footer: "If you did not request a password reset, you can ignore this email.",
});

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    mailer_subjects_confirmation: "Confirm your CampusPress AI account",
    mailer_templates_confirmation_content: confirmationTemplate,
    mailer_subjects_recovery: "Reset your CampusPress AI password",
    mailer_templates_recovery_content: recoveryTemplate,
  }),
});

const result = await response.json().catch(() => ({}));

if (!response.ok) {
  throw new Error(`Supabase template update failed: ${response.status} ${JSON.stringify(result)}`);
}

console.log(
  JSON.stringify(
    {
      updated: true,
      projectRef,
      confirmationSubject: result.mailer_subjects_confirmation,
      recoverySubject: result.mailer_subjects_recovery,
      senderName: result.smtp_sender_name,
      senderEmail: result.smtp_admin_email,
    },
    null,
    2,
  ),
);

function brandedTemplate({
  body,
  button,
  eyebrow,
  footer,
  heading,
}) {
  return `
    <div style="margin:0;background:#fafafa;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
      <table role="presentation" style="margin:0 auto;max-width:600px;width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e4e4e7;border-top:4px solid #c9a227;">
        <tr>
          <td style="padding:32px 32px 16px 32px;">
            <img src="${logoUrl}" alt="Chrisland University crest" width="56" height="56" style="display:block;object-fit:contain;">
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 8px 32px;">
            <p style="margin:0 0 12px 0;color:#4c1d95;font-size:13px;font-weight:700;">${eyebrow}</p>
            <h1 style="margin:0;color:#18181b;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.1;font-weight:600;">${heading}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 32px 8px 32px;">
            <p style="margin:0;color:#52525b;font-size:16px;line-height:1.7;">${body}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px 32px;">
            <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#4c1d95;color:#ffffff;text-decoration:none;border-radius:6px;padding:12px 18px;font-size:14px;font-weight:700;">${button}</a>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #e4e4e7;padding:20px 32px;color:#71717a;font-size:12px;line-height:1.6;">
            ${footer}
          </td>
        </tr>
      </table>
    </div>
  `;
}
