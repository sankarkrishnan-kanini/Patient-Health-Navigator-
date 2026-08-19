export type ModelGenerationInvocation = {
  conversationId: string;
  patientId: string;
  message: string;
};

export const NO_MODEL_PROVIDER_RESPONSE = "__NO_MODEL_PROVIDER_RESPONSE__";

type ProviderName = "openrouter" | "gemini" | "groq" | "nvidia-nim";

type ProviderConfig = {
  provider: ProviderName;
  model: string;
  baseURL?: string;
  apiKey?: string;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type OpenAIChatStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
  }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

function getProviderConfig(): ProviderConfig {
  const provider = (process.env.LLM_PROVIDER ?? "").toLowerCase();

  // Check for NVIDIA NIM first (highest priority)
  if (provider === "nvidia-nim" || process.env.NVAPI_KEY) {
    return {
      provider: "nvidia-nim",
      apiKey: process.env.NVAPI_KEY,
      model: process.env.NVIDIA_NIM_MODEL ?? "meta/llama-3.1-70b-instruct",
      baseURL: "https://integrate.api.nvidia.com/v1"
    };
  }

  if (provider === "gemini") {
    return {
      provider: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
    };
  }

  if (provider === "groq") {
    return {
      provider: "groq",
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL ?? "llama-3.1-70b-versatile",
      baseURL: "https://api.groq.com/openai/v1"
    };
  }

  if (provider === "openrouter") {
    return {
      provider: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o",
      baseURL: "https://openrouter.ai/api/v1"
    };
  }

  // Fallback: Check for available API keys
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
    };
  }

  if (process.env.GROQ_API_KEY) {
    return {
      provider: "groq",
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL ?? "llama-3.1-70b-versatile",
      baseURL: "https://api.groq.com/openai/v1"
    };
  }

  // Only use OpenRouter if it has a real API key (not placeholder)
  const openrouterKey = process.env.OPENROUTER_API_KEY || "";
  if (openrouterKey && !openrouterKey.includes("your-")) {
    return {
      provider: "openrouter",
      apiKey: openrouterKey,
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o",
      baseURL: "https://openrouter.ai/api/v1"
    };
  }

  // Default fallback
  return {
    provider: "nvidia-nim",
    apiKey: process.env.NVAPI_KEY,
    model: process.env.NVIDIA_NIM_MODEL ?? "meta/llama-3.1-70b-instruct",
    baseURL: "https://integrate.api.nvidia.com/v1"
  };
}

function buildInvocationPrompt(invocation: ModelGenerationInvocation): string {
  return [
    `Conversation ID: ${invocation.conversationId}`,
    `Patient ID: ${invocation.patientId}`,
    `User message: ${invocation.message}`,
    "Respond concisely, in plain language, and stay within safe medical guidance boundaries."
  ].join("\n");
}

function readOpenAIChatContent(response: OpenAIChatResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }

  return "";
}

function readGeminiContent(response: GeminiResponse): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text ?? "").join("").trim();
  return text;
}

async function readOpenAICompatibleStream(response: Response): Promise<string> {
  if (!response.body) {
    return NO_MODEL_PROVIDER_RESPONSE;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bufferedText = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    bufferedText += decoder.decode(value, { stream: !done });
    const lines = bufferedText.split("\n");
    bufferedText = lines.pop() ?? "";

    for (const line of lines) {
      const eventData = line.trim().replace(/^data:\s*/, "");
      if (!eventData || eventData === "[DONE]") {
        continue;
      }

      try {
        const chunk = JSON.parse(eventData) as OpenAIChatStreamChunk;
        content += chunk.choices?.[0]?.delta?.content ?? "";
      } catch {
        // Ignore SSE metadata and keep-alive messages.
      }
    }

    if (done) {
      break;
    }
  }

  return content.trim() || NO_MODEL_PROVIDER_RESPONSE;
}

