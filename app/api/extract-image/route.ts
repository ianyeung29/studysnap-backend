// app/api/extract-image/route.ts — SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

import { checkDailyLimit, saveAiUsageLog, saveProductEvent, acquireLock, releaseLock } from "@/lib/db";
import { calculateCost } from "@/lib/pricing";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId = "anonymous_beta_tester";
  let isPremium = false;
  let photoCount = 1;
  let lockAcquired = false;
  let activeModel = "gpt-4o-mini";

  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

    const reqUserId = formData.get("userId") as string;
    if (reqUserId) userId = reqUserId;
    isPremium = formData.get("isPremium") === "true";
    photoCount = parseInt((formData.get("photoCount") as string) || "1", 10);

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

    // 1. Enforce Early Daily Limit Check on Backend
    const limitCheck = await checkDailyLimit(userId, isPremium);
    if (!limitCheck.allowed) {
      await saveProductEvent({
        userId,
        eventName: "limit_blocked",
        metadata: { isPremium, feature: "ocr", reason: limitCheck.reason },
      });
      return NextResponse.json(
        { error: limitCheck.reason },
        { status: 429 }
      );
    }

    // 2. Validate Photo Count Limit for Tier
    const maxPhotos = isPremium
      ? parseInt(process.env.MAX_PHOTOS_PREMIUM || "15", 10)
      : parseInt(process.env.MAX_PHOTOS_FREE || "3", 10);

    if (photoCount > maxPhotos) {
      return NextResponse.json(
        { error: `You have reached the maximum photo limit of ${maxPhotos} photos for your tier.` },
        { status: 400 }
      );
    }

    // 3. Acquire Concurrency Lock
    lockAcquired = acquireLock(userId, "ocr");
    if (!lockAcquired) {
      return NextResponse.json(
        { error: "Another image processing operation is in progress. Please wait." },
        { status: 429 }
      );
    }

    // Convert to base64
    const bytes = await imageFile.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = imageFile.type;

    // 4. Classify the image using a cheap low-detail gpt-4o-mini call
    let classificationTokensIn = 0;
    let classificationTokensOut = 0;
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

      classificationTokensIn = classificationResponse.usage?.prompt_tokens || 0;
      classificationTokensOut = classificationResponse.usage?.completion_tokens || 0;

      const classification = classificationResponse.choices[0]?.message?.content?.trim().toLowerCase() ?? "no";
      if (classification.includes("yes")) {
        activeModel = "gpt-5.4-mini"; // Note: maps to gpt-4o-mini pricing
      }
      console.log(`[OCR Routing] Image classification: ${classification} -> Routing to: ${activeModel}`);
    } catch (routeErr) {
      console.warn("[OCR Routing] Classification failed, defaulting to gpt-4o-mini:", routeErr);
    }

    // 5. Perform high-fidelity extraction using the routed model
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

    const ocrTokensIn = response.usage?.prompt_tokens || 0;
    const ocrTokensOut = response.usage?.completion_tokens || 0;

    const text = response.choices[0]?.message?.content ?? "";
    const latencyMs = Date.now() - startTime;

    // Calculate dynamic cost
    const classificationCost = calculateCost("gpt-4o-mini", classificationTokensIn, classificationTokensOut);
    const ocrCost = calculateCost(activeModel, ocrTokensIn, ocrTokensOut);
    const estimatedCostUsd = classificationCost + ocrCost;

    // Save OCR success usage log
    await saveAiUsageLog({
      userId,
      feature: "ocr",
      provider: "OpenAI",
      model: activeModel,
      inputTokens: classificationTokensIn + ocrTokensIn,
      outputTokens: classificationTokensOut + ocrTokensOut,
      estimatedCostUsd,
      latencyMs,
      success: true,
    });

    return NextResponse.json({ success: true, text });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    console.error("Image extraction error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";

    // Save OCR failed log
    await saveAiUsageLog({
      userId,
      feature: "ocr",
      provider: "OpenAI",
      model: activeModel,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      latencyMs,
      success: false,
      errorCode: message.slice(0, 100),
    });

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
  } finally {
    if (lockAcquired) {
      releaseLock(userId, "ocr");
    }
  }
}
