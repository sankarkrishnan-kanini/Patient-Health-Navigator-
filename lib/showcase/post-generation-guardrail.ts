export type PostGenerationViolationCategory = "diagnosis" | "medication" | "lab";

export type PostGenerationGuardContext = {
  isEducationalQuery?: boolean; // e.g., "what is diabetes" vs "do I have diabetes"
  isCriticalScenario?: boolean; // e.g., emergency, life-threatening
};

export type PostGenerationGuardRule = {
  ruleId: string;
  category: PostGenerationViolationCategory;
  patterns: RegExp[];
  enforceOnEducational?: boolean; // If false, only enforce on directive queries
};

export type PostGenerationGuardResult = {
  finalResponse: string;
  overrideApplied: boolean;
  violationCategory: PostGenerationViolationCategory | null;
  overrideReason: "prohibited_advice_detected" | null;
  matchedRuleIds: string[];
};

const POST_GENERATION_GUARD_RULES: PostGenerationGuardRule[] = [
  {
    ruleId: "PG-DIAGNOSIS-001",
    category: "diagnosis",
    enforceOnEducational: false, // Allow educational responses about diagnoses
    patterns: [
      /\byou have\s+[a-z]+/i,
      /\bthis is likely\s+[a-z]+/i,
      /\bi (believe|think|suspect|conclude).*\b(you have|this is)\b/i,
      /\byou (definitely|clearly|likely|probably)\s+(have|are)\s+[a-z]+/i,
      /\bdefinitely\s+(diabetes|cancer|asthma|infection)\b/i
    ]
  },
  {
    ruleId: "PG-MEDICATION-001",
    category: "medication",
    enforceOnEducational: false, // Allow educational responses about medications
    patterns: [
      /\bincrease\s+(your|the)\s+dose\b/i,
      /\bdecrease\s+(your|the)\s+dose\b/i,
      /\bstop\s+taking\b/i,
      /\bswitch\s+(to|your)\s+medication\b/i,
      /\bskip\s+(your|the)\s+medication\b/i
    ]
  },
  {
    ruleId: "PG-LAB-001",
    category: "lab",
    enforceOnEducational: false, // Allow educational responses about lab values
    patterns: [
      /\b(lab|labs|blood test|results)\b.*\b(normal|abnormal|high|low|critical|safe range|out of range)\b/i,
      /\byour\s+(labs|results)\s+are\s+(normal|abnormal|high|low|critical)\b/i
    ]
  }
];

function replacementTemplate(category: PostGenerationViolationCategory): string {
  if (category === "diagnosis") {
    return "I cannot diagnose conditions or confirm a diagnosis in chat. Please contact your care team for an in-person clinical assessment.";
  }

  if (category === "medication") {
    return "I cannot provide medication dose changes or stop/switch directives in chat. Please contact your care team now before making medication changes.";
  }

  return "I cannot interpret lab results or provide clinical judgment in chat. Please contact your care team for personalized interpretation of your lab report.";
}

export function applyPostGenerationGuardrail(
  draftResponse: string,
  context: PostGenerationGuardContext = {}
): PostGenerationGuardResult {
  for (const rule of POST_GENERATION_GUARD_RULES) {
    const matched = rule.patterns.some((pattern) => pattern.test(draftResponse));
    if (!matched) {
      continue;
    }

    // If this is an educational query and the rule doesn't enforce on educational, skip it
    if (context.isEducationalQuery && rule.enforceOnEducational === false) {
      continue;
    }

    return {
      finalResponse: replacementTemplate(rule.category),
      overrideApplied: true,
      violationCategory: rule.category,
      overrideReason: "prohibited_advice_detected",
      matchedRuleIds: [rule.ruleId]
    };
  }

  return {
    finalResponse: draftResponse,
    overrideApplied: false,
    violationCategory: null,
    overrideReason: null,
    matchedRuleIds: []
  };
}
