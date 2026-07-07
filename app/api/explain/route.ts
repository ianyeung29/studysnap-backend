// app/api/explain/route.ts — SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { concept, context } = await request.json();

    if (!concept || typeof concept !== "string") {
      return NextResponse.json(
        { error: "Please specify the concept you want explained." },
        { status: 400 }
      );
    }

    const prompt = `You are a world-class teacher specializing in explaining complex topics to beginners (Explain Like I'm 5 style).
    
Explain the concept: "${concept}" using a highly clear, creative, and memorable analogy.
Use the following lecture context to ensure your explanation aligns with how the professor is teaching it:
---
${context || "No context provided"}
---

Return your explanation in a JSON object with this exact format:
{
  "explanation": "A 1-2 paragraph response starting with a friendly, engaging tone. Use formatting like bold text for key terms. End with a simple one-sentence summary."
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert tutor that explains complex ideas simply and creatively in JSON format.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("No response from AI");

    const parsed = JSON.parse(raw);
    return NextResponse.json({
      success: true,
      explanation: parsed.explanation || "No explanation could be generated.",
    });
  } catch (error: unknown) {
    console.error("Explain API error:", error);
    const message =
      error instanceof Error ? error.message : "Unexpected error during explanation";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
