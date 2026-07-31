type SimplificationRule = {
  phrase: string;
  pattern: RegExp;
  replacement: string;
};

type JargonMetric = {
  term: string;
  count: number;
};

export type PlainLanguageReview = {
  responseText: string;
  readability: {
    totalWords: number;
    baselineJargonWords: number;
    finalJargonWords: number;
    jargonDensity: number;
    jargonThreshold: number;
    flagged: boolean;
    detectedTerms: JargonMetric[];
    replacementsApplied: number;
    jargonReduction: number;
  };
};

const JARGON_THRESHOLD = 0.1;

const SIMPLIFICATION_RULES: SimplificationRule[] = [
  {
    phrase: "orchestration",
    pattern: /\borchestration\b/gi,
    replacement: "workflow"
  },
  {
    phrase: "propagation",
    pattern: /\bpropagation\b/gi,
    replacement: "passing"
  },
  {
    phrase: "clinical",
    pattern: /\bclinical\b/gi,
    replacement: "health"
  },
  {
    phrase: "diagnostic",
    pattern: /\bdiagnostic\b/gi,
    replacement: "condition-check"
  },
  {
    phrase: "diagnosis",
    pattern: /\bdiagnosis\b/gi,
    replacement: "diagnosis (naming a condition)"
  },
  {
    phrase: "adherence",
    pattern: /\badherence\b/gi,
    replacement: "staying on track"
  },
  {
    phrase: "profile snapshot",
    pattern: /\bprofile snapshot\b/gi,
    replacement: "saved profile view"
  },
  {
    phrase: "context",
    pattern: /\bcontext\b/gi,
    replacement: "details"
  }
];

const JARGON_TERMS = [
  "orchestration",
  "propagation",
  "clinical",
  "diagnostic",
  "diagnosis",
  "adherence",
  "snapshot",
  "context"
];

function countWords(text: string): number {
  const words = text.match(/[a-z0-9']+/gi);
  return words?.length ?? 0;
}

function countTermMatches(text: string, term: string): number {
  const matcher = new RegExp(`\\b${term}\\b`, "gi");
  return text.match(matcher)?.length ?? 0;
}

function collectJargonMetrics(text: string): { total: number; terms: JargonMetric[] } {
  const terms = JARGON_TERMS
    .map((term) => ({ term, count: countTermMatches(text, term) }))
    .filter((entry) => entry.count > 0);

  return {
    total: terms.reduce((sum, entry) => sum + entry.count, 0),
    terms
  };
}

function simplifyTerminology(text: string): { simplified: string; replacementsApplied: number } {
  let simplified = text;
  let replacementsApplied = 0;

  for (const rule of SIMPLIFICATION_RULES) {
    const matches = simplified.match(rule.pattern)?.length ?? 0;
    if (matches === 0) {
      continue;
    }

    replacementsApplied += matches;
    simplified = simplified.replace(rule.pattern, rule.replacement);
  }

  return { simplified, replacementsApplied };
}

export function applyPlainLanguageControls(text: string): PlainLanguageReview {
  const baselineMetrics = collectJargonMetrics(text);
  const { simplified, replacementsApplied } = simplifyTerminology(text);
  const finalMetrics = collectJargonMetrics(simplified);
  const totalWords = countWords(simplified);
  const baselineWords = Math.max(countWords(text), 1);
  const baselineDensity = baselineMetrics.total / baselineWords;
  const jargonDensity = totalWords === 0 ? 0 : finalMetrics.total / totalWords;
  const flagged = baselineDensity > JARGON_THRESHOLD || jargonDensity > JARGON_THRESHOLD;

  const responseText = flagged
    ? `${simplified}\nIf any part sounds too technical, ask me and I will restate it in simpler words.`
    : simplified;

  return {
    responseText,
    readability: {
      totalWords,
      baselineJargonWords: baselineMetrics.total,
      finalJargonWords: finalMetrics.total,
      jargonDensity,
      jargonThreshold: JARGON_THRESHOLD,
      flagged,
      detectedTerms: finalMetrics.terms,
      replacementsApplied,
      jargonReduction: baselineMetrics.total - finalMetrics.total
    }
  };
}
