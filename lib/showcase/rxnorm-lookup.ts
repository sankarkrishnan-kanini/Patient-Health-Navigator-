/**
 * RxNorm Lookup Service
 * Integrates with NIH RxNorm API for medication information and interaction checking.
 * RxNorm is the U.S. drug naming system maintained by the NIH National Library of Medicine.
 */

const RXNORM_API_BASE = "https://rxnav.nlm.nih.gov/REST";

// In-memory cache for RxNorm lookups to reduce API calls
const rxnormCache = new Map<string, RxNormConceptInfo>();
const interactionCache = new Map<string, MedicationInteraction[]>();

export type RxNormConceptInfo = {
  rxcui: string;
  name: string;
  synonym?: string;
  tty: string; // Term Type (BN=Brand Name, IN=Ingredient Name, SBD=Semantic Branded Drug, etc.)
};

export type MedicationInteraction = {
  sourceRxcui: string;
  targetRxcui: string;
  sourceName: string;
  targetName: string;
  description: string;
  severity: "contraindicated" | "serious" | "moderate" | "minor";
  recommendation: string;
};

export type MedicationInteractionCheck = {
  medicationName: string;
  rxcui: string | null;
  interactionRisks: MedicationInteraction[];
  severity: "high" | "medium" | "low" | "none";
};

export type RxNormLookupResult = {
  medications: MedicationInteractionCheck[];
  overallSeverity: "high" | "medium" | "low" | "none";
  warnings: string[];
  cacheHits: number;
};

/**
 * Extract drug names from complex medication format
 * Handles formats like: "Acetaminophen 325 MG / Oxycodone Hydrochloride 10 MG Oral Tablet [Percocet]"
 */
function extractDrugNames(fullMedName: string): string[] {
  // Remove bracketed trade names: [Percocet] -> ""
  let cleaned = fullMedName.replace(/\[.*?\]/g, "").trim();
  
  // Remove common route/form information (Oral Tablet, IV, etc.)
  cleaned = cleaned.replace(/\b(oral|iv|intravenous|tablet|capsule|cream|ointment|solution|suspension|injection|patch|spray|inhaler|drops|lotion|gel|powder|liquid|extended.release|immediate.release)\b/gi, "").trim();
  
  // Split by common separators: /, and, &
  const parts = cleaned.split(/\s*[\/&]\s*|\s+and\s+/i);
  
  // Extract just drug names (remove dosages like "325 MG", "10 MG", etc.)
  return parts
    .map((part) => {
      // Remove dosage information (numbers followed by units)
      let drugName = part.replace(/\b\d+(\.\d+)?\s*(mg|ml|mcg|iu|units?|gr|gm|kg)\b/gi, "").trim();
      // Remove leading/trailing whitespace and punctuation
      drugName = drugName.replace(/^[\W_]+|[\W_]+$/g, "").toLowerCase().trim();
      return drugName;
    })
    .filter((name) => name.length > 0);
}

/**
 * Normalize medication name for RxNorm lookup
 */
function normalizeMedicationName(name: string): string {
  const drugNames = extractDrugNames(name);
  // Use the first extracted drug name
  return drugNames.length > 0 ? drugNames[0] : name.toLowerCase().trim();
}

/**
 * Fetch RxNorm concept information by drug name
 * Uses the NIH RxNorm API to find the RxCUI (unique identifier)
 */
