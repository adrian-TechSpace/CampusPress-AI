export type GrammarIssue = {
  id: string;
  offset: number;
  length: number;
  message: string;
  shortMessage: string;
  replacements: string[];
  ruleId: string;
};

export type ReadabilityScore = {
  grade: number;
  readingEase: number;
  words: number;
  sentences: number;
  syllables: number;
  label: string;
};

export function analyzeReadability(text: string): ReadabilityScore {
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const sentences = Math.max(
    text.split(/[.!?]+/).filter((sentence) => sentence.trim().length > 0).length,
    1,
  );
  const syllables = Math.max(
    words.reduce((total, word) => total + countSyllables(word), 0),
    1,
  );
  const wordCount = Math.max(words.length, 1);
  const grade = 0.39 * (wordCount / sentences) + 11.8 * (syllables / wordCount) - 15.59;
  const readingEase = 206.835 - 1.015 * (wordCount / sentences) - 84.6 * (syllables / wordCount);

  return {
    grade: clampOneDecimal(grade),
    readingEase: clampOneDecimal(readingEase),
    words: words.length,
    sentences,
    syllables,
    label: readabilityLabel(readingEase),
  };
}

export function fallbackGrammarIssues(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];
  const checks = [
    {
      pattern: /\bthis are\b/gi,
      message: "Use a singular verb with this.",
      replacement: "this is",
      ruleId: "LOCAL_SUBJECT_VERB",
    },
    {
      pattern: /\ban test\b/gi,
      message: "Use 'a' before a consonant sound.",
      replacement: "a test",
      ruleId: "LOCAL_ARTICLE",
    },
    {
      pattern: /\bvery very\b/gi,
      message: "Repeated intensifiers weaken the sentence.",
      replacement: "very",
      ruleId: "LOCAL_REPETITION",
    },
  ];

  for (const check of checks) {
    for (const match of text.matchAll(check.pattern)) {
      issues.push({
        id: `${check.ruleId}-${match.index ?? 0}`,
        offset: match.index ?? 0,
        length: match[0].length,
        message: check.message,
        shortMessage: check.message,
        replacements: [check.replacement],
        ruleId: check.ruleId,
      });
    }
  }

  return issues;
}

function readabilityLabel(readingEase: number) {
  if (readingEase >= 70) {
    return "Clear for a broad campus audience";
  }

  if (readingEase >= 50) {
    return "Readable, but some sentences may need tightening";
  }

  return "Dense. Shorter sentences will help readers";
}

function clampOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function countSyllables(rawWord: string) {
  const word = rawWord.toLowerCase().replace(/[^a-z]/g, "");

  if (word.length <= 3) {
    return 1;
  }

  const withoutSilentE = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/i, "");
  const groups = withoutSilentE.match(/[aeiouy]{1,2}/g);

  return Math.max(groups?.length ?? 1, 1);
}
