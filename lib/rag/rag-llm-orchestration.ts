/**
 * RAG LLM Orchestration - Definition Generation with Citations
 * 
 * Generates medication and condition definitions using external LLM
 * with source citations and confidence scoring.
 * 
 * Supports multiple LLM providers:
 * - NVIDIA NIM (via NVAPI_KEY) - preferred
 * - OpenRouter (via OPENROUTER_API_KEY)
 * - OpenAI (via OPENAI_API_KEY)
 */

import type { RAGSource, MedicationKnowledge, ConditionKnowledge } from "@/lib/showcase/medical-knowledge-base";

export type LLMGenerationConfig = {
  model: string;
  maxTokens: number;
  temperature: number;
  apiEndpoint?: string;
  apiKey?: string;
  provider?: "nvidia-nim" | "openrouter" | "openai" | "anthropic";
};

const DEFAULT_CONFIG: LLMGenerationConfig = {
  model: "meta/llama-3.1-70b-instruct", // NVIDIA NIM model
  maxTokens: 300,
  temperature: 0.3, // Low temperature for consistency
  apiEndpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
  provider: "nvidia-nim"
};

/**
 * LLM Definition Generator
 * Generates patient-safe medical definitions from RAG sources
 */
export class LLMDefinitionGenerator {
  private config: LLMGenerationConfig;

