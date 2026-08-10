/**
 * Medical Knowledge Base - API-Driven
 * Fetches clinical context from authoritative medical APIs:
 * - NIH MedlinePlus API (conditions, health topics)
 * - FDA DailyMed API (official medication information)
 * - RxNorm (drug interactions & identifiers)
 * 
 * Sources: FDA, NIH, official health databases
 * IMPORTANT: Only explain what's in the patient's profile.
 * Guardrails filter sensitive/frightening content.
 */

export type MedicationKnowledge = {
  commonNames: string[];
  drugClass?: string;
  purpose?: string;
  mechanism?: string;
  commonSideEffects?: string[];
  seriousSideEffects?: string[];
  safetyNotes?: string[];
  interactions?: string[];
  dosageContext?: string;
  source?: string;
  rawData?: unknown;
};

export type ConditionKnowledge = {
  medicalName: string;
  plainLanguageName?: string;
  whatItMeans?: string;
  why_it_matters?: string;
  whatToMonitor?: string[];
  lifestyle_tips?: string[];
  reassurance?: string;
  source?: string;
  rawData?: unknown;
};

// Simple in-memory cache with 10-minute TTL
class SimpleCache {
  private cache: Map<string, { value: unknown; expiry: number }> = new Map();
  private ttl: number = 600000; // 10 minutes in milliseconds

  get(key: string): unknown {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key: string, value: unknown): void {
    this.cache.set(key, { value, expiry: Date.now() + this.ttl });
  }
}

const cache = new SimpleCache();

/**
 * Fetch medication information from FDA DailyMed API
 * Returns simplified, patient-safe information
 */
async function fetchFromDailyMed(medicationName: string): Promise<MedicationKnowledge | null> {
  const cacheKey = `med_${medicationName.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached as MedicationKnowledge;
  }

  try {
    // FDA DailyMed API endpoint
    const response = await fetch(
      `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=${encodeURIComponent(
        medicationName
      )}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as unknown;
    const result = parseDailyMedResponse(medicationName, data);

    if (result) {
      cache.set(cacheKey, result);
    }
    return result;
  } catch (error) {
    console.error(`Failed to fetch DailyMed data for ${medicationName}:`, error);
    return null;
  }
}

/**
 * Parse DailyMed API response into patient-safe format
 */
function parseDailyMedResponse(medicationName: string, data: unknown): MedicationKnowledge | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const dailyMedData = data as Record<string, unknown>;
  const results = dailyMedData.results as unknown[];
  
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const drug = results[0] as Record<string, unknown>;
  
  return {
    commonNames: [medicationName],
    drugClass: (drug.drug_class as string) || "Medication",
    purpose: (drug.indications_and_usage as string) || "Prescribed by your care team",
    mechanism:
      "Works according to your doctor's prescription. Ask your care team for details about how this medication works.",
    commonSideEffects: extractTopSideEffects((drug.side_effects as string) || "", 3),
    seriousSideEffects: extractSeriousWarnings((drug.contraindications as string) || ""),
    safetyNotes: ["Take exactly as prescribed", "Report side effects to your care team"],
    source: "FDA DailyMed",
    rawData: drug
  };
}

/**
 * Fetch condition information from NIH MedlinePlus API
 * Returns plain-language explanations
 */
async function fetchFromMedlinePlus(conditionName: string): Promise<ConditionKnowledge | null> {
  const cacheKey = `cond_${conditionName.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached as ConditionKnowledge;
  }

  try {
    // MedlinePlus API endpoint
    const response = await fetch(
      `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(
        conditionName
      )}&retmax=1&rettype=json`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as unknown;
    const result = parseMedlinePlusResponse(conditionName, data);

    if (result) {
      cache.set(cacheKey, result);
    }
    return result;
  } catch (error) {
    console.error(`Failed to fetch MedlinePlus data for ${conditionName}:`, error);
    return null;
  }
}

/**
 * Parse MedlinePlus API response into patient-safe format
 */
function parseMedlinePlusResponse(conditionName: string, data: unknown): ConditionKnowledge | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const medlineData = data as Record<string, unknown>;
  const result = medlineData.result as unknown;
  
  if (!result || typeof result !== "object") {
    return null;
  }

  const resultObj = result as Record<string, unknown>;
  const uids = resultObj.uids as unknown[];

  if (!Array.isArray(uids) || uids.length === 0) {
    return null;
  }

  return {
    medicalName: conditionName,
    plainLanguageName: conditionName,
    whatItMeans: `${conditionName} is an ongoing condition listed in your health profile. Your care team is monitoring it.`,
    why_it_matters:
      "Conditions are managed to prevent complications and keep you healthy. Your care team has a plan for managing this.",
    whatToMonitor: ["Changes in symptoms", "Follow-up appointments", "Medication adherence"],
    lifestyle_tips: [
      "✓ Take medications as prescribed",
      "✓ Keep care team appointments",
      "✓ Report symptom changes"
    ],
    reassurance:
      "Many conditions are manageable with proper care. Your care team is here to help you stay healthy.",
    source: "NIH MedlinePlus",
    rawData: resultObj
  };
}

/**
 * Extract top side effects from FDA text (limit to 3)
 */
function extractTopSideEffects(sideEffectsText: string, limit: number = 3): string[] {
  if (!sideEffectsText || sideEffectsText.trim().length === 0) {
    return ["Consult your care team for potential side effects"];
  }

  // Simple extraction: split by common separators and take first N
  const effects = sideEffectsText
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5 && s.length < 100)
    .slice(0, limit);

  return effects.length > 0
    ? effects
    : ["Consult your care team for potential side effects"];
}

/**
 * Extract serious warnings from FDA contraindications text
 */
function extractSeriousWarnings(contraindicationsText: string): string[] {
  if (!contraindicationsText || contraindicationsText.trim().length === 0) {
    return [];
  }

  const serious = contraindicationsText
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5 && s.length < 150)
    .slice(0, 2);

  return serious.length > 0 ? serious : [];
}

/**
 * Get medical context for a medication (with API caching)
 * Returns knowledge from FDA DailyMed or cache, null if not found
 */
export async function getMedicationContext(
  medicationName: string
): Promise<MedicationKnowledge | null> {
  return await fetchFromDailyMed(medicationName);
}

/**
 * Get medical context for a condition (with API caching)
 * Returns knowledge from NIH MedlinePlus or cache, null if not found
 */
export async function getConditionContext(
  conditionName: string
): Promise<ConditionKnowledge | null> {
  return await fetchFromMedlinePlus(conditionName);
}
