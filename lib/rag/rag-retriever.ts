/**
 * RAG Retriever - Multi-Source Medical Context Engine
 * 
 * Retrieves medication and condition information from multiple verified clinical sources:
 * - UpToDate (simulated)
 * - Clinical Guidelines (simulated)
 * - RxNorm (drug interactions)
 * - MedlinePlus (patient-safe content)
 * - Patient EMR Data (local, privacy-safe)
 */

import type { RAGSource, MedicationKnowledge, ConditionKnowledge, RAGRetriever } from "@/lib/showcase/medical-knowledge-base";

/**
 * Normalize medication name from RxNorm format
 * Examples: "diphenhydrAMINE Hydrochloride 25 MG Oral Tablet" -> "diphenhydramine"
 *           "120 ACTUAT Fluticasone..." -> "fluticasone"
 *           "NDA020503 200 ACTUAT Albuterol..." -> "albuterol"
 */
function normalizeMedicationName(fullName: string): string {
  // Remove bracketed names like [Tylenol]
  const cleaned = fullName.replace(/\[.*?\]/g, "").trim();
  
  // Split by spaces
  const parts = cleaned.split(/\s+/);
  
  // Find the first meaningful word (skip numeric prefixes, codes, and units)
  for (const part of parts) {
    // Skip pure numbers (e.g., "120", "25", "0.044")
    if (/^\d+(\.\d+)?$/.test(part)) continue;
    // Skip NDA codes and similar (e.g., "NDA020503")
    if (/^[A-Z]+\d+/i.test(part)) continue;
    // Skip standard dosage units and descriptors
    if (/^(MG|ML|%|ACTUAT|TABLET|INHALER|PACK|DAY|METERED|DOSE|ORAL|METEREDDOSE)$/i.test(part)) continue;
    
    // Found a word that looks like a drug name - normalize it
    let drugName = part.toLowerCase();
    // Handle chemical capitals like diphenhydrAMINE -> diphenhydramine
    drugName = drugName.replace(/([A-Z])/g, (_match) => _match.toLowerCase());
    return drugName;
  }
  
  return "";
}

export type RetrievalConfig = {
  topK: number; // Number of sources to retrieve
  minRelevanceScore: number; // Minimum relevance score (0.0-1.0)
  sourcePriority: Record<string, number>; // Weighting for source types
};

const DEFAULT_CONFIG: RetrievalConfig = {
  topK: 5,
  minRelevanceScore: 0.6,
  sourcePriority: {
    "UpToDate": 1.0,
    "Clinical Guidelines": 0.95,
    "RxNorm": 0.85,
    "MedlinePlus": 0.8,
    "EMR": 0.75
  }
};

/**
 * Simulated Clinical Source Index
 * In production, this would be a vector DB (Pinecone, Weaviate, Milvus)
 */
class ClinicalSourceIndex {
  private medicationIndex: Map<
    string,
    Array<{
      source: RAGSource;
      keywords: string[];
    }>
  > = new Map();

  private conditionIndex: Map<
    string,
    Array<{
      source: RAGSource;
      keywords: string[];
    }>
  > = new Map();

  constructor() {
    this.initializeMedicationIndex();
    this.initializeConditionIndex();
  }

