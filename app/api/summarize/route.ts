import { NextRequest, NextResponse } from "next/server";
import { generateStudyMaterial, TemplateId } from "@/lib/openai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notes, templateId, isMaster = false } = body as { notes: string; templateId: TemplateId; isMaster?: boolean };

    if (!notes || typeof notes !== "string") {
      return NextResponse.json(
        { error: "Please provide your lecture notes." },
        { status: 400 }
      );
    }

    if (notes.trim().length < 50) {
      return NextResponse.json(
        { error: "Notes are too short. Please paste at least a few sentences." },
        { status: 400 }
      );
    }

    if (notes.length > 30000) {
      return NextResponse.json(
        { error: "Notes are too long. Please limit to 30,000 characters." },
        { status: 400 }
      );
    }

    const validTemplates: TemplateId[] = [
      "study-guide",
      "flashcards",
      "exam-prep",
      "assignments",
      "concept-map",
      "tldr",
    ];

    if (!validTemplates.includes(templateId)) {
      return NextResponse.json(
        { error: "Invalid template selected." },
        { status: 400 }
      );
    }

    const result = await generateStudyMaterial(notes, templateId, isMaster);

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error("Summarize API error:", error);

    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    // OpenAI quota / rate limit
    if (message.includes("429") || message.includes("quota")) {
      return NextResponse.json(
        { error: "AI service is busy. Please try again in a moment." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate study materials. Please try again." },
      { status: 500 }
    );
  }
}
