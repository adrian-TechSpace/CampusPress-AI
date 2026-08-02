import { NextResponse } from "next/server";

import { authenticateSuspendedRequest } from "@/lib/account-enforcement";
import { sendSuspensionAppealSubmittedEmail } from "@/lib/email";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authenticateSuspendedRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message, account: auth.account }, { status: auth.status });
  }

  const form = await request.formData();
  const explanation = String(form.get("explanation") ?? "").trim();
  const situation = String(form.get("situation") ?? "").trim();
  const improvementPlan = String(form.get("improvementPlan") ?? "").trim();
  const idPhoto = form.get("idPhoto");

  if (explanation.length < 40 || situation.length < 10) {
    return NextResponse.json(
      { ok: false, message: "Add a clear explanation and answer the appeal questions before submitting." },
      { status: 400 },
    );
  }

  if (!(idPhoto instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(idPhoto.type)) {
    return NextResponse.json(
      { ok: false, message: "Upload a JPG, PNG, or WebP photo of your student or staff ID card." },
      { status: 400 },
    );
  }

  if (idPhoto.size > 5 * 1024 * 1024) {
    return NextResponse.json({ ok: false, message: "Use an ID photo under 5 MB." }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const extension = idPhoto.type === "image/png" ? "png" : idPhoto.type === "image/webp" ? "webp" : "jpg";
  const path = `${auth.userId}/${Date.now()}-id-card.${extension}`;
  const upload = await supabase.storage.from("appeal-ids").upload(path, await idPhoto.arrayBuffer(), {
    contentType: idPhoto.type,
    upsert: false,
  });

  if (upload.error) {
    return NextResponse.json(
      { ok: false, message: "CampusPress could not upload that ID photo." },
      { status: 400 },
    );
  }

  const { data: latestSuspension } = await supabase
    .from("moderation_actions")
    .select("id")
    .eq("target_user_id", auth.userId)
    .eq("action", "suspend")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: insertError } = await supabase.from("suspension_appeals").insert({
    user_id: auth.userId,
    suspension_action_id: latestSuspension?.id ?? null,
    explanation,
    answers: {
      situation,
      improvementPlan,
    },
    id_photo_path: path,
  });

  if (insertError) {
    await supabase.storage.from("appeal-ids").remove([path]);
    return NextResponse.json(
      {
        ok: false,
        message:
          insertError.code === "23505"
            ? "You already have a submitted appeal waiting for admin review."
            : "CampusPress could not submit that appeal.",
      },
      { status: 400 },
    );
  }

  const { data: admins } = await supabase
    .from("profiles")
    .select("email")
    .eq("role", "admin")
    .limit(5);

  await Promise.all(
    (admins ?? []).map((admin) =>
      sendSuspensionAppealSubmittedEmail({
        to: admin.email,
        dashboardUrl: absoluteUrl("/dashboard/admin"),
      }),
    ),
  );

  return NextResponse.json({
    ok: true,
    message: "Appeal submitted. An administrator will review it in the dashboard.",
  });
}

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://campuspress-ai.vercel.app";
  return new URL(path, base).toString();
}