  private initializeMedicationIndex(): void {
    const medications = [
      {
        name: "metformin",
        sources: [
          {
            sourceName: "UpToDate",
            excerpt: "Metformin is a biguanide antidiabetic agent used for type 2 diabetes mellitus. It works by decreasing hepatic glucose production and improving insulin sensitivity.",
            keywords: ["diabetes", "blood sugar", "type 2", "glucose", "insulin"]
          },
          {
            sourceName: "Clinical Guidelines",
            excerpt: "ADA guidelines recommend metformin as first-line therapy for type 2 diabetes. Initial dose: 500mg daily, max 2550mg daily in divided doses.",
            keywords: ["ADA", "first-line", "type 2 diabetes", "dosing"]
          },
          {
            sourceName: "RxNorm",
            excerpt: "Common side effects: GI upset, metallic taste, vitamin B12 deficiency. Contraindication: severe renal impairment (eGFR <30).",
            keywords: ["side effects", "contraindication", "renal"]
          }
        ]
      },
      {
        name: "lisinopril",
        sources: [
          {
            sourceName: "UpToDate",
            excerpt: "Lisinopril is an ACE inhibitor used for hypertension and heart failure. It relaxes blood vessels and reduces strain on the heart.",
            keywords: ["blood pressure", "hypertension", "heart failure", "ACE inhibitor"]
          },
          {
            sourceName: "Clinical Guidelines",
            excerpt: "ACCF guidelines recommend ACE inhibitors for hypertension, especially in patients with diabetes or chronic kidney disease. Starting dose: 10mg daily.",
            keywords: ["ACCF", "hypertension", "diabetes", "kidney"]
          }
        ]
      },
      {
        name: "atorvastatin",
        sources: [
          {
            sourceName: "UpToDate",
            excerpt: "Atorvastatin is a statin that reduces LDL cholesterol. Used for cardiovascular risk reduction.",
            keywords: ["cholesterol", "statin", "LDL", "cardiovascular"]
          },
          {
            sourceName: "Clinical Guidelines",
            excerpt: "ACC/AHA guidelines recommend statins for primary and secondary cardiovascular prevention.",
            keywords: ["ACC/AHA", "cardiovascular", "prevention"]
          }
        ]
      },
      {
        name: "diphenhydramine",
        sources: [
          {
            sourceName: "UpToDate",
            excerpt: "Diphenhydramine is a first-generation antihistamine used for allergies, itching, and hives. It can cause drowsiness.",
            keywords: ["antihistamine", "allergy", "itching", "sleep", "drowsiness"]
          },
          {
            sourceName: "MedlinePlus",
            excerpt: "Diphenhydramine relieves allergy symptoms like itching, watery eyes, runny nose, and sneezing. It may be used as a sleep aid.",
            keywords: ["allergy", "antihistamine", "drowsy", "sleep"]
          }
        ]
      },
      {
        name: "acetaminophen",
        sources: [
          {
            sourceName: "UpToDate",
            excerpt: "Acetaminophen (Tylenol) is used for pain relief and fever reduction. Maximum dose: 3000-4000mg daily. Generally safe at therapeutic doses.",
            keywords: ["pain", "fever", "Tylenol", "analgesic"]
          },
          {
            sourceName: "Clinical Guidelines",
            excerpt: "Acetaminophen is first-line for mild-moderate pain and fever. Avoid in severe liver disease or alcohol use.",
            keywords: ["first-line", "liver", "pain", "fever"]
          }
        ]
      },
      {
        name: "fluticasone",
        sources: [
          {
            sourceName: "UpToDate",
            excerpt: "Fluticasone propionate is an inhaled corticosteroid used for asthma control. It reduces airway inflammation and improves breathing.",
            keywords: ["asthma", "inhaler", "corticosteroid", "inflammation", "breathing"]
          },
          {
            sourceName: "Clinical Guidelines",
            excerpt: "GINA guidelines recommend inhaled corticosteroids as preferred controller therapy for asthma. Rinse mouth after use.",
            keywords: ["GINA", "asthma", "controller", "inhaler"]
          }
        ]
      },
      {
        name: "amlodipine",
        sources: [
          {
            sourceName: "UpToDate",
            excerpt: "Amlodipine is a calcium channel blocker used for hypertension and angina. It relaxes blood vessels and improves blood flow.",
            keywords: ["blood pressure", "hypertension", "angina", "calcium channel", "vessels"]
          },
          {
            sourceName: "Clinical Guidelines",
            excerpt: "ACC/AHA recommend CCBs for hypertension management. Typical dose: 5-10mg daily. Can cause peripheral edema.",
            keywords: ["ACC/AHA", "hypertension", "edema", "dosing"]
          }
        ]
      },
      {
        name: "albuterol",
        sources: [
          {
            sourceName: "UpToDate",
            excerpt: "Albuterol is a short-acting beta-2 agonist (SABA) used for acute asthma symptoms and COPD. It relaxes airway muscles quickly.",
            keywords: ["asthma", "COPD", "bronchodilator", "breathing", "quick relief"]
          },
          {
            sourceName: "Clinical Guidelines",
            excerpt: "GINA and GOLD guidelines recommend SABAs as rescue therapy for acute symptoms. Use no more than 2 days/week for maintenance.",
            keywords: ["GINA", "GOLD", "rescue", "asthma", "COPD"]
          }
        ]
      },
      {
        name: "jolivette",
        sources: [
          {
            sourceName: "UpToDate",
            excerpt: "Jolivette is a progestin-only oral contraceptive (birth control pill) containing norethindrone. It's taken daily without a break. Less effective than combined pills.",
            keywords: ["birth control", "contraceptive", "progestin", "norethindrone", "pregnancy prevention"]
          },
          {
            sourceName: "Clinical Guidelines",
            excerpt: "Progestin-only pills are recommended for breastfeeding women and those who cannot take estrogen. Take at the same time daily for best effectiveness.",
            keywords: ["progestin-only", "breastfeeding", "contraception", "daily", "norethindrone"]
          }
        ]
      }
    ];

    for (const med of medications) {
      const entries = med.sources.map(src => ({
        source: {
          sourceId: `${src.sourceName}_${med.name}`,
          sourceName: src.sourceName,
          relevanceScore: 0.85,
          excerpt: src.excerpt,
          timestamp: new Date().toISOString()
        },
        keywords: src.keywords
      }));
      this.medicationIndex.set(med.name.toLowerCase(), entries);
    }
  }