async function invokeViaOpenAICompatibleProvider(
  invocation: ModelGenerationInvocation,
  providerConfig: ProviderConfig
): Promise<string> {
  if (!providerConfig.apiKey) {
    console.error("[LLM] No API key found for provider:", providerConfig.provider);
    return NO_MODEL_PROVIDER_RESPONSE;
  }

  const endpoint = `${providerConfig.baseURL}/chat/completions`;
  console.debug("[LLM] Calling endpoint:", endpoint, "Provider:", providerConfig.provider);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${providerConfig.apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.APP_URL ? { "HTTP-Referer": process.env.APP_URL } : {}),
      ...(process.env.APP_NAME ? { "X-Title": process.env.APP_NAME } : {}),
      // NVIDIA NIM specific headers
      ...(providerConfig.provider === "nvidia-nim" ? { 
        "User-Agent": "Patient-AI-Health-Navigator/1.0"
      } : {})
    },
    body: JSON.stringify({
      model: providerConfig.model,
      messages: [
        {
          role: "system",
          content:
            "You are a clinical navigation assistant for a patient health app. Do not diagnose, prescribe, or give emergency triage."
        },
        {
          role: "user",
          content: buildInvocationPrompt(invocation)
        }
      ],
      temperature: 0.2,
      max_tokens: 300,
      stream: providerConfig.provider === "nvidia-nim"
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LLM] Model request failed with status ${response.status}. Response:`, errorText);
    throw new Error(`Model request failed with status ${response.status}. ${errorText.substring(0, 200)}`);
  }

  if (providerConfig.provider === "nvidia-nim") {
    return readOpenAICompatibleStream(response);
  }

  const data = (await response.json()) as OpenAIChatResponse;

  return readOpenAIChatContent(data) || NO_MODEL_PROVIDER_RESPONSE;
}

async function invokeViaGemini(invocation: ModelGenerationInvocation, providerConfig: ProviderConfig): Promise<string> {
  if (!providerConfig.apiKey) {
    return NO_MODEL_PROVIDER_RESPONSE;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(providerConfig.model)}:generateContent?key=${encodeURIComponent(providerConfig.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "You are a clinical navigation assistant for a patient health app. Do not diagnose, prescribe, or give emergency triage."
            }
          ]
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildInvocationPrompt(invocation)
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as GeminiResponse;
  return readGeminiContent(data) || NO_MODEL_PROVIDER_RESPONSE;
}

export async function invokeModelGeneration(invocation: ModelGenerationInvocation): Promise<string> {
  const providerConfig = getProviderConfig();

  if (providerConfig.provider === "gemini") {
    try {
      return await invokeViaGemini(invocation, providerConfig);
    } catch (error) {
      console.error("[LLM] Gemini invocation failed:", error);
      return generateFallbackResponse(invocation);
    }
  }

  try {
    return await invokeViaOpenAICompatibleProvider(invocation, providerConfig);
  } catch (error) {
    console.error(`[LLM] ${providerConfig.provider} invocation failed:`, error);
    return generateFallbackResponse(invocation);
  }
}

/**
 * Fallback response generator when LLM API fails
 * Provides reasonable responses without external API calls
 */
function generateFallbackResponse(invocation: ModelGenerationInvocation): string {
  const message = invocation.message.toLowerCase();
  
  // Health-related queries
  if (message.includes("medication") || message.includes("drug")) {
    return "I can help you understand your medications. Please ask specific questions about your medications, and I'll provide guidance based on your patient profile. For immediate medical concerns, please contact your healthcare provider.";
  }
  
  if (message.includes("condition") || message.includes("disease") || message.includes("diagnosis")) {
    return "I can provide information about your health conditions. Please feel free to ask questions about how to manage your conditions, lifestyle changes, or when to seek care. For acute concerns, contact your provider.";
  }
  
  if (message.includes("appointment") || message.includes("visit") || message.includes("schedule")) {
    return "You can view and manage your appointments through the patient portal. Please contact your healthcare provider's office if you need to schedule a new visit.";
  }
  
  if (message.includes("symptom") || message.includes("feeling") || message.includes("pain")) {
    return "I can help you understand your symptoms and when to seek care. Please describe your symptoms, and I'll guide you based on your health profile. For emergencies, always call 911.";
  }
  
  // Default response
  return "I'm here to help you navigate your healthcare. You can ask me about your medications, conditions, appointments, or general health guidance. How can I assist you today?";
}
