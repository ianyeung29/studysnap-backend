// lib/openai.ts — SERVER ONLY. Never import this from a client component.
import OpenAI from "openai";
import { TemplateId, TEMPLATES } from "@/lib/templates";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY environment variable");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type { TemplateId };
export { TEMPLATES };

export async function generateStudyMaterial(
  notes: string,
  templateId: TemplateId
): Promise<{ title: string; content: string; course: string }> {
  const template = TEMPLATES[templateId];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          template.systemPrompt +
          "\n\nAdditionally, analyze the lecture notes and classify the academic subject or course (e.g. Chemistry, Biology, History, Computer Science, Calculus, Economics). Return this subject tag as a short, clean, capitalized phrase (1-3 words max, e.g. \"Chemistry\" or \"Computer Science\") in a third JSON key \"course\".",
      },
      {
        role: "user",
        content: `Here are my lecture notes:\n\n${notes}`,
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("No response from AI");

  const parsed = JSON.parse(raw);
  return {
    title: parsed.title || "Untitled",
    content: parsed.content || "",
    course: parsed.course || "General",
  };
}
