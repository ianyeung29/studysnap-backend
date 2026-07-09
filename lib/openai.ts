// lib/openai.ts — SERVER ONLY. Never import this from a client component.
import OpenAI from "openai";
import { TemplateId, TEMPLATES } from "@/lib/templates";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure DeepSeek client if API key is present
export const deepseek = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      baseURL: "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
    })
  : null;

export type { TemplateId };
export { TEMPLATES };

export interface TextGenerationResult {
  text: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  cachedPromptTokens?: number;
}

/**
 * Executes a text generation prompt.
 * First attempts to use DeepSeek (V4 Flash or V4 Pro based on preference).
 * If the preferred DeepSeek call fails, it retries with V4 Pro (if Flash failed) or falls back to OpenAI's "gpt-5.4-mini".
 */
export async function generateTextWithFallback(
  systemPrompt: string,
  userPrompt: string,
  modelPreference: "flash" | "pro" = "flash",
  temperature: number = 0.3,
  jsonFormat: boolean = false
): Promise<TextGenerationResult> {
  const activeModel = modelPreference === "pro" ? "deepseek-reasoner" : "deepseek-chat";

  // 1. Try DeepSeek (V4 Flash / V4 Pro)
  if (deepseek) {
    try {
      console.log(`[AI Routing] Attempting text generation with DeepSeek (${activeModel})...`);
      
      const completion = await deepseek.chat.completions.create({
        model: activeModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        // Exclude unsupported parameters for deepseek-reasoner (R1)
        ...(activeModel === "deepseek-chat" ? {
          temperature,
          ...(jsonFormat ? { response_format: { type: "json_object" } } : {}),
        } : {}),
      });

      const result = completion.choices[0]?.message?.content;
      const usage = completion.usage;
      if (result) {
        console.log(`[AI Routing] DeepSeek (${activeModel}) text generation successful!`);
        return {
          text: result,
          model: activeModel,
          provider: "DeepSeek",
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          cachedPromptTokens: (usage as any)?.prompt_tokens_details?.cached_tokens || 0,
        };
      }
    } catch (err) {
      console.warn(`[AI Routing] DeepSeek (${activeModel}) call failed, checking retries...`, err);

      // "Retry after Flash fails validation": if Flash failed, try Pro!
      if (modelPreference === "flash") {
        try {
          console.log("[AI Routing] Retrying text generation with DeepSeek Pro (deepseek-reasoner)...");
          const retryCompletion = await deepseek.chat.completions.create({
            model: "deepseek-reasoner",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
          const retryResult = retryCompletion.choices[0]?.message?.content;
          const retryUsage = retryCompletion.usage;
          if (retryResult) {
            console.log("[AI Routing] DeepSeek Pro retry successful!");
            return {
              text: retryResult,
              model: "deepseek-reasoner",
              provider: "DeepSeek",
              promptTokens: retryUsage?.prompt_tokens || 0,
              completionTokens: retryUsage?.completion_tokens || 0,
              cachedPromptTokens: (retryUsage as any)?.prompt_tokens_details?.cached_tokens || 0,
            };
          }
        } catch (retryErr) {
          console.warn("[AI Routing] DeepSeek Pro retry failed, falling back to OpenAI:", retryErr);
        }
      }
    }
  } else {
    console.log("[AI Routing] DEEPSEEK_API_KEY is not defined. Routing directly to OpenAI gpt-5.4-mini.");
  }

  // 2. Production Fallback to GPT-5.4-mini
  console.log("[AI Routing] Processing fallback request via OpenAI gpt-5.4-mini...");
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature,
    ...(jsonFormat ? { response_format: { type: "json_object" } } : {}),
  });

  const result = completion.choices[0]?.message?.content;
  const usage = completion.usage;
  if (!result) {
    throw new Error("No response from fallback AI engine");
  }
  return {
    text: result,
    model: "gpt-4o-mini", // Cost mapped as gpt-4o-mini
    provider: "OpenAI",
    promptTokens: usage?.prompt_tokens || 0,
    completionTokens: usage?.completion_tokens || 0,
    cachedPromptTokens: (usage as any)?.prompt_tokens_details?.cached_tokens || 0,
  };
}

export async function generateStudyMaterial(
  notes: string,
  templateId: TemplateId,
  isMaster: boolean = false
): Promise<{
  result: { title: string; content: string; course: string; highlights: any[] };
  usage: {
    model: string;
    provider: string;
    promptTokens: number;
    completionTokens: number;
    cachedPromptTokens?: number;
  };
}> {
  const template = TEMPLATES[templateId];
  const systemPrompt =
    template.systemPrompt +
    "\n\nAdditionally, analyze the lecture notes and classify the academic subject or course (e.g. Chemistry, Biology, History, Computer Science, Calculus, Economics). Return this subject tag as a short, clean, capitalized phrase (1-3 words max, e.g. \"Chemistry\" or \"Computer Science\") in a third JSON key \"course\"." +
    "\n\nAdditionally, identify 5-15 highly important terms, definitions, formulas, rules, dates, facts, or warnings in the content. Return an array of these key highlights in a fourth JSON key \"highlights\", where each item is an object with this exact structure:\n" +
    "{\n" +
    "  \"text\": \"The exact word/phrase/sentence as it appears in the content value\",\n" +
    "  \"type\": \"term\" | \"definition\" | \"formula\" | \"exam\" | \"warning\",\n" +
    "  \"importance\": 1 | 2 | 3,\n" +
    "  \"reason\": \"Why this is highlighted (1 short sentence)\"\n" +
    "}\n" +
    "Ensure the \"text\" matches character-for-character with words in the returned \"content\" field so the UI can highlight them.";

  const userPrompt = `Here are my lecture notes:\n\n${notes}`;

  const modelPreference = isMaster ? "pro" : "flash";
  const { text, model, provider, promptTokens, completionTokens, cachedPromptTokens } = 
    await generateTextWithFallback(systemPrompt, userPrompt, modelPreference, 0.3, true);
  
  const parsed = JSON.parse(text);
  
  return {
    result: {
      title: parsed.title || "Untitled",
      content: parsed.content || "",
      course: parsed.course || "General",
      highlights: parsed.highlights || [],
    },
    usage: {
      model,
      provider,
      promptTokens,
      completionTokens,
      cachedPromptTokens,
    },
  };
}
