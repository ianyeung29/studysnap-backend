import { NextRequest, NextResponse } from "next/server";
import { generateStudyMaterial, TemplateId } from "@/lib/openai";
import { checkDailyLimit, saveAiUsageLog } from "@/lib/db";
import { calculateCost } from "@/lib/pricing";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId = "anonymous_beta_tester";
  let templateId: TemplateId = "study-guide";
  let isMaster = false;

  try {
    const body = await request.json();
    const { notes, templateId: reqTemplateId, isMaster: reqIsMaster = false, userId: reqUserId } = body;
    
    if (reqUserId) userId = reqUserId;
    if (reqTemplateId) templateId = reqTemplateId as TemplateId;
    isMaster = reqIsMaster;

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

    // 1. Enforce Daily Limit Check on Backend
    const limitCheck = await checkDailyLimit(userId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: limitCheck.reason },
        { status: 429 }
      );
    }

    // 2. Call the AI Model
    const { result, usage } = await generateStudyMaterial(notes, templateId, isMaster);
    const latencyMs = Date.now() - startTime;

    // 3. Centralized Pricing Calculator
    const estimatedCostUsd = calculateCost(
      usage.model,
      usage.promptTokens,
      usage.completionTokens,
      usage.cachedPromptTokens || 0
    );

    // 4. Save Usage Log Telemetry
    await saveAiUsageLog({
      userId,
      sessionId: result.title, // Maps session identifier to title context
      feature: templateId,
      provider: usage.provider,
      model: usage.model,
      inputTokens: usage.promptTokens,
      cachedInputTokens: usage.cachedPromptTokens,
      outputTokens: usage.completionTokens,
      estimatedCostUsd,
      latencyMs,
      success: true,
    });

    // 5. Return study pack to client
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    console.error("Summarize API error:", error);

    const message = error instanceof Error ? error.message : "An unexpected error occurred";

    // Save Failed Usage Log
    await saveAiUsageLog({
      userId,
      feature: templateId,
      provider: isMaster ? "DeepSeek" : "OpenAI",
      model: isMaster ? "deepseek-reasoner" : "gpt-4o-mini",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      latencyMs,
      success: false,
      errorCode: message.slice(0, 100),
    });

    if (message.includes("429") || message.includes("quota")) {
      return NextResponse.json(
        { error: "AI service is busy. Please try again in a moment." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: message || "Failed to generate study materials. Please try again." },
      { status: 500 }
    );
  }
}
