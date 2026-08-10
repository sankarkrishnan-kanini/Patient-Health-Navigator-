export type ModelGenerationInvocation = {
  conversationId: string;
  patientId: string;
  message: string;
};

export const NO_MODEL_PROVIDER_RESPONSE = "__NO_MODEL_PROVIDER_RESPONSE__";

type ProviderName = "openrouter" | "gemini" | "groq";

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
  const provider = (process.env.LLM_PROVIDER ?? "openrouter").toLowerCase();

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

  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o",
      baseURL: "https://openrouter.ai/api/v1"
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

  if (process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
    };
  }

  return {
    provider: "openrouter",
    model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o",
    baseURL: "https://openrouter.ai/api/v1"
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

async function invokeViaOpenAICompatibleProvider(
  invocation: ModelGenerationInvocation,
  providerConfig: ProviderConfig
): Promise<string> {
  if (!providerConfig.apiKey) {
    return NO_MODEL_PROVIDER_RESPONSE;
  }

  const response = await fetch(`${providerConfig.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${providerConfig.apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.APP_URL ? { "HTTP-Referer": process.env.APP_URL } : {}),
      ...(process.env.APP_NAME ? { "X-Title": process.env.APP_NAME } : {})
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
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`Model request failed with status ${response.status}.`);
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
    return invokeViaGemini(invocation, providerConfig);
  }

  return invokeViaOpenAICompatibleProvider(invocation, providerConfig);
}
