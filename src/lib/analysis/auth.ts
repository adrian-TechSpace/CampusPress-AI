import { createClient } from "@supabase/supabase-js";

type AnalysisProfile = {
  id: string;
  role: string;
  full_name: string;
};

export async function authenticateAnalysisRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!token || !url || !anonKey) {
    return { userId: null, profile: null };
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData.user?.id ?? null;
  if (!userId) {
    return { userId: null, profile: null };
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", userId)
    .single();

  return {
    userId,
    profile: (data ?? null) as AnalysisProfile | null,
  };
}

export function canViewAnalysis(profile: AnalysisProfile | null) {
  return profile?.role === "editor" || profile?.role === "admin";
}
