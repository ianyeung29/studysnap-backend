import { NextRequest, NextResponse } from "next/server";
import { generateStudyMaterial, TemplateId } from "@/lib/openai";
import { checkDailyLimit, saveAiUsageLog, saveProductEvent, acquireLock, releaseLock, upsertUser } from "@/lib/db";
import { calculateCost } from "@/lib/pricing";
import { verifyUserToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId = "unauthenticated_user";
  let installId = "anonymous_beta_tester";
  let templateId: TemplateId = "study-guide";
  let isMaster = false;
  let lockAcquired = false;

  try {
    // 1. Authenticate Request
    const authHeader = request.headers.get("Authorization");
    const verifiedUser = await verifyUserToken(authHeader);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    userId = verifiedUser.userId;
    const userEmail = verifiedUser.email;
    const authProvider = verifiedUser.provider;

    // Sync profile to database
    await upsertUser(userId, userEmail, authProvider);

    const body = await request.json();
    const { userId: reqInstallId, notes, documentNotes, templateId: reqTemplateId, isMaster: reqIsMaster = false, isPremium = false } = body;
    
    if (reqInstallId) installId = reqInstallId;
    if (reqTemplateId) templateId = reqTemplateId as TemplateId;
    isMaster = reqIsMaster;

    if (!notes || typeof notes !== "string") {
      return NextResponse.json(
        { error: "Please provide your lecture notes." },
        { status: 400 }
      );
    }

    if (notes.trim().length < 20) { // Lowered min limit slightly for PDF-only cases
      return NextResponse.json(
        { error: "Notes are too short. Please capture a recording or upload slides." },
        { status: 400 }
      );
    }

    if (notes.length > 60000) {
      return NextResponse.json(
        { error: "Notes and documents are too long. Please limit to 60,000 characters total." },
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
    const limitCheck = await checkDailyLimit(userId, isPremium);
    if (!limitCheck.allowed) {
      await saveProductEvent({
        userId,
        eventName: "limit_blocked",
        metadata: { isPremium, feature: templateId, reason: limitCheck.reason, installId },
      });
      return NextResponse.json(
        { error: limitCheck.reason },
        { status: 429 }
      );
    }

    // 2. Acquire Concurrency Lock
    lockAcquired = acquireLock(userId, "summarize");
    if (!lockAcquired) {
      return NextResponse.json(
        { error: "Another study pack compilation is currently in progress. Please wait." },
        { status: 429 }
      );
    }

    // Combine base notes with slide/document notes if present
    let finalNotes = notes;
    if (documentNotes && Array.isArray(documentNotes) && documentNotes.length > 0) {
      finalNotes += "\n\n--- [ATTACHED PDF SLIDES TEXT] ---\n" + documentNotes.map((pageText, idx) => `[Slide/Page ${idx + 1}]:\n${pageText}`).join("\n\n");
    }

    // 2. Call the AI Model
    const { result, usage } = await generateStudyMaterial(finalNotes, templateId, isMaster);
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
      sessionId: installId,
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
      sessionId: installId,
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
  } finally {
    if (lockAcquired) {
      releaseLock(userId, "summarize");
    }
  }
}