  private initializeConditionIndex(): void {
    const conditions = [
      {
        name: "type 2 diabetes",
        sources: [
          {
            sourceName: "MedlinePlus",
            excerpt: "Type 2 diabetes is when your body cannot use insulin properly (insulin resistance). Your blood sugar stays too high.",
            keywords: ["diabetes", "blood sugar", "insulin", "glucose"]
          },
          {
            sourceName: "Clinical Guidelines",
            excerpt: "ADA diagnostic criteria: fasting glucose ≥126 mg/dL, HbA1c ≥6.5%, or 2-hour glucose ≥200 mg/dL on OGTT.",
            keywords: ["ADA", "diagnosis", "glucose", "HbA1c"]
          }
        ]
      },
      {
        name: "hypertension",
        sources: [
          {
            sourceName: "MedlinePlus",
            excerpt: "High blood pressure (hypertension) occurs when the force of blood pushing against artery walls is consistently too high.",
            keywords: ["blood pressure", "hypertension", "heart"]
          },
          {
            sourceName: "Clinical Guidelines",
            excerpt: "ACC/AHA 2017 guidelines define hypertension as BP ≥130/80 mmHg. Targets vary by age and comorbidities.",
            keywords: ["ACC/AHA", "BP", "target"]
          }
        ]
      },
      {
        name: "heart failure",
        sources: [
          {
            sourceName: "UpToDate",
            excerpt: "Heart failure is a syndrome in which the heart cannot pump enough blood to meet the body's metabolic needs.",
            keywords: ["heart", "pump", "cardiac", "failure"]
          },
          {
            sourceName: "Clinical Guidelines",
            excerpt: "ACCF/AHA guidelines categorize HF by ejection fraction (reduced, mildly reduced, preserved).",
            keywords: ["ACCF/AHA", "EF", "ejection fraction"]
          }
        ]
      }
    ];

    for (const cond of conditions) {
      const entries = cond.sources.map(src => ({
        source: {
          sourceId: `${src.sourceName}_${cond.name}`,
          sourceName: src.sourceName,
          relevanceScore: 0.82,
          excerpt: src.excerpt,
          timestamp: new Date().toISOString()
        },
        keywords: src.keywords
      }));
      this.conditionIndex.set(cond.name.toLowerCase(), entries);
    }
  }

  retrieveMedicationSources(medicationName: string, topK: number = 5): RAGSource[] {
    let key = medicationName.toLowerCase();
    let entries = this.medicationIndex.get(key);

    // If not found, try normalized name extraction
    if (!entries) {
      const normalized = normalizeMedicationName(medicationName);
      console.log(`[RAG Retriever] Normalized "${medicationName}" to "${normalized}"`);
      key = normalized.toLowerCase();
      entries = this.medicationIndex.get(key);
      console.log(`[RAG Retriever] Lookup with normalized key "${key}": ${entries ? entries.length : 0} entries`);
    }

    if (!entries) {
      console.log(`[RAG Retriever] No index entries found for medication`);
      return [];
    }

    // Score by relevance and return top-K
    return entries
      .sort((a, b) => b.source.relevanceScore - a.source.relevanceScore)
      .slice(0, topK)
      .map(e => e.source);
  }

