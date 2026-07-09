// app/api/explain/route.ts — SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { generateTextWithFallback } from "@/lib/openai";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { concept, context, mode = "eli5", userAnswer = "" } = await request.json();

    if (!concept || typeof concept !== "string") {
      return NextResponse.json(
        { error: "Please specify the concept you want explained." },
        { status: 400 }
      );
    }

    let modeInstruction = "";

    switch (mode) {
      case "normal":
        modeInstruction = "Provide a comprehensive, academically clear explanation of the concept.";
        break;
      case "simpler":
        modeInstruction = "Explain the concept in simple, plain terms without using complex jargon or technical wording.";
        break;
      case "eli5":
        modeInstruction = "Explain like I'm 5. Use an extremely simple, friendly, and relatable real-world comparison or analogy.";
        break;
      case "analogy":
        modeInstruction = "Generate a highly creative, vivid, and memorable analogy comparing the concept to an everyday object or scenario.";
        break;
      case "example":
        modeInstruction = "Walk through a practical, step-by-step concrete example demonstrating this concept in action.";
        break;
      case "quiz":
        modeInstruction = `Briefly explain the concept (1 paragraph), then write ONE multiple-choice or short-answer question testing the student's understanding. 
        IMPORTANT: End your output by clearly saying: "Type your answer below and click Submit to check if you got it!"`;
        break;
      case "check-quiz":
        modeInstruction = `The student is answering a question about the concept "${concept}".
        Their answer is: "${userAnswer}".
        Analyze their answer. Be encouraging, point out what is correct and what is incorrect, and explain the correct reasoning. Use simple analogies if they missed the mark.`;
        break;
      default:
        modeInstruction = "Explain the concept simply and clearly.";
    }

    const prompt = `You are a world-class tutor. Your goal is to explain the concept: "${concept}" to a student.
    
Instruction for explanation style:
${modeInstruction}

Use this lecture context to ensure your explanation aligns with how the professor is teaching it:
---
${context || "No context provided"}
---

Return your explanation in a JSON object with this exact format:
{
  "explanation": "A response (1-2 paragraphs) in Markdown format. Use bold text for key terms. Keep the tone friendly, supportive, and engaging."
}`;

    const raw = await generateTextWithFallback(
      "You are an expert tutor that explains complex ideas simply and creatively in JSON format.",
      prompt,
      "flash",
      0.6,
      true
    );
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
