import { NextResponse } from "next/server";
import { fallbackGrammarIssues, type GrammarIssue } from "@/lib/writing-analysis";

type LanguageToolMatch = {
  offset: number;
  length: number;
  message: string;
  shortMessage?: string;
  replacements?: { value: string }[];
  rule?: { id?: string };
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { text?: string };
  const text = payload.text?.slice(0, 12000) ?? "";

  if (text.trim().length < 12) {
    return NextResponse.json({
      ok: true,
      source: "languagetool",
      issues: [],
      message: "Write a little more before grammar feedback starts.",
    });
  }

  const form = new URLSearchParams({
    text,
    language: "en-US",
  });

  try {
    const response = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    if (!response.ok) {
      throw new Error(`LanguageTool returned ${response.status}`);
    }

    const result = (await response.json()) as { matches?: LanguageToolMatch[] };
    const issues: GrammarIssue[] = (result.matches ?? []).slice(0, 20).map((match, index) => ({
      id: `${match.rule?.id ?? "LANGUAGETOOL"}-${match.offset}-${index}`,
      offset: match.offset,
      length: match.length,
      message: match.message,
      shortMessage: match.shortMessage || match.message,
      replacements: (match.replacements ?? []).slice(0, 3).map((item) => item.value),
      ruleId: match.rule?.id ?? "LANGUAGETOOL",
    }));

    return NextResponse.json({
      ok: true,
      source: "languagetool",
      issues,
      message:
        issues.length === 0
          ? "No grammar issues found in the latest check."
          : "Grammar feedback updated.",
    });
  } catch {
    const issues = fallbackGrammarIssues(text);

    return NextResponse.json({
      ok: true,
      source: "local-fallback",
      issues,
      message:
        issues.length === 0
          ? "LanguageTool is unavailable right now. Local checks found no obvious issues."
          : "LanguageTool is unavailable right now. Local checks found issues to review.",
    });
  }
}
