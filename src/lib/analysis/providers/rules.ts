import type { AnalysisArticle, AnalysisFlag, AnalysisProviderResult } from "../types";
import { splitSentences, wordCount } from "../utils";

type RuleResult = {
  name: string;
  passed: boolean;
  evidence: string;
};

export function runRuleCredibility(article: AnalysisArticle): AnalysisProviderResult {
  const text = article.plainText;
  const lower = text.toLowerCase();
  const words = wordCount(text);
  const sentences = splitSentences(text);
  const quoteCount = (text.match(/"/g) ?? []).length;
  const hasAttribution = /\b(said|according to|told|explained|reported|stated)\b/i.test(text);
  const hasDateOrTime = /\b(20[0-9]{2}|today|yesterday|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text);
  const hasNamedSource = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(text);
  const hasNumbers = /\b[0-9]+(\.[0-9]+)?%?\b/.test(text);
  const loadedLanguage = /\b(shocking|disaster|evil|destroyed|corrupt|exposed|unbelievable)\b/i.test(text);
  const hasContext = /\b(because|however|although|while|context|background|before|after)\b/i.test(text);
  const hasCampusRelevance = /\b(chrisland|campus|student|students|lecturer|department|university)\b/i.test(text);

  const rules: RuleResult[] = [
    { name: "Enough reported detail", passed: words >= 250, evidence: `${words} words found.` },
    {
      name: "Attribution language",
      passed: hasAttribution,
      evidence: hasAttribution ? "Attribution language is present." : "No clear attribution language found.",
    },
    {
      name: "Named source",
      passed: hasNamedSource,
      evidence: hasNamedSource ? "At least one likely person name appears." : "No likely named person source found.",
    },
    {
      name: "Quote evidence",
      passed: quoteCount >= 2,
      evidence: `${quoteCount} quotation marks found.`,
    },
    {
      name: "Time context",
      passed: hasDateOrTime,
      evidence: hasDateOrTime ? "Date or time context appears." : "No clear date or time context found.",
    },
    {
      name: "Specific data",
      passed: hasNumbers,
      evidence: hasNumbers ? "Specific numbers appear." : "No specific numbers found.",
    },
    {
      name: "Neutral wording",
      passed: !loadedLanguage,
      evidence: loadedLanguage ? "Potentially loaded wording appears." : "No obvious loaded wording found.",
    },
    {
      name: "Context or contrast",
      passed: hasContext,
      evidence: hasContext ? "Context or contrast language appears." : "No clear context or contrast language found.",
    },
    {
      name: "Campus relevance",
      passed: hasCampusRelevance,
      evidence: hasCampusRelevance ? "Campus context appears." : "Campus context is not obvious.",
    },
  ];

  const passed = rules.filter((rule) => rule.passed).length;
  const score = Number(((passed / rules.length) * 100).toFixed(2));
  const flags: AnalysisFlag[] = rules
    .filter((rule) => !rule.passed)
    .map((rule) => ({
      text: sentences[0] ?? article.title,
      reason: `${rule.name}: ${rule.evidence}`,
    }));

  return {
    key: "rule_credibility",
    provider: "local",
    modelName: "campuspress-9-point-credibility",
    modelFamily: "rule-based",
    status: "completed",
    verdict: score >= 78 ? "Credibility rules mostly pass." : score >= 55 ? "Manual editorial review recommended." : "Credibility rules flagged serious gaps.",
    confidence: 1,
    score,
    flaggedSentences: flags,
    rawOutput: { rules, lowerLength: lower.length },
    errorMessage: null,
  };
}
