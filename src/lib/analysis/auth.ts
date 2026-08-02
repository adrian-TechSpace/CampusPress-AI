import { authenticateActiveRequest } from "@/lib/account-enforcement";

type AnalysisProfile = {
  id: string;
  role: string;
  full_name: string;
};

export async function authenticateAnalysisRequest(request: Request) {
  const auth = await authenticateActiveRequest(request);
  if (!auth.ok) {
    return { userId: null, profile: null };
  }

  return {
    userId: auth.userId,
    profile: {
      id: auth.profile.id,
      role: auth.profile.role,
      full_name: auth.profile.full_name,
    } satisfies AnalysisProfile,
  };
}

export function canViewAnalysis(profile: AnalysisProfile | null) {
  return profile?.role === "editor" || profile?.role === "admin" || profile?.role === "subadmin";
}
