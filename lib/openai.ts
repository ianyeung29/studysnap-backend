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

/**
 * Executes a text generation prompt.
 * First attempts to use DeepSeek V4 Flash ("deepseek-chat").
 * If the API key is missing or the request fails, it falls back to OpenAI's "gpt-5.4-mini".
 */
export async function generateTextWithFallback(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.3,
  jsonFormat: boolean = false
): Promise<string> {
  // 1. Try DeepSeek V4 Flash
  if (deepseek) {
    try {
      console.log("[AI Routing] Attempting text generation with DeepSeek V4 Flash...");
      const completion = await deepseek.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        ...(jsonFormat ? { response_format: { type: "json_object" } } : {}),
      });

      const result = completion.choices[0]?.message?.content;
      if (result) {
        console.log("[AI Routing] DeepSeek text generation successful!");
        return result;
      }
    } catch (err) {
      console.warn("[AI Routing] DeepSeek call failed. Falling back to OpenAI gpt-5.4-mini:", err);
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
  if (!result) {
    throw new Error("No response from fallback AI engine");
  }
  return result;
}

export async function generateStudyMaterial(
  notes: string,
  templateId: TemplateId
): Promise<{ title: string; content: string; course: string }> {
  const template = TEMPLATES[templateId];
  const systemPrompt =
    template.systemPrompt +
    "\n\nAdditionally, analyze the lecture notes and classify the academic subject or course (e.g. Chemistry, Biology, History, Computer Science, Calculus, Economics). Return this subject tag as a short, clean, capitalized phrase (1-3 words max, e.g. \"Chemistry\" or \"Computer Science\") in a third JSON key \"course\".";
  const userPrompt = `Here are my lecture notes:\n\n${notes}`;

  const raw = await generateTextWithFallback(systemPrompt, userPrompt, 0.3, true);
  const parsed = JSON.parse(raw);
  
  return {
    title: parsed.title || "Untitled",
    content: parsed.content || "",
    course: parsed.course || "General",
  };
}