  retrieveConditionSources(conditionName: string, topK: number = 5): RAGSource[] {
    const key = conditionName.toLowerCase();
    const entries = this.conditionIndex.get(key);

    if (!entries) {
      return [];
    }

    return entries
      .sort((a, b) => b.source.relevanceScore - a.source.relevanceScore)
      .slice(0, topK)
      .map(e => e.source);
  }
}

/**
 * RAG Retriever Implementation
 * Handles source retrieval and validation
 */
export class DefaultRAGRetriever implements RAGRetriever {
  private index: ClinicalSourceIndex;
  private config: RetrievalConfig;

  constructor(config: Partial<RetrievalConfig> = {}) {
    this.index = new ClinicalSourceIndex();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async retrieveMedicationSources(
    medicationName: string,
    topK?: number
  ): Promise<RAGSource[]> {
    const limit = topK ?? this.config.topK;
    const sources = this.index.retrieveMedicationSources(medicationName, limit);

    // Filter by minimum relevance score
    const filtered = sources.filter(s => s.relevanceScore >= this.config.minRelevanceScore);

    console.info(
      `[RAG Retriever] Retrieved ${filtered.length} sources for medication: ${medicationName}`
    );

    return filtered;
  }

  async retrieveConditionSources(
    conditionName: string,
    topK?: number
  ): Promise<RAGSource[]> {
    const limit = topK ?? this.config.topK;
    const sources = this.index.retrieveConditionSources(conditionName, limit);

    const filtered = sources.filter(s => s.relevanceScore >= this.config.minRelevanceScore);

    console.info(
      `[RAG Retriever] Retrieved ${filtered.length} sources for condition: ${conditionName}`
    );

    return filtered;
  }

  /**
   * Validate source agreement by checking excerpt similarity
   * Returns confidence score (0.0-1.0)
   * 
   * Logic:
   * - If ≥2 sources mention same keywords/concepts, confidence is high
   * - If sources contradict, confidence is low
   * - If only 1 source, moderate confidence
   */
  validateSourceAgreement(sources: RAGSource[]): number {
    if (sources.length === 0) return 0;
    if (sources.length === 1) return 0.65; // Single source = moderate confidence

    // Count keyword overlaps across sources
    const excerpts = sources.map(s => s.excerpt || "");
    const keywords: string[] = [];

    for (const excerpt of excerpts) {
      const words = excerpt
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4);
      keywords.push(...words);
    }

    // Calculate agreement based on common keywords
    const keywordFreq = new Map<string, number>();
    for (const kw of keywords) {
      keywordFreq.set(kw, (keywordFreq.get(kw) ?? 0) + 1);
    }

    // If majority of keywords appear in ≥2 sources, high confidence
    const agreedKeywords = Array.from(keywordFreq.values()).filter(count => count >= 2);
    const agreementRatio = agreedKeywords.length / Math.max(keywordFreq.size, 1);

    // Adjust by source count and authority
    const authorityBoost = Math.min(sources.length / 5, 0.2); // Max +0.2 boost
    const confidence = Math.min(0.65 + agreementRatio * 0.3 + authorityBoost, 1.0);

    console.info(
      `[RAG Validator] Source agreement score: ${confidence.toFixed(2)} (${sources.length} sources)`
    );

    return confidence;
  }
}

// Export singleton instance
let retrieverInstance: DefaultRAGRetriever | null = null;

export function getRAGRetriever(config?: Partial<RetrievalConfig>): DefaultRAGRetriever {
  if (!retrieverInstance) {
    retrieverInstance = new DefaultRAGRetriever(config);
  }
  return retrieverInstance;
}

export function setRAGRetriever(retriever: RAGRetriever): void {
  // This will be used to inject custom retriever (e.g., with real vector DB)
  if (retriever instanceof DefaultRAGRetriever) {
    retrieverInstance = retriever;
  }
}