async function fetchRxNormConcept(drugName: string): Promise<RxNormConceptInfo | null> {
  const normalized = normalizeMedicationName(drugName);

  // Check cache first
  if (rxnormCache.has(normalized)) {
    return rxnormCache.get(normalized) ?? null;
  }

  try {
    // Use RxNorm's approximate name match endpoint
    const response = await fetch(
      `${RXNORM_API_BASE}/approximateTerm?term=${encodeURIComponent(normalized)}&maxEntries=1`,
      { signal: AbortSignal.timeout(5000) } // 5 second timeout
    );

    if (!response.ok) {
      console.warn(`RxNorm API error for "${drugName}": HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      approximateGroup?: { candidates?: Array<{ rxcui: string; name: string; tty: string }> };
    };

    const candidate = data.approximateGroup?.candidates?.[0];
    if (!candidate) {
      console.warn(`No RxNorm match found for "${drugName}"`);
      return null;
    }

    const result: RxNormConceptInfo = {
      rxcui: candidate.rxcui,
      name: candidate.name,
      tty: candidate.tty
    };

    // Cache the result
    rxnormCache.set(normalized, result);
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`RxNorm API timeout for "${drugName}"`);
    } else {
      console.error(`RxNorm lookup failed for "${drugName}":`, error);
    }
    return null;
  }
}

/**
 * Common known drug-drug interactions (fallback when API unavailable)
 * In production, would use comprehensive database like DrugBank or FDA interactions
 */
const KNOWN_INTERACTIONS: Record<string, Record<string, MedicationInteraction>> = {
  // Warfarin interactions (blood thinner)
  "warfarin": {
    "aspirin": {
      sourceRxcui: "11289",
      targetRxcui: "5064",
      sourceName: "Warfarin",
      targetName: "Aspirin",
      description: "Increased risk of bleeding when combined",
      severity: "serious",
      recommendation: "Monitor for bleeding signs. Discuss with care team before starting aspirin."
    },
    "ibuprofen": {
      sourceRxcui: "11289",
      targetRxcui: "5681",
      sourceName: "Warfarin",
      targetName: "Ibuprofen",
      description: "NSAIDs increase bleeding risk with warfarin",
      severity: "serious",
      recommendation: "Use acetaminophen instead. Avoid NSAIDs."
    }
  },

  // Metformin interactions (diabetes medication)
  "metformin": {
    "contrast dye": {
      sourceRxcui: "6809",
      targetRxcui: "0",
      sourceName: "Metformin",
      targetName: "Contrast Dye",
      description: "Risk of lactic acidosis with contrast dye",
      severity: "serious",
      recommendation: "Inform your doctor before any imaging with contrast. May need to hold metformin."
    }
  },

  // Lisinopril (ACE inhibitor) interactions
  "lisinopril": {
    "potassium": {
      sourceRxcui: "5640",
      targetRxcui: "8587",
      sourceName: "Lisinopril",
      targetName: "Potassium",
      description: "ACE inhibitors can raise potassium levels",
      severity: "moderate",
      recommendation: "Monitor potassium levels. Limit potassium supplements unless instructed by doctor."
    }
  },

  // Simvastatin (statin) interactions
  "simvastatin": {
    "grapefruit": {
      sourceRxcui: "36567",
      targetRxcui: "0",
      sourceName: "Simvastatin",
      targetName: "Grapefruit",
      description: "Grapefruit increases simvastatin levels, raising side effect risk",
      severity: "moderate",
      recommendation: "Avoid grapefruit and grapefruit juice."
    }
  },

  // NSAIDs (Ibuprofen) + Opioids interactions
  "ibuprofen": {
    "oxycodone": {
      sourceRxcui: "5681",
      targetRxcui: "7676",
      sourceName: "Ibuprofen",
      targetName: "Oxycodone",
      description: "NSAIDs combined with opioids increase risk of GI bleeding and ulcers",
      severity: "moderate",
      recommendation: "Monitor for signs of stomach bleeding. Take with food. Report any dark/tarry stools."
    }
  },
  "acetaminophen": {
    "ibuprofen": {
      sourceRxcui: "161",
      targetRxcui: "5681",
      sourceName: "Acetaminophen",
      targetName: "Ibuprofen",
      description: "Should not be combined - risk of overdose and organ damage",
      severity: "serious",
      recommendation: "Use either acetaminophen OR ibuprofen, not both. These are different pain relievers."
    }
  }
};

/**
 * Check for drug-drug interactions between medications
 */
async function checkInteractionsForMedication(
  sourceRxcui: string,
  sourceName: string,
  otherMedications: { name: string; rxcui: string | null }[]
): Promise<MedicationInteraction[]> {
  const cacheKey = `${sourceRxcui}:${otherMedications.map((m) => m.rxcui).join(",")}`;

  // Check cache
  if (interactionCache.has(cacheKey)) {
    return interactionCache.get(cacheKey) ?? [];
  }

  const interactions: MedicationInteraction[] = [];
  const normalizedSourceName = normalizeMedicationName(sourceName);

  // Check against known interactions
  if (KNOWN_INTERACTIONS[normalizedSourceName]) {
    for (const otherMed of otherMedications) {
      const normalizedOtherName = normalizeMedicationName(otherMed.name);
      const interaction = KNOWN_INTERACTIONS[normalizedSourceName]?.[normalizedOtherName];

      if (interaction) {
        interactions.push(interaction);
      }
    }
  }

  // Try NIH RxNorm interaction API (experimental/limited)
  try {
    const response = await fetch(
      `${RXNORM_API_BASE}/interaction?rxcui=${sourceRxcui}&sources=DrugBank`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (response.ok) {
      const data = (await response.json()) as {
        interactionTypeGroup?: Array<{
          interactionType: Array<{
            comment: string;
            interactionPair: Array<{ description: string; severity: string }>;
          }>;
        }>;
      };

      // Parse API response if available (NIH RxNorm may return empty for some drugs)
      if (data.interactionTypeGroup) {
        data.interactionTypeGroup.forEach((group) => {
          group.interactionType.forEach((type) => {
            type.interactionPair.forEach((pair) => {
              interactions.push({
                sourceRxcui,
                targetRxcui: "unknown",
                sourceName,
                targetName: "Other medication",
                description: pair.description,
                severity: (pair.severity?.toLowerCase() as
                  | "contraindicated"
                  | "serious"
                  | "moderate"
                  | "minor") || "moderate",
                recommendation: `Consult your care team about this interaction.`
              });
            });
          });
        });
      }
    }
  } catch (_error) {
    // Silent fail - we already have known interactions fallback
    console.debug(`RxNorm interaction API unavailable, using known interactions`);
  }

  // Cache the results
  interactionCache.set(cacheKey, interactions);
  return interactions;
}

/**
 * Main function: Look up medications and check for interactions
 */
export async function performRxNormLookup(
  medicationNames: string[]
): Promise<RxNormLookupResult> {
  if (medicationNames.length === 0) {
    return {
      medications: [],
      overallSeverity: "none",
      warnings: [],
      cacheHits: 0
    };
  }

  const medications: MedicationInteractionCheck[] = [];
  const cacheHits = 0;
  const warnings: string[] = [];
  let maxSeverity: "high" | "medium" | "low" | "none" = "none";
  const allFoundInteractions: MedicationInteraction[] = [];

  // Extract all individual drug names from compound medications
  const drugNameMap = new Map<string, string[]>(); // Maps original med name to extracted drug names
  for (const medName of medicationNames) {
    const extractedNames = extractDrugNames(medName);
    drugNameMap.set(medName, extractedNames.length > 0 ? extractedNames : [medName.toLowerCase()]);
  }

  // Check interactions between all pairs of extracted drug names
  const processedPairs = new Set<string>();
  
  for (const [medName1, drugNames1] of drugNameMap) {
    for (const [medName2, drugNames2] of drugNameMap) {
      if (medName1 >= medName2) continue; // Only check each pair once
      
      // Check all combinations of drug names from the two medications
      for (const drug1 of drugNames1) {
        for (const drug2 of drugNames2) {
          const pairKey = `${drug1}|${drug2}`;
          if (processedPairs.has(pairKey)) continue;
          processedPairs.add(pairKey);

          // Check in KNOWN_INTERACTIONS
          if (KNOWN_INTERACTIONS[drug1]?.[drug2]) {
            const interaction = KNOWN_INTERACTIONS[drug1][drug2];
            allFoundInteractions.push(interaction);
          } else if (KNOWN_INTERACTIONS[drug2]?.[drug1]) {
            // Check reverse order too
            const interaction = KNOWN_INTERACTIONS[drug2][drug1];
            allFoundInteractions.push(interaction);
          }
        }
      }
    }
  }

  // Group interactions by medication for response
  const medicationSet = new Set<string>();
  for (const drugs of drugNameMap.values()) {
    for (const drug of drugs) {
      medicationSet.add(drug);
    }
  }

  for (const medName of medicationNames) {
    const extractedNames = drugNameMap.get(medName) || [medName.toLowerCase()];
    const relatedInteractions = allFoundInteractions.filter(
      (i) => extractedNames.some((name) => 
        i.sourceName.toLowerCase().includes(name) || 
        i.targetName.toLowerCase().includes(name)
      )
    );

    const severity =
      relatedInteractions.length === 0
        ? "none"
        : relatedInteractions.some((i) => i.severity === "contraindicated" || i.severity === "serious")
          ? "high"
          : relatedInteractions.some((i) => i.severity === "moderate")
            ? "medium"
            : "low";

    if (severity !== "none") {
      medications.push({
        medicationName: medName,
        rxcui: null,
        severity,
        interactionRisks: relatedInteractions
      });

      // Update max severity
      if (severity === "high") maxSeverity = "high";
      else if (severity === "medium" && maxSeverity !== "high") maxSeverity = "medium";
      else if (severity === "low" && maxSeverity === "none") maxSeverity = "low";
    }
  }

  // Build warning messages
  for (const med of medications) {
    if (med.interactionRisks.length > 0) {
      for (const risk of med.interactionRisks) {
        warnings.push(
          `⚠️ ${med.medicationName} + ${risk.targetName}: ${risk.description}`
        );
      }
    }
  }

  return {
    medications,
    overallSeverity: maxSeverity,
    warnings,
    cacheHits
  };
}

/**
 * Build plain-language interaction warning for patient
 */
export function buildInteractionWarningMessage(result: RxNormLookupResult): string | null {
  if (result.warnings.length === 0) {
    return null;
  }

  const severity = result.overallSeverity;
  const prefix =
    severity === "high"
      ? "⚠️ IMPORTANT: There are potential serious interactions with your medications:"
      : severity === "medium"
        ? "⚠️ Caution: There are potential interactions to be aware of:"
        : "ℹ️ Note: There are some minor interactions to consider:";

  const warningsList = result.warnings.map((w) => `• ${w}`).join("\n");

  const suffix =
    severity === "high"
      ? "\nPlease discuss these interactions with your care team before making any changes."
      : "Your care team can help manage these interactions.";

  return [prefix, warningsList, suffix].join("\n");
}

/**
 * Clear caches (useful for testing or manual refresh)
 */
export function clearRxNormCaches(): void {
  rxnormCache.clear();
  interactionCache.clear();
}
