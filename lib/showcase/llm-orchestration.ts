import OpenAI from "openai";
import { requireEnv } from "@/lib/config";

export type ModelGenerationInvocation = {
  conversationId: string;
  patientId: string;
  message: string;
};

let client: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: requireEnv("OPENAI_API_KEY")
    });
  }
  return client;
}

export async function invokeModelGeneration(invocation: ModelGenerationInvocation): Promise<string | null> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful healthcare assistant providing general health information. Always remind users to consult with healthcare professionals for medical advice."
        },
        {
          role: "user",
          content: invocation.message
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0]?.message.content ?? null;
  } catch (error) {
    console.error("OpenAI API error:", error);
    return null;
  }
}
