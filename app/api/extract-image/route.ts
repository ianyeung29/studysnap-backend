// app/api/extract-image/route.ts — SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: "No image file provided." },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: "Unsupported image format. Use JPEG, PNG, or WebP." },
        { status: 400 }
      );
    }

    // Convert to base64
    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = imageFile.type;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are extracting text from a student's class photo. This image may contain:
- A whiteboard or blackboard with the professor's writing
- A student's handwritten notes
- Printed slides or diagrams

Please extract ALL visible text carefully, preserving the structure as best you can.
Include: headings, bullet points, formulas, diagrams described in words, any numbered lists.
If the image contains a diagram, describe it briefly in [brackets].
Return only the extracted/described content — no preamble or explanation.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
    });

    const text = response.choices[0]?.message?.content ?? "";

    return NextResponse.json({ success: true, text });
  } catch (error: unknown) {
    console.error("Image extraction error:", error);
    const message =
      error instanceof Error ? error.message : "Unexpected error";

    if (message.includes("429") || message.includes("quota")) {
      return NextResponse.json(
        { error: "AI service is busy. Please try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to extract text from image. Please try again." },
      { status: 500 }
    );
  }
}
