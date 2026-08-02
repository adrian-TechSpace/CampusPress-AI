"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlignLeft,
  AlertTriangle,
  ArchiveRestore,
  BarChart3,
  Bold,
  Bookmark,
  CheckCircle2,
  FileText,
  Heart,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  MessageCircle,
  Quote,
  RotateCcw,
  Send,
  WifiOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthenticatedShell } from "@/components/reader/authenticated-rail";
import { analyzeReadability, type GrammarIssue } from "@/lib/writing-analysis";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

type Profile = {
  id: string;
  role: string;
  full_name: string;
};

type DraftArticle = {
  id: string;
  title: string;
  excerpt: string | null;
  plain_text: string;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  category_id: string | null;
  content: {
    format?: string;
    body?: string;
    html?: string;
  } | null;
  status: string;
  slug: string;
  updated_at: string;
  submitted_at: string | null;
  published_at: string | null;
};

type SaveState = {
  tone: "neutral" | "success" | "error";
  message: string;
};

type AnalysisState = {
  active: boolean;
  stepIndex: number;
  tone: "neutral" | "success" | "error";
  message: string;
  reportUrl: string | null;
};

const queueKey = "campuspress_writer_offline_queue";
type DraftView = "active" | "archived" | "published";
type FormatKind = "heading" | "quote" | "bold" | "italic" | "unorderedList" | "orderedList";
type PublishedComment = {
  id: string;
  body: string;
  created_at: string;
};
type PublishedEngagementState = {
  loading: boolean;
  articleSlug: string | null;
  likeCount: number;
  bookmarkCount: number;
  comments: PublishedComment[];
  message: string;
};
type PublishedEngagementPayload = {
  ok: boolean;
  message?: string;
  counts?: {
    bookmarks: number;
    likes: number;
  };
  comments?: PublishedComment[];
};

type CategorySuggestion = {
  name: string;
  slug: string;
  reason: string;
};

