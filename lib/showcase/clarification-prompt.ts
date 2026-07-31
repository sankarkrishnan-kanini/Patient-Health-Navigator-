export type ClarificationDomain = "medication" | "condition" | "general";

export type ClarificationPromptReview = {
  responseText: string;
  promptAdded: boolean;
  promptVariant: string | null;
  complexitySignals: {
    wordCount: number;
    lineCount: number;
    markerHits: string[];
  };
};

type ClarificationPromptInput = {
  responseText: string;
  domain: ClarificationDomain;
};

const COMPLEXITY_MARKERS = [
  "purpose not recorded",
  "schedule not recorded",
  "cannot confirm or diagnose",
  "ongoing health condition",
  "profile markers",
  "active condition",
  "active medication"
];

const CLARIFICATION_PROMPT_VARIANTS: Record<ClarificationDomain, string> = {
  medication: "Want me to explain one medication in simpler step-by-step terms?",
  condition: "Want a shorter, plain-language explanation for one condition?",
  general: "Want me to restate this in simpler words?"
};

function countWords(text: string): number {
  const words = text.match(/[a-z0-9']+/gi);
  return words?.length ?? 0;
}

function countLines(text: string): number {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length;
}

function collectMarkerHits(text: string): string[] {
  const lower = text.toLowerCase();
  return COMPLEXITY_MARKERS.filter((marker) => lower.includes(marker));
}

function shouldAddClarificationPrompt(wordCount: number, lineCount: number, markerHits: string[]): boolean {
  if (markerHits.length > 0) {
    return true;
  }

  if (lineCount >= 4) {
    return true;
  }

  return wordCount >= 45;
}

function hasClarificationPromptAlready(text: string): boolean {
  return /\bwant me to\b/i.test(text) || /\bwant a shorter\b/i.test(text);
}

export function applyClarificationPrompt(input: ClarificationPromptInput): ClarificationPromptReview {
  const wordCount = countWords(input.responseText);
  const lineCount = countLines(input.responseText);
  const markerHits = collectMarkerHits(input.responseText);

  const shouldPrompt = shouldAddClarificationPrompt(wordCount, lineCount, markerHits);
  if (!shouldPrompt || hasClarificationPromptAlready(input.responseText)) {
    return {
      responseText: input.responseText,
      promptAdded: false,
      promptVariant: null,
      complexitySignals: {
        wordCount,
        lineCount,
        markerHits
      }
    };
  }

  const promptVariant = CLARIFICATION_PROMPT_VARIANTS[input.domain];
  return {
    responseText: `${input.responseText}\n${promptVariant}`,
    promptAdded: true,
    promptVariant,
    complexitySignals: {
      wordCount,
      lineCount,
      markerHits
    }
  };
}
