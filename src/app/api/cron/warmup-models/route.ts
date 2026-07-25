import { NextResponse } from "next/server";
import { warmHuggingFaceModels } from "@/lib/analysis/providers/huggingface";
import { createServiceSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (secret && authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "Warmup cron is not authorized." }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  const startedAt = new Date().toISOString();

  try {
    const result = await warmHuggingFaceModels();
    const { error } = await supabase.from("job_run_log").insert({
      job_name: "warmup-models",
      status: "completed",
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      metadata: {
        schedule: "Vercel Hobby is limited to daily cron. Use an external pinger or Vercel Pro for every 30 minutes.",
        result,
      },
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    await supabase.from("job_run_log").insert({
      job_name: "warmup-models",
      status: "failed",
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : "Warmup failed for an unknown reason.",
      metadata: {
        schedule: "Vercel Hobby is limited to daily cron. Use an external pinger or Vercel Pro for every 30 minutes.",
      },
    });

    return NextResponse.json(
      { ok: false, message: "Warmup models did not complete.", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
