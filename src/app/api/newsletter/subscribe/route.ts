import { NextResponse } from "next/server";

import { createServiceSupabaseClient } from "@/lib/supabase-server";

type NewsletterPayload = {
  email?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as NewsletterPayload;
  const email = payload.email?.trim().toLowerCase() ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, message: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const supabase = createServiceSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("newsletter_subscriptions").upsert(
    {
      email,
      source: "landing_page",
      confirmation_sent_at: now,
    },
    { onConflict: "email" },
  );

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "CampusPress could not save this subscription. Try again.",
      },
      { status: 500 },
    );
  }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!resendKey || !from) {
    return NextResponse.json(
      {
        ok: false,
        message: "Newsletter confirmation email is not configured yet.",
      },
      { status: 500 },
    );
  }

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "CampusPress AI newsletter confirmation",
      html: newsletterHtml(),
      text: "You are subscribed to CampusPress AI updates. We will send reader highlights, published campus stories, and platform updates in plain English.",
    }),
  });

  if (!emailResponse.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: "Your email was saved, but the confirmation could not be sent.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Subscription saved. Check your email for confirmation.",
  });
}

function newsletterHtml() {
  return `
    <div style="margin:0;background:#fafafa;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
      <table role="presentation" style="margin:0 auto;max-width:600px;width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e4e4e7;border-top:4px solid #c9a227;">
        <tr>
          <td style="padding:32px 32px 16px 32px;">
            <img src="https://campuspress-ai.vercel.app/chrisland-logo.webp" alt="Chrisland University crest" width="56" height="56" style="display:block;object-fit:contain;">
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 8px 32px;">
            <p style="margin:0 0 12px 0;color:#4c1d95;font-size:13px;font-weight:700;">CampusPress AI</p>
            <h1 style="margin:0;color:#18181b;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.1;font-weight:600;">You are subscribed</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 32px 8px 32px;">
            <p style="margin:0;color:#52525b;font-size:16px;line-height:1.7;">You will receive reader highlights, published campus stories, and product updates written in plain English.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px 32px;">
            <a href="https://campuspress-ai.vercel.app/feed" style="display:inline-block;background:#4c1d95;color:#ffffff;text-decoration:none;border-radius:6px;padding:12px 18px;font-size:14px;font-weight:700;">Open CampusPress AI</a>
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
