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

    // 1. Classify the image using a cheap low-detail gpt-4o-mini call
    let activeModel = "gpt-4o-mini";
    try {
      const classificationResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image. Does it contain handwriting, science/math equations, or complex whiteboards? Respond with exactly one word: 'yes' or 'no'.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                  detail: "low",
                },
              },
            ],
          },
        ],
        max_tokens: 10,
        temperature: 0.0,
      });

      const classification = classificationResponse.choices[0]?.message?.content?.trim().toLowerCase() ?? "no";
      if (classification.includes("yes")) {
        activeModel = "gpt-5.4-mini";
      }
      console.log(`[OCR Routing] Image classification: ${classification} -> Routing to: ${activeModel}`);
    } catch (routeErr) {
      console.warn("[OCR Routing] Classification failed, defaulting to gpt-4o-mini:", routeErr);
    }

    // 2. Perform high-fidelity extraction using the routed model
    const response = await openai.chat.completions.create({
      model: activeModel,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all visible text from this image. Preserve the structure (headings, lists, formulas) as best you can. If the image contains a diagram, briefly describe it in brackets. Return only the extracted content.`,
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
      max_completion_tokens: 2000,
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
