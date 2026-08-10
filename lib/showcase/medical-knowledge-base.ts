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
  synonyms?: string[];
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
 * Fallback medication knowledge base for common OTC and prescription drugs
 * Used when FDA API is unavailable
 */
const COMMON_MEDICATIONS: Record<string, MedicationKnowledge> = {
  acetaminophen: {
    commonNames: ["Acetaminophen", "Tylenol"],
    drugClass: "Pain reliever / Fever reducer",
    purpose: "Reduces pain, fever, and minor aches. Works throughout your body to help you feel more comfortable.",
    mechanism: "Reduces pain signals and helps lower body temperature by affecting the brain's temperature regulation.",
    commonSideEffects: ["Mild stomach upset", "Dizziness", "Rare: severe rash (stop immediately)"],
    safetyNotes: [
      "Do not exceed 4,000 mg per day",
      "Can cause liver damage if taken with alcohol",
      "Check all over-the-counter products for acetaminophen content"
    ],
    source: "Common medical knowledge / FDA"
  },
  aspirin: {
    commonNames: ["Aspirin", "Bayer"],
    drugClass: "Pain reliever / Anticoagulant",
    purpose: "Reduces pain, fever, and inflammation. Sometimes used to prevent blood clots and heart attacks.",
    mechanism: "Reduces pain signals and inflammatory chemicals in the body.",
    commonSideEffects: ["Stomach upset", "Heartburn", "Easy bruising"],
    safetyNotes: [
      "Do not take if allergic to aspirin",
      "Take with food or water to reduce stomach upset",
      "Do not use before surgery unless directed by doctor"
    ],
    source: "Common medical knowledge / FDA"
  },
  ibuprofen: {
    commonNames: ["Ibuprofen", "Advil", "Motrin"],
    drugClass: "Anti-inflammatory pain reliever",
    purpose: "Reduces pain, fever, and inflammation. Helps with headaches, muscle aches, and menstrual cramps.",
    mechanism: "Reduces inflammatory chemicals in the body that cause pain and swelling.",
    commonSideEffects: ["Stomach upset", "Heartburn", "Mild dizziness"],
    safetyNotes: [
      "Take with food or milk to reduce stomach upset",
      "Do not exceed 1,200 mg per day without doctor approval",
      "Can affect blood pressure and kidney function with long-term use"
    ],
    source: "Common medical knowledge / FDA"
  },
  metformin: {
    commonNames: ["Metformin", "Glucophage"],
    drugClass: "Diabetes medication",
    purpose: "Helps control blood sugar levels in type 2 diabetes. Reduces sugar production in the liver.",
    mechanism: "Decreases glucose production and improves how your body uses glucose.",
    commonSideEffects: ["Stomach upset", "Nausea", "Metallic taste"],
    safetyNotes: [
      "Take with meals to reduce stomach upset",
      "Your doctor will monitor kidney function while you take this",
      "Do not use if you have severe kidney disease"
    ],
    source: "Common medical knowledge / FDA"
  },
  lisinopril: {
    commonNames: ["Lisinopril", "Prinivil", "Zestril"],
    drugClass: "Blood pressure medication",
    purpose: "Helps lower blood pressure and reduce strain on your heart. May be used after heart attacks.",
    mechanism: "Relaxes blood vessels, making it easier for your heart to pump blood throughout your body.",
    commonSideEffects: ["Dry cough", "Dizziness", "Headache"],
    safetyNotes: [
      "Do not stop taking suddenly",
      "May cause dizziness when standing up",
      "Report persistent cough to your doctor"
    ],
    source: "Common medical knowledge / FDA"
  },
  metoprolol: {
    commonNames: ["Metoprolol", "Lopressor", "Toprol-XL"],
    drugClass: "Beta blocker",
    purpose: "Lowers blood pressure and heart rate. Used for high blood pressure, heart disease, and migraine prevention.",
    mechanism: "Slows heart rate and reduces the force of heart contractions, lowering blood pressure.",
    commonSideEffects: ["Fatigue", "Slow heart rate", "Shortness of breath with exertion"],
    safetyNotes: [
      "Do not stop suddenly - can cause rebound high blood pressure",
      "Tell doctor if you have asthma or breathing problems",
      "May mask low blood sugar symptoms in diabetics"
    ],
    source: "Common medical knowledge / FDA"
  },
  atorvastatin: {
    commonNames: ["Atorvastatin", "Lipitor"],
    drugClass: "Statin (cholesterol medication)",
    purpose: "Lowers cholesterol levels to reduce heart disease and stroke risk.",
    mechanism: "Blocks an enzyme needed to make cholesterol, reducing cholesterol production in the liver.",
    commonSideEffects: ["Muscle pain", "Mild stomach upset", "Headache"],
    safetyNotes: [
      "Can cause muscle damage with certain other medications",
      "Report unexplained muscle pain to your doctor",
      "Grapefruit juice may increase side effects"
    ],
    source: "Common medical knowledge / FDA"
  },
  omeprazole: {
    commonNames: ["Omeprazole", "Prilosec"],
    drugClass: "Proton pump inhibitor",
    purpose: "Reduces stomach acid to treat heartburn, acid reflux, and ulcers.",
    mechanism: "Blocks acid production in the stomach, allowing the lining to heal.",
    commonSideEffects: ["Headache", "Diarrhea or constipation", "Nausea"],
    safetyNotes: [
      "Long-term use may reduce vitamin B12 and calcium absorption",
      "Take 30-60 minutes before a meal",
      "May reduce effectiveness of some other medications"
    ],
    source: "Common medical knowledge / FDA"
  },
  sertraline: {
    commonNames: ["Sertraline", "Zoloft"],
    drugClass: "Antidepressant (SSRI)",
    purpose: "Treats depression, anxiety, and panic disorder by improving mood and reducing worry.",
    mechanism: "Increases serotonin levels in the brain, improving mood and anxiety regulation.",
    commonSideEffects: ["Nausea", "Sleep problems", "Sexual dysfunction", "Dry mouth"],
    safetyNotes: [
      "Takes 4-6 weeks for full effect",
      "Do not stop suddenly - taper with doctor guidance",
      "May increase suicidal thoughts in teens and young adults initially"
    ],
    source: "Common medical knowledge / FDA"
  },
  levothyroxine: {
    commonNames: ["Levothyroxine", "Synthroid"],
    drugClass: "Thyroid hormone replacement",
    purpose: "Replaces thyroid hormone in people with an underactive thyroid (hypothyroidism).",
    mechanism: "Provides the thyroid hormone your body cannot produce, regulating metabolism and energy.",
    commonSideEffects: ["Anxiety", "Tremors", "Heat sensitivity", "Weight changes"],
    safetyNotes: [
      "Take on empty stomach, 30 minutes before breakfast",
      "Dose needs regular monitoring with blood tests",
      "Many medications and supplements interact with this drug"
    ],
    source: "Common medical knowledge / FDA"
  }
};