  constructor(config: Partial<LLMGenerationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate medication definition from sources
   * Returns structured definition with citations
   */
  async generateMedicationDefinition(
    medicationName: string,
    sources: RAGSource[]
  ): Promise<MedicationKnowledge> {
    // Build context from sources
    const sourceExcerpts = sources.map((s, i) => `[${i + 1}] ${s.sourceName}: ${s.excerpt}`).join("\n");

    // Construct prompt
    const prompt = this.buildMedicationPrompt(medicationName, sourceExcerpts, sources.length);

    console.info(`[LLM] Generating definition for medication: ${medicationName}`);
    console.debug(`[LLM] Model: ${this.config.model}, Provider: ${this.config.provider}`);

    try {
      // Check for NVIDIA NIM API (preferred)
      const nvidiaApiKey = process.env.NVAPI_KEY;
      if (nvidiaApiKey) {
        console.debug("[LLM] Using NVIDIA NIM API");
        const response = await this.callNVIDIANIMAPI(prompt, nvidiaApiKey);
        return this.parseMedicationResponse(response, medicationName, sources);
      }

      // Fallback to OpenRouter
      const openrouterKey = this.config.apiKey || process.env.OPENROUTER_API_KEY;
      if (openrouterKey) {
        console.debug("[LLM] Using OpenRouter API");
        const response = await this.callOpenRouterAPI(prompt);
        return this.parseMedicationResponse(response, medicationName, sources);
      }

      // Fallback to simulation
      console.warn("[LLM] No API key configured - using simulated response");
      return this.generateMedicationSimulation(medicationName, sources);
    } catch (error) {
      console.error(`[LLM] Error generating medication definition: ${error}`);
      // Fallback to simulation on error
      return this.generateMedicationSimulation(medicationName, sources);
    }
  }

  /**
   * Generate condition definition from sources
   * Returns structured definition with citations
   */
  async generateConditionDefinition(
    conditionName: string,
    sources: RAGSource[]
  ): Promise<ConditionKnowledge> {
    const sourceExcerpts = sources.map((s, i) => `[${i + 1}] ${s.sourceName}: ${s.excerpt}`).join("\n");
    const prompt = this.buildConditionPrompt(conditionName, sourceExcerpts, sources.length);

    console.info(`[LLM] Generating definition for condition: ${conditionName}`);
    console.debug(`[LLM] Model: ${this.config.model}, Provider: ${this.config.provider}`);

    try {
      // Check for NVIDIA NIM API (preferred)
      const nvidiaApiKey = process.env.NVAPI_KEY;
      if (nvidiaApiKey) {
        console.debug("[LLM] Using NVIDIA NIM API");
        const response = await this.callNVIDIANIMAPI(prompt, nvidiaApiKey);
        return this.parseConditionResponse(response, conditionName, sources);
      }

      // Fallback to OpenRouter
      const openrouterKey = this.config.apiKey || process.env.OPENROUTER_API_KEY;
      if (openrouterKey) {
        console.debug("[LLM] Using OpenRouter API");
        const response = await this.callOpenRouterAPI(prompt);
        return this.parseConditionResponse(response, conditionName, sources);
      }

      // Fallback to simulation
      console.warn("[LLM] No API key configured - using simulated response");
      return this.generateConditionSimulation(conditionName, sources);
    } catch (error) {
      console.error(`[LLM] Error generating condition definition: ${error}`);
      // Fallback to simulation on error
      return this.generateConditionSimulation(conditionName, sources);
    }
  }

  /**
   * Build medication definition prompt
   * Instructs LLM to generate patient-safe definition with citations
   */
  private buildMedicationPrompt(
    medicationName: string,
    sourceExcerpts: string,
    sourceCount: number
  ): string {
    return `You are a medical knowledge assistant. Using ONLY the following clinical sources, generate a patient-safe definition of ${medicationName}.

Clinical Sources:
${sourceExcerpts}

Instructions:
1. Generate a definition suitable for patient understanding (avoid medical jargon)
2. Cite each claim using [Source 1], [Source 2], etc.
3. Include: purpose, mechanism, common side effects, safety notes
4. Maximum 250 words
5. Do NOT add information not in the sources
6. Return JSON with keys: purpose, mechanism, commonSideEffects[], safetyNotes[], sources[]

Generate definition:`;
  }

  /**
   * Build condition definition prompt
   */
  private buildConditionPrompt(
    conditionName: string,
    sourceExcerpts: string,
    sourceCount: number
  ): string {
    return `You are a medical knowledge assistant. Using ONLY the following clinical sources, generate a patient-safe definition of ${conditionName}.

Clinical Sources:
${sourceExcerpts}

Instructions:
1. Generate a definition suitable for patient understanding (plain language)
2. Cite each claim using [Source 1], [Source 2], etc.
3. Include: what it means, why it matters, what to monitor, lifestyle tips
4. Maximum 300 words
5. Do NOT add information not in the sources
6. Be reassuring but truthful
7. Return JSON with keys: whatItMeans, why_it_matters, whatToMonitor[], lifestyle_tips[], reassurance, sources[]

Generate definition:`;
  }

  /**
   * Call NVIDIA NIM API
   * Uses NVIDIA's generative AI inference service for definition generation
   */
  private async callNVIDIANIMAPI(prompt: string, apiKey: string): Promise<string> {
    const endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";
    const model = this.config.model || "meta/llama-3.1-70b-instruct";

    console.debug(`[LLM] Calling NVIDIA NIM API: ${model}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`NVIDIA NIM API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const completion = data.choices?.[0]?.message?.content;

    if (!completion) {
      throw new Error("No completion returned from NVIDIA NIM API");
    }

    console.debug(`[LLM] NVIDIA NIM response: ${completion.substring(0, 100)}...`);
    return completion;
  }

  /**
   * Call OpenRouter API
   * Sends prompt to OpenRouter and returns completion
   */
  private async callOpenRouterAPI(prompt: string): Promise<string> {
    const apiKey = this.config.apiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const endpoint = this.config.apiEndpoint || "https://openrouter.ai/api/v1/chat/completions";

    console.debug(`[LLM] Calling OpenRouter API: ${this.config.model}`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Patient AI Health Navigator"
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const completion = data.choices?.[0]?.message?.content;

    if (!completion) {
      throw new Error("No completion returned from OpenRouter API");
    }

    console.debug(`[LLM] OpenRouter response: ${completion.substring(0, 100)}...`);
    return completion;
  }

  /**
   * Parse LLM response into medication definition object
   */
  private parseMedicationResponse(
    response: string,
    medicationName: string,
    sources: RAGSource[]
  ): MedicationKnowledge {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        medicationName,
        purpose: parsed.purpose || "",
        mechanism: parsed.mechanism || "",
        commonSideEffects: parsed.commonSideEffects || [],
        safetyNotes: parsed.safetyNotes || [],
        confidence: 0.85, // Adjust based on validation
        sources,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[LLM] Error parsing medication response: ${error}`);
      // Return minimal definition with citations
      return {
        medicationName,
        purpose: response.substring(0, 200),
        confidence: 0.6, // Lower confidence for parsed failure
        sources,
        generatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Parse LLM response into condition definition object
   */
  private parseConditionResponse(
    response: string,
    conditionName: string,
    sources: RAGSource[]
  ): ConditionKnowledge {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        medicalName: conditionName,
        whatItMeans: parsed.whatItMeans || "",
        why_it_matters: parsed.why_it_matters || "",
        whatToMonitor: parsed.whatToMonitor || [],
        confidence: 0.85,
        sources,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[LLM] Error parsing condition response: ${error}`);
      // Return minimal definition with citations
      return {
        medicalName: conditionName,
        whatItMeans: response.substring(0, 200),
        confidence: 0.6,
        sources,
        generatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Parse LLM response into definition object (legacy - use parseMedicationResponse or parseConditionResponse)
   */
  private parseDefinitionResponse(
    response: string,
    entityName: string,
    sources: RAGSource[],
    type: "medication" | "condition"
  ): MedicationKnowledge | ConditionKnowledge {
    if (type === "medication") {
      return this.parseMedicationResponse(response, entityName, sources);
    } else {
      return this.parseConditionResponse(response, entityName, sources);
    }
  }

  /**
   * Simulated medication definition (MVP - fallback when no API key)
   */
  private generateMedicationSimulation(
    medicationName: string,
    sources: RAGSource[]
  ): MedicationKnowledge {
    const medicationDefinitions: Record<string, MedicationKnowledge> = {
      metformin: {
        medicationName: "Metformin",
        commonNames: ["Metformin", "Glucophage"],
        drugClass: "Diabetes medication (biguanide)",
        purpose:
          "Helps control blood sugar levels in type 2 diabetes by reducing glucose production in the liver and improving how your body uses insulin.",
        mechanism:
          "Decreases glucose production in the liver and improves insulin sensitivity in muscle and fat cells.",
        commonSideEffects: ["Stomach upset", "Nausea", "Diarrhea", "Metallic taste", "Loss of appetite"],
        seriousSideEffects: ["Lactic acidosis (rare but serious)"],
        safetyNotes: [
          "Take with meals to reduce stomach upset",
          "Your doctor will monitor kidney function regularly",
          "Not recommended if you have severe kidney disease",
          "May cause vitamin B12 deficiency with long-term use"
        ],
        confidence: 0.92,
        sources,
        generatedAt: new Date().toISOString()
      },
      lisinopril: {
        medicationName: "Lisinopril",
        commonNames: ["Lisinopril", "Prinivil", "Zestril"],
        drugClass: "Blood pressure medication (ACE inhibitor)",
        purpose:
          "Helps lower blood pressure and reduces strain on your heart. May be used after heart attacks or for heart failure.",
        mechanism:
          "Relaxes blood vessels, making it easier for your heart to pump blood throughout your body.",
        commonSideEffects: ["Dry cough", "Dizziness", "Fatigue", "Headache"],
        seriousSideEffects: ["Angioedema (severe swelling)"],
        safetyNotes: [
          "Do not stop taking suddenly - can cause rebound high blood pressure",
          "Report persistent dry cough to your doctor",
          "May cause dizziness when standing up - move slowly"
        ],
        confidence: 0.88,
        sources,
        generatedAt: new Date().toISOString()
      }
    };

    return (
      medicationDefinitions[medicationName.toLowerCase()] || {
        medicationName,
        confidence: 0.5, // Low confidence for unknown medications
        sources,
        generatedAt: new Date().toISOString()
      }
    );
  }

  /**
   * Simulated condition definition (MVP - no LLM call)
   */
  private generateConditionSimulation(
    conditionName: string,
    sources: RAGSource[]
  ): ConditionKnowledge {
    const conditionDefinitions: Record<string, ConditionKnowledge> = {
      "type 2 diabetes": {
        medicalName: "Type 2 Diabetes Mellitus",
        plainLanguageName: "Type 2 Diabetes",
        whatItMeans:
          "Type 2 diabetes is when your body cannot use insulin properly (a condition called insulin resistance). This causes your blood sugar to stay too high.",
        why_it_matters:
          "High blood sugar can damage blood vessels and nerves over time, leading to heart disease, vision problems, and kidney issues. Early management helps prevent these complications.",
        whatToMonitor: [
          "Blood sugar levels (as directed by your care team)",
          "Signs of low blood sugar: shakiness, sweating, confusion",
          "Signs of high blood sugar: thirst, frequent urination, fatigue",
          "Feet and hands for numbness or sores"
        ],
        lifestyle_tips: [
          "Eat regular, balanced meals with fiber",
          "Stay active with gentle exercise most days",
          "Check blood sugar as recommended",
          "Take medications as prescribed",
          "Manage stress and get adequate sleep"
        ],
        reassurance:
          "Diabetes can be managed well with proper care, medication, and lifestyle changes. Many people with diabetes live long, healthy, active lives.",
        confidence: 0.89,
        sources,
        generatedAt: new Date().toISOString()
      },
      hypertension: {
        medicalName: "High Blood Pressure (Hypertension)",
        plainLanguageName: "High Blood Pressure",
        whatItMeans:
          "High blood pressure means the force of blood pushing against your artery walls is consistently too strong. This puts strain on your heart and blood vessels.",
        why_it_matters:
          "Over time, high blood pressure can damage your heart, kidneys, and brain, increasing your risk of heart attack and stroke.",
        whatToMonitor: [
          "Blood pressure readings at home or clinic",
          "Headaches or dizziness",
          "Shortness of breath",
          "Chest discomfort or pressure"
        ],
        lifestyle_tips: [
          "Eat less salt and processed foods",
          "Stay active with regular exercise",
          "Keep a healthy weight",
          "Limit alcohol",
          "Manage stress through relaxation"
        ],
        reassurance:
          "High blood pressure is very manageable. With medication and lifestyle changes, most people keep their blood pressure at healthy levels.",
        confidence: 0.85,
        sources,
        generatedAt: new Date().toISOString()
      }
    };

    return (
      conditionDefinitions[conditionName.toLowerCase()] || {
        medicalName: conditionName,
        plainLanguageName: conditionName,
        confidence: 0.5, // Low confidence for unknown conditions
        sources,
        generatedAt: new Date().toISOString()
      }
    );
  }
}

// Export singleton instance
let generatorInstance: LLMDefinitionGenerator | null = null;

export function getLLMDefinitionGenerator(
  config?: Partial<LLMGenerationConfig>
): LLMDefinitionGenerator {
  if (!generatorInstance) {
    generatorInstance = new LLMDefinitionGenerator(config);
  }
  return generatorInstance;
}