export function WriterWorkspace() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<DraftArticle[]>([]);
  const [archivedDrafts, setArchivedDrafts] = useState<DraftArticle[]>([]);
  const [publishedArticles, setPublishedArticles] = useState<DraftArticle[]>([]);
  const [draftView, setDraftView] = useState<DraftView>("active");
  const [selectedPublishedArticle, setSelectedPublishedArticle] = useState<DraftArticle | null>(null);
  const [publishedEngagement, setPublishedEngagement] = useState<PublishedEngagementState>(() =>
    createEmptyPublishedEngagement(),
  );
  const [articleId, setArticleId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [richBody, setRichBody] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [categorySuggestion, setCategorySuggestion] = useState<CategorySuggestion | null>(null);
  const [categorySuggestionChecked, setCategorySuggestionChecked] = useState(false);
  const [suggestingCategory, setSuggestingCategory] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageAlt, setCoverImageAlt] = useState("");
  const [status, setStatus] = useState("draft");
  const [grammarIssues, setGrammarIssues] = useState<GrammarIssue[]>([]);
  const [grammarMessage, setGrammarMessage] = useState("Grammar feedback will appear as you write.");
  const [grammarSource, setGrammarSource] = useState("languagetool");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({
    tone: "neutral",
    message: "Drafts save automatically while you write.",
  });
  const [focused, setFocused] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<DraftArticle | null>(null);
  const [revealedDraft, setRevealedDraft] = useState<{
    id: string;
    action: "delete" | "archive";
  } | null>(null);
  const dragDraft = useRef<{ id: string; x: number } | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const articleIdRef = useRef<string | null>(null);
  const lastSavedSignature = useRef("");
  const saveTimer = useRef<number | null>(null);
  const saveInFlight = useRef(false);
  const suppressEditorRender = useRef(false);
  const bodyEditorRef = useRef<HTMLDivElement | null>(null);
  const inlineImageInputRef = useRef<HTMLInputElement | null>(null);
  const coverImageInputRef = useRef<HTMLInputElement | null>(null);
  const lastDecoratedSignature = useRef("");
  const [floatingToolbar, setFloatingToolbar] = useState<{
    visible: boolean;
    left: number;
    top: number;
  }>({ visible: false, left: 0, top: 0 });
  const [coverModalOpen, setCoverModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [coverCrop, setCoverCrop] = useState({ x: 50, y: 50, zoom: 1 });
  const [pendingSubmitAfterCover, setPendingSubmitAfterCover] = useState(false);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    active: false,
    stepIndex: 0,
    tone: "neutral",
    message: "AI analysis starts after submission.",
    reportUrl: null,
  });

  const readability = useMemo(() => analyzeReadability(body), [body]);
  const selectedCategory = categories.find((category) => category.id === categoryId) ?? null;
  const canSubmit =
    title.trim().length > 3 &&
    body.trim().split(/\s+/).length >= 80 &&
    (categories.length === 0 || Boolean(selectedCategory));
  const canSubmitForReview =
    canSubmit && !["submitted", "in_review", "approved"].includes(status);
  const analysisSteps = useMemo(
    () => [
      "Checking grammar and tone with OpenAI and LanguageTool...",
      "Scanning for fake-news and sentiment signals with HuggingFace models...",
      "Checking originality against published campus articles...",
      "Running rule-based credibility and readability checks...",
      "Verifying model claims against the article text...",
      "Preparing the editor-facing report...",
    ],
    [],
  );

  const loadCategories = useCallback(async () => {
    const { data } = await supabase
      .from("categories")
      .select("id, name, slug")
      .order("name", { ascending: true });
    const nextCategories = (data ?? []) as CategoryOption[];
    setCategories(nextCategories);
    setCategoryId((current) => current || nextCategories[0]?.id || "");
  }, [supabase]);

  const loadDrafts = useCallback(
    async (userId: string) => {
      const articleSelect =
        "id, title, excerpt, plain_text, content, featured_image_url, featured_image_alt, category_id, status, slug, updated_at, submitted_at, published_at";
      const [activeResult, archivedResult, publishedResult] = await Promise.all([
        supabase
          .from("articles")
          .select(articleSelect)
          .eq("author_id", userId)
          .not("status", "in", "(published,archived)")
          .order("updated_at", { ascending: false }),
        supabase
          .from("articles")
          .select(articleSelect)
          .eq("author_id", userId)
          .eq("status", "archived")
          .order("updated_at", { ascending: false }),
        supabase
          .from("articles")
          .select(articleSelect)
          .eq("author_id", userId)
          .eq("status", "published")
          .order("published_at", { ascending: false, nullsFirst: false }),
      ]);

      if (!activeResult.error) {
        setDrafts((activeResult.data ?? []) as DraftArticle[]);
      }
      if (!archivedResult.error) {
        setArchivedDrafts((archivedResult.data ?? []) as DraftArticle[]);
      }
      if (!publishedResult.error) {
        const nextPublishedArticles = (publishedResult.data ?? []) as DraftArticle[];
        setPublishedArticles(nextPublishedArticles);
        setSelectedPublishedArticle((current) => {
          if (!current) {
            return nextPublishedArticles[0] ?? null;
          }

          return nextPublishedArticles.find((article) => article.id === current.id) ?? nextPublishedArticles[0] ?? null;
        });
      }
    },
    [supabase],
  );

  const loadPublishedEngagement = useCallback(async (article: DraftArticle | null) => {
    if (!article) {
      setPublishedEngagement(createEmptyPublishedEngagement());
      return;
    }

    setPublishedEngagement((current) => ({
      ...current,
      loading: true,
      articleSlug: article.slug,
      message: "Loading live article engagement...",
    }));

    const response = await fetch(`/api/articles/${encodeURIComponent(article.slug)}/engagement`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({
      ok: false,
      message: "CampusPress could not load engagement for this article.",
    }))) as PublishedEngagementPayload;

    if (!payload.ok) {
      setPublishedEngagement({
        loading: false,
        articleSlug: article.slug,
        likeCount: 0,
        bookmarkCount: 0,
        comments: [],
        message: payload.message ?? "CampusPress could not load engagement for this article.",
      });
      return;
    }

    setPublishedEngagement({
      loading: false,
      articleSlug: article.slug,
      likeCount: payload.counts?.likes ?? 0,
      bookmarkCount: payload.counts?.bookmarks ?? 0,
      comments: payload.comments ?? [],
      message: "Live engagement loaded.",
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", userId)
        .single();

      if (!active) {
        return;
      }

      setProfile((data ?? null) as Profile | null);
      if (data?.id) {
        await loadCategories();
        await loadDrafts(data.id);
      }
      setLoading(false);
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [loadCategories, loadDrafts, supabase]);

  useEffect(() => {
    if (draftView !== "published") {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadPublishedEngagement(selectedPublishedArticle);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [draftView, loadPublishedEngagement, selectedPublishedArticle]);

  useEffect(() => {
    const text = body.trim();

    if (text.length < 12) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const response = await fetch("/api/writing/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      }).catch(() => null);

      if (!response) {
        return;
      }

      const result = (await response.json()) as {
        source: string;
        issues: GrammarIssue[];
        message: string;
      };
      setGrammarIssues(result.issues ?? []);
      setGrammarSource(result.source);
      setGrammarMessage(result.message);
    }, 1200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [body]);

  useEffect(() => {
    const editor = bodyEditorRef.current;
    if (!editor || suppressEditorRender.current) {
      suppressEditorRender.current = false;
      return;
    }

    const signature = JSON.stringify({ richBody, issues: grammarIssues });
    if (signature === lastDecoratedSignature.current) {
      return;
    }

    const selection = getEditorSelectionOffsets(editor);
    editor.innerHTML = decorateRichHtml(richBody, grammarIssues);
    lastDecoratedSignature.current = signature;

    if (selection) {
      restoreEditorSelection(editor, selection.start, selection.end);
    }
  }, [richBody, grammarIssues]);

  async function flushQueuedDraft() {
    const raw = window.localStorage.getItem(queueKey);
    if (!raw) {
      return;
    }

    const queued = JSON.parse(raw) as {
      articleId: string | null;
      title: string;
      excerpt: string;
      body: string;
      richBody?: string;
      status: string;
      categoryId?: string;
      coverImageUrl?: string;
      coverImageAlt?: string;
    };
    window.localStorage.removeItem(queueKey);
    setTitle(queued.title);
    setExcerpt(queued.excerpt);
    setBody(queued.body);
      setRichBody(queued.richBody ?? plainTextToHtml(queued.body));
    setCategoryId(queued.categoryId ?? categories[0]?.id ?? "");
    setCoverImageUrl(queued.coverImageUrl ?? "");
    setCoverImageAlt(queued.coverImageAlt ?? "");
    articleIdRef.current = queued.articleId;
    setArticleId(queued.articleId);
    await saveDraft("autosave", queued);
  }

  async function saveDraft(
    reason: "autosave" | "manual" | "submit",
    queued?: {
      articleId: string | null;
      title: string;
      excerpt: string;
      body: string;
      richBody?: string;
      status: string;
      categoryId?: string;
      coverImageUrl?: string;
      coverImageAlt?: string;
    },
  ) {
    const currentProfile = profile;

    if (!currentProfile || currentProfile.role !== "journalist") {
      return;
    }

    const draft = queued ?? {
      articleId: articleIdRef.current,
      title,
      excerpt,
      body,
      richBody,
      status,
      categoryId,
      coverImageUrl,
      coverImageAlt,
    };
    const cleanTitle = draft.title.trim() || "Untitled draft";
    const cleanBody = draft.body.trim();
    const cleanRichBody = sanitizeEditorHtml(draft.richBody ?? plainTextToHtml(cleanBody));
    const nextStatus = reason === "submit" ? "submitted" : draft.status || "draft";
    const meaningful = hasMeaningfulDraft(draft.title, cleanBody, cleanRichBody);

    if (!meaningful && reason === "autosave") {
      return;
    }

    if (!meaningful && reason === "manual") {
      setSaveState({
        tone: "neutral",
        message: "Add a headline or body text before saving.",
      });
      return;
    }

    const signature = JSON.stringify({
      articleId: draft.articleId,
      title: cleanTitle,
      excerpt: draft.excerpt,
      body: cleanBody,
      richBody: cleanRichBody,
      status: nextStatus,
      categoryId: draft.categoryId ?? "",
      coverImageUrl: draft.coverImageUrl ?? "",
      coverImageAlt: draft.coverImageAlt ?? "",
    });

    if (reason === "autosave" && signature === lastSavedSignature.current) {
      return;
    }

    if (saveInFlight.current && reason === "autosave") {
      return;
    }

    if (!navigator.onLine) {
      window.localStorage.setItem(queueKey, JSON.stringify(draft));
      setSaveState({
        tone: "error",
        message: "You are offline. This draft is queued on this device and will sync when online.",
      });
      return;
    }

    setSaving(true);
    saveInFlight.current = true;
    setSaveState({
      tone: "neutral",
      message:
        reason === "submit"
          ? "Submitting your article for review..."
          : "Saving your latest draft...",
    });

    const payload = {
      author_id: currentProfile.id,
      title: cleanTitle,
      slug: draft.articleId ? undefined : `${slugify(cleanTitle)}-${uniqueTimestampSuffix()}`,
      excerpt: draft.excerpt.trim() || null,
      content: {
        format: "rich-html-v1",
        html: cleanRichBody,
        body: cleanBody,
      },
      plain_text: cleanBody,
      featured_image_url: draft.coverImageUrl || null,
      featured_image_alt: draft.coverImageAlt || null,
      category_id: draft.categoryId || null,
      status: nextStatus,
      submitted_at: reason === "submit" ? new Date().toISOString() : null,
    };

    const request = draft.articleId
      ? supabase.from("articles").update(payload).eq("id", draft.articleId).select("id, status").single()
      : supabase.from("articles").insert(payload).select("id, status").single();
    const { data, error } = await request;

    setSaving(false);
    saveInFlight.current = false;

    if (error) {
      window.localStorage.setItem(queueKey, JSON.stringify(draft));
      setSaveState({
        tone: "error",
        message: "CampusPress could not reach the database. Your draft is queued on this device.",
      });
      return;
    }

    articleIdRef.current = data.id;
    setArticleId(data.id);
    setStatus(data.status);
    lastSavedSignature.current = signature;
    await loadDrafts(currentProfile.id);
    setSaveState({
      tone: "success",
      message:
        reason === "submit"
          ? "Article submitted for editorial review."
          : "Draft saved to CampusPress.",
    });

    if (reason === "submit") {
      setPreviewOpen(true);
      void runSubmittedAnalysis(data.id);
    }
  }

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void flushQueuedDraft();
    };
    const handleOffline = () => {
      setOnline(false);
      setSaveState({
        tone: "error",
        message: "Connection dropped. Drafts will queue on this device until you are online.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // This listener is reattached with the current editor state so queued drafts sync accurately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, articleId, title, excerpt, body, categoryId, richBody, status]);

  useEffect(() => {
    if (!profile || profile.role !== "journalist") {
      return;
    }

    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }

    saveTimer.current = window.setTimeout(() => {
      void saveDraft("autosave");
    }, 1600);

    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
    };
    // saveDraft reads the latest editor state from this render and is intentionally debounced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, categoryId, excerpt, profile, richBody, title]);

  async function runSubmittedAnalysis(submittedArticleId: string) {
    setAnalysisState({
      active: true,
      stepIndex: 0,
      tone: "neutral",
      message: analysisSteps[0],
      reportUrl: null,
    });

    const interval = window.setInterval(() => {
      setAnalysisState((current) => {
        if (!current.active) {
          return current;
        }
        const nextStep = Math.min(current.stepIndex + 1, analysisSteps.length - 1);
        return {
          ...current,
          stepIndex: nextStep,
          message: analysisSteps[nextStep],
        };
      });
    }, 4500);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error("Sign in again before requesting AI analysis.");
      }

      const response = await fetch("/api/analysis/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ articleId: submittedArticleId }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        reportUrl?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "AI analysis did not complete.");
      }

      setAnalysisState({
        active: false,
        stepIndex: analysisSteps.length - 1,
        tone: "success",
        message: "AI analysis completed. Editors can open the full report.",
        reportUrl: result.reportUrl ?? null,
      });
    } catch (error) {
      setAnalysisState({
        active: false,
        stepIndex: analysisSteps.length - 1,
        tone: "error",
        message: error instanceof Error ? error.message : "AI analysis did not complete.",
        reportUrl: null,
      });
    } finally {
      window.clearInterval(interval);
    }
  }

  async function deleteDraft(article: DraftArticle) {
    if (!profile || article.status === "published") {
      return;
    }

    setSaving(true);
    setSaveState({
      tone: "neutral",
      message: `Deleting "${article.title}"...`,
    });

    const { data, error } = await supabase
      .from("articles")
      .delete()
      .eq("id", article.id)
      .neq("status", "published")
      .select("id");

    setSaving(false);
    setDeleteCandidate(null);

    if (error || !data?.length) {
      setSaveState({
        tone: "error",
        message: "CampusPress could not delete that draft. It may already be published or unavailable.",
      });
      return;
    }

    if (article.id === articleId) {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
      articleIdRef.current = null;
      setArticleId(null);
      setTitle("");
      setExcerpt("");
      setBody("");
      setRichBody("");
      setCategoryId(categories[0]?.id ?? "");
      resetCategorySuggestion();
      setCoverImageUrl("");
      setCoverImageAlt("");
      setStatus("draft");
    }

    await loadDrafts(profile.id);
    setSaveState({
      tone: "success",
      message: "Draft deleted from CampusPress.",
    });
  }

  async function archiveDraft(article: DraftArticle) {
    if (!profile || article.status === "published") {
      return;
    }

    setSaving(true);
    setSaveState({ tone: "neutral", message: `Archiving ${article.title}...` });
    const { data, error } = await supabase
      .from("articles")
      .update({ status: "archived" })
      .eq("id", article.id)
      .neq("status", "published")
      .select("id");
    setSaving(false);
    setRevealedDraft(null);

    if (error || !data?.length) {
      setSaveState({
        tone: "error",
        message: "CampusPress could not archive that draft. It may already be published or unavailable.",
      });
      return;
    }

    if (article.id === articleId) {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
      }
      articleIdRef.current = null;
      setArticleId(null);
      setTitle("");
      setExcerpt("");
      setBody("");
      setRichBody("");
      setCategoryId(categories[0]?.id ?? "");
      resetCategorySuggestion();
      setCoverImageUrl("");
      setCoverImageAlt("");
      setStatus("draft");
    }

    await loadDrafts(profile.id);
    setSaveState({ tone: "success", message: "Draft archived." });
  }

  async function restoreArchivedDraft(article: DraftArticle) {
    if (!profile || article.status !== "archived") {
      return;
    }

    setSaving(true);
    setSaveState({ tone: "neutral", message: `Restoring ${article.title}...` });
    const { data, error } = await supabase
      .from("articles")
      .update({ status: "draft", submitted_at: null, reviewed_at: null })
      .eq("id", article.id)
      .eq("status", "archived")
      .select("id");
    setSaving(false);

    if (error || !data?.length) {
      setSaveState({
        tone: "error",
        message: "CampusPress could not restore that archived draft.",
      });
      return;
    }

    await loadDrafts(profile.id);
    setDraftView("active");
    setSaveState({ tone: "success", message: "Archived draft restored." });
  }

  function handleDraftPointerDown(articleIdValue: string, clientX: number) {
    dragDraft.current = { id: articleIdValue, x: clientX };
  }

  function handleDraftPointerUp(article: DraftArticle, clientX: number) {
    if (!dragDraft.current || dragDraft.current.id !== article.id) {
      return;
    }

    const delta = clientX - dragDraft.current.x;
    dragDraft.current = null;

    if (delta > 48) {
      setRevealedDraft({ id: article.id, action: "archive" });
    } else if (delta < -48) {
      setRevealedDraft({ id: article.id, action: "delete" });
    }
  }

  async function requestCategorySuggestion() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return null;
    }

    setSuggestingCategory(true);
    const response = await fetch("/api/writing/category-suggestion", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, excerpt, body }),
    }).catch(() => null);
    setSuggestingCategory(false);

    if (!response?.ok) {
      return null;
    }

    const result = (await response.json().catch(() => ({}))) as {
      suggestion?: CategorySuggestion | null;
    };
    setCategorySuggestion(result.suggestion ?? null);
    return result.suggestion ?? null;
  }

  function acceptCategorySuggestion() {
    if (!categorySuggestion) {
      return;
    }

    const matched = categories.find(
      (category) => category.slug === categorySuggestion.slug || category.name === categorySuggestion.name,
    );
    if (matched) {
      setCategoryId(matched.id);
      setCategorySuggestionChecked(true);
      setCategorySuggestion(null);
      setSaveState({
        tone: "success",
        message: `Category set to ${matched.name}.`,
      });
    }
  }

  async function handleSubmitForReview() {
    if (!categorySuggestionChecked) {
      const suggestion = await requestCategorySuggestion();
      setCategorySuggestionChecked(true);
      if (suggestion) {
        setSaveState({
          tone: "neutral",
          message: "AI suggestion available. Accept it or keep your selected category, then submit again.",
        });
        return;
      }
    }

    if (!coverImageUrl) {
      setPendingSubmitAfterCover(true);
      setCoverModalOpen(true);
      return;
    }

    void saveDraft("submit");
  }

  async function uploadInlineImage(file: File) {
    const url = await uploadImageFile(file);
    if (!url) {
      return;
    }

    const editor = bodyEditorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    document.execCommand(
      "insertHTML",
      false,
      `<figure data-inline-image="true"><img src="${escapeAttribute(url)}" alt="${escapeAttribute(
        file.name.replace(/\.[^.]+$/, ""),
      )}"><figcaption>${escapeHtml(file.name)}</figcaption></figure><p><br></p>`,
    );
    syncEditorState();
    setSaveState({
      tone: "success",
      message: "Image uploaded and inserted into the draft.",
    });
  }

  async function uploadImageFile(file: File) {
    if (!profile) {
      return null;
    }

    setSaving(true);
    setSaveState({ tone: "neutral", message: "Uploading image..." });

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeName = file.name
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-|-$/g, "");
    const path = `${profile.id}/${uniqueTimestampSuffix()}-${safeName || `image.${extension}`}`;
    const { error } = await supabase.storage.from("article-images").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

    setSaving(false);

    if (error) {
      setSaveState({
        tone: "error",
        message: "CampusPress could not upload that image. Use JPG, PNG, or WebP under 5 MB.",
      });
      return null;
    }

    const { data } = supabase.storage.from("article-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function confirmCoverImage() {
    if (!coverFile) {
      setSaveState({
        tone: "error",
        message: "Choose a cover image before confirming.",
      });
      return;
    }

    const cropped = await cropCoverImage(coverFile, coverCrop);
    const url = await uploadImageFile(cropped);

    if (!url) {
      return;
    }

    setCoverImageUrl(url);
    setCoverImageAlt(coverImageAlt || "Article cover image");
    setCoverModalOpen(false);
    setCoverFile(null);
    setCoverPreviewUrl("");
    setSaveState({ tone: "success", message: "Cover image uploaded." });

    if (pendingSubmitAfterCover) {
      setPendingSubmitAfterCover(false);
      window.setTimeout(() => void saveDraft("submit", {
        articleId: articleIdRef.current,
        title,
        excerpt,
        body,
        richBody,
        status,
        categoryId,
        coverImageUrl: url,
        coverImageAlt: coverImageAlt || "Article cover image",
      }), 0);
    }
  }

  function loadArticle(article: DraftArticle) {
    setArticleId(article.id);
    articleIdRef.current = article.id;
    setTitle(article.title);
    setExcerpt(article.excerpt ?? "");
    setBody(article.plain_text);
    setRichBody(article.content?.html ?? plainTextToHtml(article.plain_text));
    setCategoryId(article.category_id ?? categories[0]?.id ?? "");
    resetCategorySuggestion();
    setCoverImageUrl(article.featured_image_url ?? "");
    setCoverImageAlt(article.featured_image_alt ?? "");
    setStatus(article.status);
    setSaveState({
      tone: "neutral",
      message:
        article.status === "revision_requested"
          ? "An editor requested revision. Update the draft and submit again."
          : "Draft loaded.",
    });
  }

  function syncEditorState() {
    const editor = bodyEditorRef.current;
    if (!editor) {
      return "";
    }

    const cleanHtml = sanitizeEditorHtml(editor.innerHTML);
    const plain = extractPlainTextFromHtml(cleanHtml);
    suppressEditorRender.current = true;
    setRichBody(cleanHtml);
    setBody(plain);
    return plain;
  }

  function resetCategorySuggestion() {
    setCategorySuggestion(null);
    setCategorySuggestionChecked(false);
  }

  function handleBodyInput() {
    const value = syncEditorState();
    resetCategorySuggestion();

    if (value.trim().length < 12) {
      setGrammarIssues([]);
      setGrammarMessage("Write a little more before grammar feedback starts.");
    }

    updateFloatingToolbar();
  }

  function applyFormat(kind: FormatKind) {
    const editor = bodyEditorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    ensureSelectionInEditor(editor);

    if (kind === "heading") {
      document.execCommand("formatBlock", false, "h2");
    } else if (kind === "quote") {
      document.execCommand("formatBlock", false, "blockquote");
    } else if (kind === "unorderedList") {
      document.execCommand("insertUnorderedList");
    } else if (kind === "orderedList") {
      document.execCommand("insertOrderedList");
    } else if (kind === "bold") {
      document.execCommand("bold");
    } else {
      document.execCommand("italic");
    }

    syncEditorState();
    setFloatingToolbar({ visible: false, left: 0, top: 0 });
  }

  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const mod = event.ctrlKey || event.metaKey;

    if (!mod) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      applyFormat("bold");
    } else if (key === "i") {
      event.preventDefault();
      applyFormat("italic");
    } else if (event.altKey && key === "1") {
      event.preventDefault();
      applyFormat("heading");
    } else if (event.shiftKey && key === "9") {
      event.preventDefault();
      applyFormat("quote");
    }
  }

  function updateFloatingToolbar() {
    const editor = bodyEditorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setFloatingToolbar({ visible: false, left: 0, top: 0 });
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      setFloatingToolbar({ visible: false, left: 0, top: 0 });
      return;
    }

    const rect = range.getBoundingClientRect();
    setFloatingToolbar({
      visible: true,
      left: Math.max(rect.left + rect.width / 2 - 120, 12),
      top: Math.max(rect.top - 48, 72),
    });
  }

  if (loading) {
    return <WriterShell message="Loading your writing desk..." />;
  }

  if (!profile) {
    return (
      <WriterShell message="Sign in or create a student journalist account to draft stories.">
        <Link
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          href="/auth"
        >
          Go to auth
        </Link>
      </WriterShell>
    );
  }

  if (profile.role !== "journalist") {
    return (
      <WriterShell message="This writing desk is for student journalist accounts.">
        <Link
          className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium"
          href="/feed"
        >
          Return to reader feed
        </Link>
      </WriterShell>
    );
  }

  return (
    <AuthenticatedShell>
      <section
        className={
          focused
            ? "mx-auto grid max-w-5xl gap-8 px-6 py-8 md:px-12"
            : "mx-auto grid max-w-7xl gap-8 px-6 py-8 md:px-12 lg:grid-cols-[18rem_1fr] lg:px-24"
        }
      >
        <aside
          className={
            focused
              ? "hidden"
              : "grid content-start gap-6 border-b pb-6 lg:block lg:border-b-0 lg:border-r lg:pr-6"
          }
        >
          <div className="grid gap-3">
            <p className="text-sm font-semibold text-primary">CampusPress AI</p>
            <h1 className="font-serif text-4xl font-semibold">Writing desk</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Draft, save, and submit campus stories with live editorial feedback.
            </p>
          </div>

          <div className="mt-6 grid gap-3">
            <Button
              onClick={() => {
                setArticleId(null);
                articleIdRef.current = null;
                setTitle("");
                setExcerpt("");
                setBody("");
                setRichBody("");
                setCategoryId(categories[0]?.id ?? "");
                resetCategorySuggestion();
                setCoverImageUrl("");
                setCoverImageAlt("");
                setStatus("draft");
                setDraftView("active");
                setSaveState({
                  tone: "neutral",
                  message: "New draft ready.",
                });
              }}
              type="button"
              variant="outline"
            >
              <FileText aria-hidden />
              New draft
            </Button>
            <Button disabled={saving} onClick={() => saveDraft("manual")} type="button">
              {saving ? "Saving..." : "Save now"}
            </Button>
          </div>

          <div className="mt-8 grid gap-4">
            <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Writer article views">
              {[
                { label: "Active", value: "active" },
                { label: "Archived", value: "archived" },
                { label: "Published", value: "published" },
              ].map((item) => (
                <button
                  aria-selected={draftView === item.value}
                  className={
                    draftView === item.value
                      ? "rounded-md border bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                      : "rounded-md border bg-background px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                  }
                  key={item.value}
                  onClick={() => setDraftView(item.value as DraftView)}
                  role="tab"
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {draftView === "active" ? (
              <div className="grid gap-3">
                <p className="text-sm font-semibold">Your active drafts</p>
                {drafts.length === 0 ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    No drafts yet. Start with a clear headline and one reported fact.
                  </p>
                ) : (
                  drafts.map((article) => (
                    <div
                      className="relative overflow-hidden rounded-md border bg-muted text-sm shadow-sm"
                      data-testid={`draft-row-${article.id}`}
                      key={article.id}
                    >
                      <div className="absolute inset-y-0 left-0 flex items-center px-3">
                        <button
                          className="rounded-md bg-card px-3 py-2 text-sm font-semibold"
                          onClick={() => archiveDraft(article)}
                          type="button"
                        >
                          Archive
                        </button>
                      </div>
                      <div className="absolute inset-y-0 right-0 flex items-center px-3">
                        <button
                          className="rounded-md bg-card px-3 py-2 text-sm font-semibold text-destructive"
                          onClick={() => setDeleteCandidate(article)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                      <div
                        className="grid gap-2 bg-card p-3 transition-transform"
                        onPointerDown={(event) => handleDraftPointerDown(article.id, event.clientX)}
                        onPointerUp={(event) => handleDraftPointerUp(article, event.clientX)}
                        style={{
                          transform:
                            revealedDraft?.id === article.id
                              ? revealedDraft.action === "archive"
                                ? "translateX(5.5rem)"
                                : "translateX(-5.5rem)"
                              : "translateX(0)",
                        }}
                      >
                        <button className="grid gap-2 text-left" onClick={() => loadArticle(article)} type="button">
                          <span className="font-semibold">{article.title}</span>
                          <span className="text-muted-foreground">{statusLabel(article.status)}</span>
                        </button>
                        <p className="text-xs text-muted-foreground md:hidden">
                          Swipe right to archive or left to delete.
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {draftView === "archived" ? (
              <div className="grid gap-3">
                <p className="text-sm font-semibold">Your archived drafts</p>
                {archivedDrafts.length === 0 ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    No archived drafts yet.
                  </p>
                ) : (
                  archivedDrafts.map((article) => (
                    <div className="grid gap-3 rounded-md border bg-card p-3 text-sm" key={article.id}>
                      <button className="grid gap-2 text-left" onClick={() => loadArticle(article)} type="button">
                        <span className="font-semibold">{article.title}</span>
                        <span className="text-muted-foreground">
                          {statusLabel(article.status)}. Updated {formatDateTime(article.updated_at)}
                        </span>
                      </button>
                      <Button
                        disabled={saving}
                        onClick={() => restoreArchivedDraft(article)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <ArchiveRestore aria-hidden className="size-4" />
                        Restore draft
                      </Button>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {draftView === "published" ? (
              <div className="grid gap-3">
                <p className="text-sm font-semibold">Your published articles</p>
                {publishedArticles.length === 0 ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    No published articles yet.
                  </p>
                ) : (
                  publishedArticles.map((article) => (
                    <button
                      className={
                        selectedPublishedArticle?.id === article.id
                          ? "grid gap-2 rounded-md border border-primary bg-card p-3 text-left text-sm"
                          : "grid gap-2 rounded-md border bg-card p-3 text-left text-sm hover:border-primary"
                      }
                      key={article.id}
                      onClick={() => {
                        setSelectedPublishedArticle(article);
                        setDraftView("published");
                      }}
                      type="button"
                    >
                      <span className="font-semibold">{article.title}</span>
                      <span className="text-muted-foreground">
                        Published {formatDateTime(article.published_at ?? article.updated_at)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </aside>

        <div className="grid gap-6">
          {draftView === "published" ? (
            <PublishedArticleDetail
              article={selectedPublishedArticle}
              engagement={publishedEngagement}
              onRefresh={() => loadPublishedEngagement(selectedPublishedArticle)}
            />
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border px-3 py-2 text-sm font-semibold">
                {statusLabel(status)}
              </span>
              {!online ? (
                <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold text-destructive">
                  <WifiOff aria-hidden className="size-4" />
                  Offline queue active
                </span>
              ) : null}
            </div>
            <Button
              disabled={!hasMeaningfulDraft(title, body, richBody)}
              onClick={() => setPreviewOpen(true)}
              type="button"
              variant="outline"
            >
              Preview
            </Button>
            <Button
              disabled={!canSubmitForReview || saving}
              onClick={handleSubmitForReview}
              type="button"
            >
              <Send aria-hidden />
              {status === "submitted" ? "Submitted" : "Submit for review"}
            </Button>
          </div>

          {analysisState.tone !== "neutral" || analysisState.active ? (
            <section
              className={
                analysisState.tone === "error"
                  ? "grid gap-3 rounded-md border border-destructive/30 bg-card p-4"
                  : "grid gap-3 rounded-md border bg-card p-4"
              }
              data-testid="analysis-progress"
            >
              <div className="flex items-start gap-3">
                {analysisState.tone === "success" ? (
                  <CheckCircle2 aria-hidden className="mt-1 size-5 text-primary" />
                ) : analysisState.tone === "error" ? (
                  <AlertTriangle aria-hidden className="mt-1 size-5 text-destructive" />
                ) : (
                  <span className="mt-2 size-2 rounded-full bg-primary" aria-hidden />
                )}
                <div className="grid gap-2">
                  <h2 className="text-sm font-semibold">AI analysis</h2>
                  <p
                    className={
                      analysisState.tone === "error"
                        ? "text-sm leading-6 text-destructive"
                        : "text-sm leading-6 text-muted-foreground"
                    }
                    role="status"
                  >
                    {analysisState.message}
                  </p>
                  {analysisState.active ? (
                    <ol className="grid gap-1 text-xs text-muted-foreground">
                      {analysisSteps.map((step, index) => (
                        <li
                          className={index <= analysisState.stepIndex ? "font-semibold text-foreground" : ""}
                          key={step}
                        >
                          {step}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {analysisState.reportUrl ? (
                    <Link className="text-sm font-semibold text-primary" href={analysisState.reportUrl}>
                      Open editor report
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {status === "revision_requested" ? (
            <div className="rounded-md border bg-card p-4 text-sm leading-6">
              An editor requested revision. Update the story, address the note in your messages,
              then submit again.
            </div>
          ) : null}

          <section className="grid gap-4">
            <textarea
              className="min-h-24 resize-none border-0 bg-background px-0 font-serif text-4xl font-semibold leading-tight shadow-none outline-none focus-visible:ring-0"
              onBlur={() => setFocused(false)}
              onChange={(event) => {
                setTitle(event.target.value);
                resetCategorySuggestion();
              }}
              onFocus={() => setFocused(true)}
              placeholder="Headline"
              value={title}
            />
            <Input
              className="border-0 px-0 text-base shadow-none focus-visible:ring-0"
              onChange={(event) => {
                setExcerpt(event.target.value);
                resetCategorySuggestion();
              }}
              placeholder="One-sentence summary for editors and readers"
              value={excerpt}
            />

            <div className="grid gap-3 rounded-md border bg-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <label className="grid flex-1 gap-2 text-sm font-semibold">
                  Category
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onChange={(event) => {
                      setCategoryId(event.target.value);
                      resetCategorySuggestion();
                    }}
                    value={categoryId}
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  disabled={suggestingCategory || title.trim().length < 3}
                  onClick={async () => {
                    const suggestion = await requestCategorySuggestion();
                    setCategorySuggestionChecked(true);
                    if (suggestion) {
                      setSaveState({
                        tone: "neutral",
                        message: "AI suggestion available. Accept it or keep your selected category.",
                      });
                    }
                  }}
                  type="button"
                  variant="outline"
                >
                  {suggestingCategory ? "Checking..." : "Suggest category"}
                </Button>
              </div>
              {categorySuggestion ? (
                <div className="grid gap-3 rounded-md border bg-background p-3 text-sm leading-6">
                  <p>
                    <span className="font-semibold">AI suggestion:</span> {categorySuggestion.name}
                  </p>
                  <p className="text-muted-foreground">{categorySuggestion.reason}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={acceptCategorySuggestion} size="sm" type="button">
                      Accept suggestion
                    </Button>
                    <Button onClick={() => setCategorySuggestion(null)} size="sm" type="button" variant="outline">
                      Keep selected category
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 border-y py-3" data-testid="writer-format-toolbar">
              <Button
                onClick={() => applyFormat("heading")}
                onMouseDown={(event) => event.preventDefault()}
                size="sm"
                type="button"
                variant="outline"
              >
                <AlignLeft aria-hidden />
                Heading
              </Button>
              <Button
                onClick={() => applyFormat("bold")}
                onMouseDown={(event) => event.preventDefault()}
                size="sm"
                type="button"
                variant="outline"
              >
                <Bold aria-hidden />
                Bold
              </Button>
              <Button
                onClick={() => applyFormat("italic")}
                onMouseDown={(event) => event.preventDefault()}
                size="sm"
                type="button"
                variant="outline"
              >
                <Italic aria-hidden />
                Italic
              </Button>
              <Button
                onClick={() => applyFormat("quote")}
                onMouseDown={(event) => event.preventDefault()}
                size="sm"
                type="button"
                variant="outline"
              >
                <Quote aria-hidden />
                Quote
              </Button>
              <Button
                onClick={() => applyFormat("unorderedList")}
                onMouseDown={(event) => event.preventDefault()}
                size="sm"
                type="button"
                variant="outline"
              >
                <List aria-hidden />
                Bullet list
              </Button>
              <Button
                onClick={() => applyFormat("orderedList")}
                onMouseDown={(event) => event.preventDefault()}
                size="sm"
                type="button"
                variant="outline"
              >
                <ListOrdered aria-hidden />
                Numbered list
              </Button>
              <Button
                onClick={() => inlineImageInputRef.current?.click()}
                onMouseDown={(event) => event.preventDefault()}
                size="sm"
                type="button"
                variant="outline"
              >
                <ImageIcon aria-hidden />
                Insert image
              </Button>
              <Button
                data-testid="cover-image-button"
                onClick={() => setCoverModalOpen(true)}
                onMouseDown={(event) => event.preventDefault()}
                size="sm"
                type="button"
                variant="outline"
              >
                <ImageIcon aria-hidden />
                Cover image
              </Button>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void uploadInlineImage(file);
                  }
                  event.target.value = "";
                }}
                ref={inlineImageInputRef}
                type="file"
              />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Shortcuts: Ctrl or Cmd plus B for bold, Ctrl or Cmd plus I for italic,
              Ctrl or Cmd plus Alt plus 1 for heading, Ctrl or Cmd plus Shift plus 9
              for quote.
            </p>
            {coverImageUrl ? (
              <div className="grid gap-3 rounded-md border bg-card p-3 text-sm text-muted-foreground">
                <p>
                  Cover image set. It will appear in the submission preview and reader
                  page after publication.
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={coverImageAlt || "Article cover image"}
                  className="aspect-video w-full max-w-xl rounded-md object-cover"
                  src={coverImageUrl}
                />
              </div>
            ) : (
              <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
                A cover image is required before submission. Recommended size:
                1600 by 900 pixels.
              </div>
            )}

            <div
              aria-label="Article body"
              className="writer-rich-editor min-h-dvh rounded-md border-0 bg-background p-0 text-lg leading-8 outline-none focus:ring-0"
              contentEditable
              id="article-body"
              onBlur={() => setFocused(false)}
              onInput={handleBodyInput}
              onKeyDown={handleEditorKeyDown}
              onKeyUp={updateFloatingToolbar}
              onMouseUp={updateFloatingToolbar}
              onFocus={() => setFocused(true)}
              ref={bodyEditorRef}
              role="textbox"
              suppressContentEditableWarning
            />
          </section>

          <section className="grid gap-6 border-t pt-6 xl:grid-cols-[1fr_22rem]">
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Inline grammar view</h2>
                <p className="text-sm text-muted-foreground">
                  {grammarSource === "languagetool" ? "LanguageTool" : "Local fallback"}
                </p>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{grammarMessage}</p>
              <MarkedText issues={grammarIssues} text={body} />
            </div>

            <div className="grid content-start gap-4 rounded-md border bg-card p-4 shadow-sm">
              <h2 className="text-lg font-semibold">Readability</h2>
              <Metric label="Flesch-Kincaid grade" value={readability.grade.toString()} />
              <Metric label="Reading ease" value={readability.readingEase.toString()} />
              <Metric label="Words" value={readability.words.toString()} />
              <p className="text-sm leading-6 text-muted-foreground">{readability.label}</p>
              <p
                className={
                  saveState.tone === "error"
                    ? "text-sm font-semibold text-destructive"
                    : saveState.tone === "success"
                      ? "text-sm font-semibold text-primary"
                      : "text-sm text-muted-foreground"
                }
                role="status"
              >
                {saveState.message}
              </p>
            </div>
          </section>
        </div>
      </section>
      {deleteCandidate ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 px-6 backdrop-blur">
          <section className="grid max-w-md gap-5 rounded-md border bg-card p-6 shadow-sm">
            <div className="grid gap-2">
              <h2 className="text-xl font-semibold">Delete this draft?</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                This removes {deleteCandidate.title} from CampusPress. Published
                articles cannot be deleted from this screen.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button onClick={() => setDeleteCandidate(null)} type="button" variant="outline">
                Keep draft
              </Button>
              <Button onClick={() => deleteDraft(deleteCandidate)} type="button">
                Delete draft
              </Button>
            </div>
          </section>
        </div>
      ) : null}
      {coverModalOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-background/80 px-6 py-10 backdrop-blur"
          data-testid="cover-image-modal"
        >
          <section className="grid w-full max-w-2xl gap-5 rounded-md border bg-card p-6 shadow-sm">
            <div className="grid gap-2">
              <h2 className="text-xl font-semibold">Choose a cover image</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Use a JPG, PNG, or WebP image under 5 MB. Recommended cover size is
                1600 by 900 pixels, wide enough for reader previews and social cards.
              </p>
            </div>
            <input
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                setCoverFile(file);
                setCoverPreviewUrl(URL.createObjectURL(file));
                setCoverImageAlt(file.name.replace(/\.[^.]+$/, ""));
              }}
              ref={coverImageInputRef}
              type="file"
            />
            {coverPreviewUrl ? (
              <div className="grid gap-4">
                <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Cover crop preview"
                    className="size-full object-cover"
                    src={coverPreviewUrl}
                    style={{
                      objectPosition: `${coverCrop.x}% ${coverCrop.y}%`,
                      transform: `scale(${coverCrop.zoom})`,
                    }}
                  />
                </div>
                <label className="grid gap-2 text-sm font-semibold">
                  Alt text
                  <Input
                    onChange={(event) => setCoverImageAlt(event.target.value)}
                    value={coverImageAlt}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Horizontal crop
                  <input
                    max="100"
                    min="0"
                    onChange={(event) =>
                      setCoverCrop((current) => ({
                        ...current,
                        x: Number(event.target.value),
                      }))
                    }
                    type="range"
                    value={coverCrop.x}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Vertical crop
                  <input
                    max="100"
                    min="0"
                    onChange={(event) =>
                      setCoverCrop((current) => ({
                        ...current,
                        y: Number(event.target.value),
                      }))
                    }
                    type="range"
                    value={coverCrop.y}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Zoom
                  <input
                    max="2"
                    min="1"
                    onChange={(event) =>
                      setCoverCrop((current) => ({
                        ...current,
                        zoom: Number(event.target.value),
                      }))
                    }
                    step="0.05"
                    type="range"
                    value={coverCrop.zoom}
                  />
                </label>
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                onClick={() => {
                  setCoverModalOpen(false);
                  setPendingSubmitAfterCover(false);
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={!coverFile || saving} onClick={confirmCoverImage} type="button">
                Confirm cover image
              </Button>
            </div>
          </section>
        </div>
      ) : null}
      {previewOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background px-6 py-10 text-foreground">
          <article className="mx-auto max-w-3xl">
            <div className="mb-8 flex flex-col gap-4 rounded-md border bg-accent p-4 text-sm leading-6">
              <p className="font-semibold">Preview only</p>
              <p>
                This is how the article will read after editor approval and publication.
                It is not visible to real readers yet.
              </p>
              <Button className="w-fit" onClick={() => setPreviewOpen(false)} type="button">
                Return to writing desk
              </Button>
            </div>
            <header className="flex flex-col gap-5">
              <p className="text-sm font-semibold text-primary">CampusPress AI preview</p>
              <h1 className="font-serif text-5xl font-semibold leading-tight">{title}</h1>
              <p className="text-xl leading-8 text-muted-foreground">{excerpt}</p>
              <p className="border-y py-4 text-sm text-muted-foreground">
                By <span className="font-semibold text-foreground">{profile.full_name}</span>
              </p>
            </header>
            {coverImageUrl ? (
              <figure className="my-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={coverImageAlt || "Article cover image"}
                  className="aspect-video w-full rounded-md object-cover"
                  src={coverImageUrl}
                />
              </figure>
            ) : null}
            <div
              className="reader-rich-body flex flex-col gap-8 text-lg leading-8"
              dangerouslySetInnerHTML={{ __html: sanitizeEditorHtml(richBody) || plainTextToHtml(body) }}
            />
          </article>
        </div>
      ) : null}
      {floatingToolbar.visible ? (
        <div
          className="fixed z-50 flex gap-1 rounded-md border bg-card p-1 shadow-sm"
          data-testid="floating-format-toolbar"
          style={{ left: floatingToolbar.left, top: floatingToolbar.top }}
        >
          {[
            { kind: "bold", label: "Bold", Icon: Bold },
            { kind: "italic", label: "Italic", Icon: Italic },
            { kind: "quote", label: "Quote", Icon: Quote },
            { kind: "heading", label: "Heading", Icon: AlignLeft },
          ].map(({ kind, label, Icon }) => (
            <button
              aria-label={label}
              className="grid size-9 place-items-center rounded-md hover:bg-accent"
              key={kind}
              onClick={() => applyFormat(kind as FormatKind)}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              <Icon aria-hidden className="size-4" />
            </button>
          ))}
        </div>
      ) : null}
    </AuthenticatedShell>
  );
}

function MarkedText({ issues, text }: { issues: GrammarIssue[]; text: string }) {
  if (!text.trim()) {
    return (
      <div className="min-h-24 rounded-md border bg-card p-4 text-sm text-muted-foreground">
        Grammar underlines will appear here in context.
      </div>
    );
  }

  const sorted = [...issues].sort((a, b) => a.offset - b.offset);
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const issue of sorted) {
    if (issue.offset < cursor) {
      continue;
    }

    parts.push(text.slice(cursor, issue.offset));
    const flagged = text.slice(issue.offset, issue.offset + issue.length);
    parts.push(
      <span
        className="decoration-destructive rounded-sm underline decoration-wavy underline-offset-4"
        key={issue.id}
        title={`${issue.message}${
          issue.replacements.length ? ` Suggested: ${issue.replacements.join(", ")}` : ""
        }`}
      >
        {flagged}
      </span>,
    );
    cursor = issue.offset + issue.length;
  }

  parts.push(text.slice(cursor));

  return (
    <div className="min-h-24 whitespace-pre-wrap rounded-md border bg-card p-4 text-base leading-8 shadow-sm">
      {parts}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function PublishedArticleDetail({
  article,
  engagement,
  onRefresh,
}: {
  article: DraftArticle | null;
  engagement: PublishedEngagementState;
  onRefresh: () => void | Promise<void>;
}) {
  if (!article) {
    return (
      <section className="grid gap-3 rounded-md border bg-card p-5">
        <div className="flex items-center gap-3">
          <BarChart3 aria-hidden className="size-5 text-primary" />
          <h2 className="text-xl font-semibold">Published article detail</h2>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Published stories will appear here with their comments, likes, and saves.
        </p>
      </section>
    );
  }

  const articleHtml = sanitizeEditorHtml(article.content?.html ?? "") || plainTextToHtml(article.plain_text);

  return (
    <section className="grid gap-5 rounded-md border bg-card p-5" data-testid="published-article-detail">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            <BarChart3 aria-hidden className="size-5 text-primary" />
            <p className="text-sm font-semibold text-primary">Published article detail</p>
          </div>
          <h2 className="font-serif text-3xl font-semibold">{article.title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Published {formatDateTime(article.published_at ?? article.updated_at)}
          </p>
        </div>
        <Button disabled={engagement.loading} onClick={() => void onRefresh()} type="button" variant="outline">
          <RotateCcw aria-hidden className="size-4" />
          Refresh engagement
        </Button>
      </div>

      {article.excerpt ? (
        <p className="text-base leading-8 text-muted-foreground">{article.excerpt}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <EngagementStat
          icon={<Heart aria-hidden className="size-4" />}
          label="Likes"
          value={formatCount(engagement.likeCount)}
        />
        <EngagementStat
          icon={<Bookmark aria-hidden className="size-4" />}
          label="Saves"
          value={formatCount(engagement.bookmarkCount)}
        />
        <EngagementStat
          icon={<MessageCircle aria-hidden className="size-4" />}
          label="Comments"
          value={formatCount(engagement.comments.length)}
        />
      </div>
      <p className="text-sm font-semibold text-primary" role="status">
        {engagement.message}
      </p>

      {article.featured_image_url ? (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={article.featured_image_alt || "Article cover image"}
            className="aspect-video w-full rounded-md object-cover"
            src={article.featured_image_url}
          />
        </figure>
      ) : null}

      <div
        className="reader-rich-body border-t pt-5 text-lg leading-8"
        dangerouslySetInnerHTML={{ __html: articleHtml }}
      />

      <section className="grid gap-3 border-t pt-5">
        <div className="flex items-center gap-3">
          <MessageCircle aria-hidden className="size-5 text-primary" />
          <h3 className="text-lg font-semibold">Comments on this article</h3>
        </div>
        {engagement.comments.length === 0 ? (
          <p className="rounded-md border bg-background px-4 py-3 text-sm text-muted-foreground">
            No visible comments yet.
          </p>
        ) : (
          engagement.comments.map((comment) => (
            <article className="rounded-md border bg-background px-4 py-3 text-sm leading-6" key={comment.id}>
              <p>{comment.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(comment.created_at)}</p>
            </article>
          ))
        )}
      </section>
    </section>
  );
}

function EngagementStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-background px-4 py-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function WriterShell({
  children,
  message,
}: {
  children?: ReactNode;
  message: string;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-foreground">
      <section className="grid max-w-xl gap-6 rounded-md border bg-card p-8 text-center shadow-sm">
        <h1 className="font-serif text-4xl font-semibold">Writing desk</h1>
        <p className="text-base leading-8 text-muted-foreground">{message}</p>
        <div className="mx-auto">{children}</div>
      </section>
    </main>
  );
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "untitled-draft"
  );
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted for review",
    in_review: "In review",
    revision_requested: "Revision requested",
    approved: "Approved",
    rejected: "Rejected",
    published: "Published",
    archived: "Archived",
  };

  return labels[value] ?? value;
}

function createEmptyPublishedEngagement(): PublishedEngagementState {
  return {
    loading: false,
    articleSlug: null,
    likeCount: 0,
    bookmarkCount: 0,
    comments: [],
    message: "Choose a published article to see live engagement.",
  };
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function uniqueTimestampSuffix() {
  return Date.now().toString(36);
}

function hasMeaningfulDraft(title: string, plainText: string, html: string) {
  return Boolean(
    title.trim() ||
      plainText.trim() ||
      /<img\s/i.test(html),
  );
}

function plainTextToHtml(value: string) {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return "";
  }

  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
}

function sanitizeEditorHtml(html: string) {
  if (!html) {
    return "";
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script,style").forEach((node) => node.remove());
  template.content.querySelectorAll("[data-grammar-mark]").forEach((node) => {
    node.replaceWith(document.createTextNode(node.textContent ?? ""));
  });

  const allowed = new Set([
    "B",
    "BLOCKQUOTE",
    "BR",
    "DIV",
    "EM",
    "FIGCAPTION",
    "FIGURE",
    "H2",
    "H3",
    "I",
    "IMG",
    "LI",
    "OL",
    "P",
    "SPAN",
    "STRONG",
    "UL",
  ]);

  template.content.querySelectorAll("*").forEach((element) => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (element.tagName === "IMG" && ["src", "alt"].includes(name)) {
        continue;
      }
      if (element.tagName === "FIGURE" && name === "data-inline-image") {
        continue;
      }
      element.removeAttribute(attribute.name);
    }
  });

  return template.innerHTML
    .replace(/<div><br><\/div>/g, "")
    .replace(/<p><br><\/p>$/g, "")
    .trim();
}

function extractPlainTextFromHtml(html: string) {
  if (!html) {
    return "";
  }

  const template = document.createElement("template");
  template.innerHTML = sanitizeEditorHtml(html);
  const lines: string[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) {
        lines.push(text);
      }
      return;
    }

    if (!(node instanceof HTMLElement)) {
      node.childNodes.forEach(walk);
      return;
    }

    if (node.tagName === "BR") {
      lines.push("\n");
      return;
    }

    if (node.tagName === "IMG") {
      lines.push(`[Image: ${node.getAttribute("alt") || "article image"}]`);
      return;
    }

    const block = ["BLOCKQUOTE", "DIV", "FIGURE", "H2", "H3", "LI", "P"].includes(node.tagName);
    if (block && lines.length && !lines[lines.length - 1].endsWith("\n")) {
      lines.push("\n");
    }
    node.childNodes.forEach(walk);
    if (block && lines.length && !lines[lines.length - 1].endsWith("\n")) {
      lines.push("\n");
    }
  }

  template.content.childNodes.forEach(walk);
  return lines.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function decorateRichHtml(html: string, issues: GrammarIssue[]) {
  const cleanHtml = sanitizeEditorHtml(html);
  if (!cleanHtml || !issues.length) {
    return cleanHtml;
  }

  const template = document.createElement("template");
  template.innerHTML = cleanHtml;
  const nodes: { node: Text; start: number; end: number; marks: GrammarIssue[] }[] = [];
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  let cursor = 0;
  let current = walker.nextNode();
  while (current) {
    const text = current.textContent ?? "";
    nodes.push({ node: current as Text, start: cursor, end: cursor + text.length, marks: [] });
    cursor += text.length;
    current = walker.nextNode();
  }

  const sorted = [...issues].sort((a, b) => a.offset - b.offset);
  for (const issue of sorted) {
    const issueStart = issue.offset;
    const issueEnd = issue.offset + issue.length;
    for (const item of nodes) {
      if (issueEnd <= item.start || issueStart >= item.end) {
        continue;
      }
      item.marks.push(issue);
    }
  }

  for (const item of nodes.reverse()) {
    if (!item.marks.length) {
      continue;
    }
    const text = item.node.textContent ?? "";
    const ranges = item.marks
      .map((issue) => ({
        issue,
        start: Math.max(0, issue.offset - item.start),
        end: Math.min(text.length, issue.offset + issue.length - item.start),
      }))
      .filter((range) => range.end > range.start)
      .sort((a, b) => b.start - a.start);

    for (const range of ranges) {
      const after = item.node.splitText(range.end);
      const marked = item.node.splitText(range.start);
      const title = `${range.issue.message}${
        range.issue.replacements.length ? ` Suggested: ${range.issue.replacements.join(", ")}` : ""
      }`;
      const span = document.createElement("span");
      span.className = "grammar-issue";
      span.dataset.grammarMark = "true";
      span.title = title;
      span.textContent = marked.textContent;
      marked.replaceWith(span);
      item.node.textContent = item.node.textContent ?? "";
      void after;
    }
  }

  return template.innerHTML;
}

function ensureSelectionInEditor(editor: HTMLElement) {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0 && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
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

function getEditorSelectionOffsets(editor: HTMLElement) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);

  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
    return null;
  }

  const startRange = range.cloneRange();
  startRange.selectNodeContents(editor);
  startRange.setEnd(range.startContainer, range.startOffset);
  const endRange = range.cloneRange();
  endRange.selectNodeContents(editor);
  endRange.setEnd(range.endContainer, range.endOffset);

  return {
    start: startRange.toString().length,
    end: endRange.toString().length,
  };
}

function restoreEditorSelection(editor: HTMLElement, start: number, end: number) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    textNodes.push(node as Text);
    node = walker.nextNode();
  }

  const startPoint = findTextPoint(textNodes, start);
  const endPoint = findTextPoint(textNodes, end);

  if (!startPoint || !endPoint) {
    return;
  }

  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}

function findTextPoint(nodes: Text[], target: number) {
  let remaining = target;

  for (const node of nodes) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      return { node, offset: remaining };
    }
    remaining -= length;
  }

  const last = nodes[nodes.length - 1];
  if (!last) {
    return null;
  }

  return { node: last, offset: last.textContent?.length ?? 0 };
}

async function cropCoverImage(
  file: File,
  crop: { x: number; y: number; zoom: number },
) {
  const image = await loadImage(file);
  const targetWidth = 1600;
  const targetHeight = 900;
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    return file;
  }

  const sourceAspect = image.naturalWidth / image.naturalHeight;
  const targetAspect = targetWidth / targetHeight;
  const baseWidth =
    sourceAspect > targetAspect ? image.naturalHeight * targetAspect : image.naturalWidth;
  const baseHeight =
    sourceAspect > targetAspect ? image.naturalHeight : image.naturalWidth / targetAspect;
  const cropWidth = baseWidth / crop.zoom;
  const cropHeight = baseHeight / crop.zoom;
  const maxX = image.naturalWidth - cropWidth;
  const maxY = image.naturalHeight - cropHeight;
  const sx = Math.max(0, Math.min(maxX, (crop.x / 100) * maxX));
  const sy = Math.max(0, Math.min(maxY, (crop.y / 100) * maxY));

  context.drawImage(image, sx, sy, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, file.type || "image/jpeg", 0.9),
  );

  if (!blob) {
    return file;
  }

  return new File([blob], file.name, { type: blob.type });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image could not be loaded"));
    };
    image.src = url;
  });
}