/**
 * Fallback condition knowledge base for common health conditions
 * Used when MedlinePlus API is unavailable
 */
const COMMON_CONDITIONS: Record<string, ConditionKnowledge> = {
  diabetes: {
    medicalName: "Diabetes Mellitus",
    plainLanguageName: "Diabetes",
    whatItMeans:
      "Diabetes is when your blood sugar levels stay too high. Your body either can't make enough insulin or can't use it properly.",
    why_it_matters:
      "High blood sugar can damage blood vessels and nerves over time, leading to heart disease, vision problems, and kidney issues.",
    whatToMonitor: [
      "Blood sugar levels (as directed by your care team)",
      "Signs of low blood sugar: shakiness, sweating, confusion",
      "Signs of high blood sugar: thirst, frequent urination, fatigue",
      "Feet and hands for numbness or sores"
    ],
    lifestyle_tips: [
      "✓ Eat regular, balanced meals with fiber",
      "✓ Stay active with gentle exercise most days",
      "✓ Check blood sugar as recommended",
      "✓ Take medications as prescribed"
    ],
    reassurance:
      "Diabetes can be managed well with proper care. Many people with diabetes live long, healthy lives.",
    source: "NIH MedlinePlus"
  },
  hypertension: {
    medicalName: "High Blood Pressure (Hypertension)",
    plainLanguageName: "High Blood Pressure",
    whatItMeans:
      "High blood pressure means the force of blood pushing against your artery walls is too strong, putting strain on your heart.",
    why_it_matters:
      "Over time, high blood pressure can damage your heart, kidneys, and brain, increasing risk of heart attack and stroke.",
    whatToMonitor: [
      "Blood pressure readings at home or clinic",
      "Headaches or dizziness",
      "Shortness of breath",
      "Chest discomfort"
    ],
    lifestyle_tips: [
      "✓ Eat less salt and processed foods",
      "✓ Stay active with regular exercise",
      "✓ Keep a healthy weight",
      "✓ Limit alcohol and manage stress"
    ],
    reassurance:
      "High blood pressure is very manageable. Many people keep their blood pressure at healthy levels with medication and lifestyle changes.",
    source: "NIH MedlinePlus"
  },
  asthma: {
    medicalName: "Asthma",
    plainLanguageName: "Asthma",
    whatItMeans:
      "Asthma causes your airways to narrow and swell, making it harder to breathe. You may cough, wheeze, or feel chest tightness.",
    why_it_matters:
      "Untreated asthma can lead to serious breathing problems. Proper management helps prevent asthma attacks.",
    whatToMonitor: [
      "Wheezing or difficulty breathing",
      "Persistent cough, especially at night or with activity",
      "Chest tightness or pain",
      "Tiredness or weakness during exercise"
    ],
    lifestyle_tips: [
      "✓ Use your rescue inhaler as prescribed",
      "✓ Avoid known triggers (allergens, cold air, exercise)",
      "✓ Keep air clean and avoid smoke",
      "✓ Stay physically active within your limits"
    ],
    reassurance:
      "With proper treatment, most people with asthma can live normal, active lives.",
    source: "NIH MedlinePlus"
  },
  heartdisease: {
    medicalName: "Heart Disease",
    plainLanguageName: "Heart Disease",
    whatItMeans:
      "Heart disease includes several conditions where the heart doesn't work properly. Common types include blocked arteries and weakened heart muscle.",
    why_it_matters:
      "Heart disease is the leading cause of death. Early detection and treatment can prevent serious complications.",
    whatToMonitor: [
      "Chest pain or pressure",
      "Shortness of breath",
      "Swelling in legs or feet",
      "Unusual fatigue or weakness",
      "Heart palpitations"
    ],
    lifestyle_tips: [
      "✓ Take heart medications as prescribed",
      "✓ Eat a heart-healthy diet (low salt, low fat)",
      "✓ Exercise gently as your doctor recommends",
      "✓ Manage stress and get adequate sleep"
    ],
    reassurance:
      "Modern treatments can help manage heart disease well. Many people live long, active lives with heart disease.",
    source: "NIH MedlinePlus"
  },
  arthritis: {
    medicalName: "Arthritis",
    plainLanguageName: "Arthritis",
    whatItMeans:
      "Arthritis causes joint pain, stiffness, and swelling. There are many types, with the most common being osteoarthritis and rheumatoid arthritis.",
    why_it_matters:
      "Arthritis can limit your mobility and quality of life. Proper treatment can help manage pain and keep joints working.",
    whatToMonitor: [
      "Joint pain or stiffness, especially in the morning",
      "Swelling or warmth in joints",
      "Decreased range of motion",
      "Pain that worsens with activity"
    ],
    lifestyle_tips: [
      "✓ Stay active with low-impact exercise like walking or swimming",
      "✓ Apply heat or cold to joints as needed",
      "✓ Maintain healthy weight to reduce joint stress",
      "✓ Use assistive devices if needed"
    ],
    reassurance:
      "Many effective treatments exist for arthritis. Most people can continue enjoying activities they love.",
    source: "NIH MedlinePlus"
  }
};

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
    const url = `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=${encodeURIComponent(
      medicationName
    )}`;
    
    const response = await fetch(url, {
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      console.warn(`[FDA API] Status ${response.status} for ${medicationName}`);
      return null;
    }

    const text = await response.text();
    
    // Check if response is empty or malformed
    if (!text || text.trim().length === 0) {
      console.warn(`[FDA API] Empty response for ${medicationName}`);
      return null;
    }

    const data = JSON.parse(text) as unknown;
    const result = parseDailyMedResponse(medicationName, data);

    if (result) {
      cache.set(cacheKey, result);
      console.info(`[FDA API] Successfully fetched context for ${medicationName}`);
    } else {
      console.warn(`[FDA API] Failed to parse response for ${medicationName}`);
    }
    return result;
  } catch (error) {
    console.error(`[FDA API] Failed to fetch DailyMed data for ${medicationName}:`, error);
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
 * Fetch condition information from NIH MedlinePlus JSON API
 * Uses the structured genetics database with complete JSON format
 * Reference: https://medlineplus.gov/about/data-files-api
 */
async function fetchFromMedlinePlus(conditionName: string): Promise<ConditionKnowledge | null> {
  const cacheKey = `cond_${conditionName.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached as ConditionKnowledge;
  }

  try {
    // Convert condition name to URL slug format (e.g., "Type 2 Diabetes" → "type-2-diabetes")
    const conditionSlug = conditionName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    // MedlinePlus JSON API for genetics conditions with structured data
    const url = `https://medlineplus.gov/download/genetics/condition/${conditionSlug}.json`;

    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[MedlinePlus JSON API] Status ${response.status} for ${conditionName} (slug: ${conditionSlug})`);
      return null;
    }

    const data = (await response.json()) as unknown;

    const result = parseMedlinePlusJSON(conditionName, data);

    if (result) {
      cache.set(cacheKey, result);
      console.info(`[MedlinePlus JSON API] Successfully fetched context for ${conditionName}`);
    } else {
      console.warn(`[MedlinePlus JSON API] Failed to parse response for ${conditionName}`);
    }
    return result;
  } catch (error) {
    console.error(`[MedlinePlus JSON API] Failed to fetch data for ${conditionName}:`, error);
    return null;
  }
}

/**
 * Parse MedlinePlus JSON response into patient-safe format
 * JSON structure: { name, text-list, synonym-list, db-key-list, reviewed, published }
 * Reference: https://medlineplus.gov/about/data-files-api
 */
function parseMedlinePlusJSON(conditionName: string, data: unknown): ConditionKnowledge | null {
  try {
    if (!data || typeof data !== "object") {
      return null;
    }

    const medlineData = data as Record<string, unknown>;
    const name = (medlineData.name as string) || conditionName;

    // Extract main description from text-list
    let plainLanguageSummary = "This condition is being monitored by your care team.";
    const textList = medlineData["text-list"] as unknown[];
    if (Array.isArray(textList) && textList.length > 0) {
      const firstText = textList[0] as Record<string, unknown>;
      const textContent = firstText.text as Record<string, unknown>;
      const htmlContent = (textContent?.html as string) || "";
      if (htmlContent) {
        // Extract first paragraph and clean HTML
        plainLanguageSummary = stripHtmlTags(htmlContent)
          .split("\n")[0]
          .substring(0, 400);
      }
    }

    // Extract synonyms from synonym-list
    const synonymList = medlineData["synonym-list"] as unknown[];
    const synonyms: string[] = [];
    if (Array.isArray(synonymList)) {
      for (const syn of synonymList.slice(0, 3)) {
        const synObj = syn as Record<string, unknown>;
        const synText = synObj.synonym as string;
        if (synText) {
          synonyms.push(synText);
        }
      }
    }

    return {
      medicalName: name,
      plainLanguageName: name.replace(/\(.*?\)/g, "").trim(),
      whatItMeans: plainLanguageSummary,
      why_it_matters:
        "Understanding your condition helps you work better with your care team. This can lead to better health outcomes.",
      whatToMonitor: [
        "Changes in your symptoms",
        "Any new or worsening symptoms",
        "Your regular medical appointments"
      ],
      lifestyle_tips: [
        "✓ Keep all appointments with your care team",
        "✓ Take medications as prescribed",
        "✓ Report any changes in how you feel"
      ],
      reassurance:
        "Your care team is here to help manage this condition. Many conditions can be successfully managed with proper treatment and self-care.",
      source: "NIH MedlinePlus",
      synonyms,
      rawData: medlineData
    };
  } catch (error) {
    console.error(`[MedlinePlus JSON Parser] Failed to parse response for ${conditionName}:`, error);
    return null;
  }
}

/**
 * Strip HTML tags and entities from text
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<span class="[^"]*">|<\/span>/g, ""); // Remove highlighting spans
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
 * Get medical context for a medication (with API caching and fallback)
 * Returns knowledge from FDA DailyMed, fallback database, or cache
 */
export async function getMedicationContext(
  medicationName: string
): Promise<MedicationKnowledge | null> {
  // Try FDA API first
  const apiResult = await fetchFromDailyMed(medicationName);
  if (apiResult) {
    return apiResult;
  }

  // Fallback to common medications database
  const fallbackKey = medicationName.toLowerCase();
  if (COMMON_MEDICATIONS[fallbackKey]) {
    return COMMON_MEDICATIONS[fallbackKey];
  }

  return null;
}

/**
 * Get medical context for a condition (with API caching and fallback)
 * Returns knowledge from MedlinePlus, fallback database, or cache
 */
export async function getConditionContext(
  conditionName: string
): Promise<ConditionKnowledge | null> {
  // Try MedlinePlus API first
  const apiResult = await fetchFromMedlinePlus(conditionName);
  if (apiResult) {
    return apiResult;
  }

  // Fallback to common conditions database
  const fallbackKey = conditionName.toLowerCase().replace(/\s+/g, "");
  for (const [key, value] of Object.entries(COMMON_CONDITIONS)) {
    if (key === fallbackKey || (value.plainLanguageName?.toLowerCase().replace(/\s+/g, "") === fallbackKey)) {
      return value;
    }
  }

  return null;
}
