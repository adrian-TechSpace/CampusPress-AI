import { NextResponse } from "next/server";

import { authenticateActiveRequest } from "@/lib/account-enforcement";
import {
  categoryByName,
  categoryNamesForPrompt,
  categorySuggestionSchema,
} from "@/lib/categories";

export const runtime = "nodejs";
export const maxDuration = 30;

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

export async function POST(request: Request) {
  const auth = await authenticateActiveRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message, account: auth.account }, { status: auth.status });
  }

  if (auth.profile.role !== "journalist") {
    return NextResponse.json({ ok: false, message: "Only journalists can request a category suggestion." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    title?: string;
    excerpt?: string;
    body?: string;
  };
  const debugOpenAi =
    Boolean(process.env.CRON_SECRET) &&
    request.headers.get("x-track2-openai-debug") === process.env.CRON_SECRET;

  if (!process.env.OPENAI_API_KEY || request.headers.get("x-track2-openai-mode") === "unavailable") {
    return NextResponse.json({ ok: true, suggestion: null });
  }

  try {
    const prompt = [
      "Choose one CampusPress AI article category from this fixed list.",
      `Allowed categories: ${categoryNamesForPrompt()}.`,
      "Return only the JSON schema fields. Do not invent a new category.",
      `Title: ${payload.title ?? ""}`,
      `Excerpt: ${payload.excerpt ?? ""}`,
      `Article text: ${(payload.body ?? "").slice(0, 5000)}`,
    ].join("\n\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_ANALYSIS_MODEL || "gpt-4.1-mini",
        input: prompt,
        text: { format: categorySuggestionSchema },
      }),
    });

    if (!response.ok) {
      const providerBody = await response.json().catch(() => ({}));
      return NextResponse.json({
        ok: true,
        suggestion: null,
        debug: debugOpenAi
          ? {
              providerStatus: response.status,
              providerBody,
            }
          : undefined,
      });
    }

    const json = (await response.json()) as OpenAiResponse;
    const parsed = JSON.parse(outputText(json)) as { category?: string; reason?: string };
    const category = parsed.category ? categoryByName(parsed.category) : null;
    if (!category) {
      return NextResponse.json({
        ok: true,
        suggestion: null,
        debug: debugOpenAi ? { parsed, providerResponse: json } : undefined,
      });
    }

    return NextResponse.json({
      ok: true,
      suggestion: {
        name: category.name,
        slug: category.slug,
        reason: parsed.reason ?? "OpenAI suggested this category from the article text.",
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      suggestion: null,
      debug: debugOpenAi
        ? {
            message: error instanceof Error ? error.message : "Unknown OpenAI category suggestion error.",
          }
        : undefined,
    });
  }
}

function outputText(response: OpenAiResponse) {
  const text =
    response.output_text ??
    response.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text" || item.text)?.text;

  if (!text) {
    throw new Error("OpenAI response did not include text.");
  }

  return text;
}
