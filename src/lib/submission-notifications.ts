import type { SupabaseClient } from "@supabase/supabase-js";

type SubmittedArticle = {
  id: string;
  title: string;
  author_id: string;
  status: string;
};

type ProfileRow = {
  id: string;
};

type ExistingNotificationRow = {
  user_id: string;
};

export async function createEditorSubmissionNotifications(
  supabase: SupabaseClient,
  article: SubmittedArticle,
) {
  if (article.status !== "submitted") {
    return { notifiedEditors: 0 };
  }

  const { data: editors, error: editorsError } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "editor");

  if (editorsError) {
    throw editorsError;
  }

  const editorIds = ((editors ?? []) as ProfileRow[]).map((editor) => editor.id);
  if (editorIds.length === 0) {
    return { notifiedEditors: 0 };
  }

  const { data: existingNotifications, error: existingError } = await supabase
    .from("notifications")
    .select("user_id")
    .eq("article_id", article.id)
    .eq("type", "article_submitted")
    .in("user_id", editorIds);

  if (existingError) {
    throw existingError;
  }

  const alreadyNotified = new Set(
    ((existingNotifications ?? []) as ExistingNotificationRow[]).map((notification) => notification.user_id),
  );
  const missingEditorIds = editorIds.filter((editorId) => !alreadyNotified.has(editorId));

  if (missingEditorIds.length === 0) {
    return { notifiedEditors: 0 };
  }

  const { error: insertError } = await supabase.from("notifications").insert(
    missingEditorIds.map((editorId) => ({
      user_id: editorId,
      actor_id: article.author_id,
      article_id: article.id,
      type: "article_submitted",
      title: "New article submitted",
      body: `"${article.title}" is ready for editorial review.`,
    })),
  );

  if (insertError) {
    throw insertError;
  }

  return { notifiedEditors: missingEditorIds.length };
}
