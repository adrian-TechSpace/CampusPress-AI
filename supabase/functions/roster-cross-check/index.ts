import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const jsonHeaders = {
  "Content-Type": "application/json",
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, message: "Use POST to run the roster cross-check." }),
      { status: 405, headers: jsonHeaders },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "The roster cross-check could not start because server credentials are not configured.",
      }),
      { status: 500, headers: jsonHeaders },
    );
  }

  const payload = await request.json().catch(() => ({}));
  const targetProfileId =
    typeof payload.target_profile_id === "string" ? payload.target_profile_id : null;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc("run_roster_cross_check", {
    target_profile_id: targetProfileId,
  });

  if (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "The roster cross-check failed. Review the job log for details.",
      }),
      { status: 500, headers: jsonHeaders },
    );
  }

  return new Response(JSON.stringify({ ok: true, result: data }), {
    status: 200,
    headers: jsonHeaders,
  });
});
