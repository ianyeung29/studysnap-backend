// app/api/explain/route.ts — SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { generateTextWithFallback } from "@/lib/openai";
import { checkDailyLimit, saveAiUsageLog, saveProductEvent, acquireLock, releaseLock, upsertUser } from "@/lib/db";
import { calculateCost } from "@/lib/pricing";
import { verifyUserToken } from "@/lib/auth";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId = "unauthenticated_user";
  let installId = "anonymous_beta_tester";
  let mode = "eli5";
  let concept = "";
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
    const { concept: reqConcept, context, mode: reqMode = "eli5", userAnswer = "", userId: reqInstallId, isPremium = false } = body;

    if (reqInstallId) installId = reqInstallId;
    if (reqConcept) concept = reqConcept;
    mode = reqMode;

    if (!concept || typeof concept !== "string") {
      return NextResponse.json(
        { error: "Please specify the concept you want explained." },
        { status: 400 }
      );
    }

    // 1. Enforce Daily Limit Check on Backend
    const limitCheck = await checkDailyLimit(userId, isPremium);
    if (!limitCheck.allowed) {
      await saveProductEvent({
        userId,
        eventName: "limit_blocked",
        metadata: { isPremium, feature: mode === "check-quiz" ? "quiz" : "eli5", reason: limitCheck.reason, installId },
      });
      return NextResponse.json(
        { error: limitCheck.reason },
        { status: 429 }
      );
    }

    // 2. Acquire Concurrency Lock
    lockAcquired = acquireLock(userId, "explain");
    if (!lockAcquired) {
      return NextResponse.json(
        { error: "Another tutor explanation is currently in progress. Please wait." },
        { status: 429 }
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

    // 2. Call text generation fallback
    const { text, model, provider, promptTokens, completionTokens, cachedPromptTokens } = await generateTextWithFallback(
      "You are an expert tutor that explains complex ideas simply and creatively in JSON format.",
      prompt,
      "flash",
      0.6,
      true
    );

    const latencyMs = Date.now() - startTime;
    const parsed = JSON.parse(text);

    // 3. Centralized Pricing Calculator
    const estimatedCostUsd = calculateCost(
      model,
      promptTokens,
      completionTokens,
      cachedPromptTokens || 0
    );

    // 4. Save Usage Log Telemetry
    await saveAiUsageLog({
      userId,
      sessionId: installId,
      feature: mode === "check-quiz" ? "quiz" : "eli5",
      provider,
      model,
      inputTokens: promptTokens,
      cachedInputTokens: cachedPromptTokens,
      outputTokens: completionTokens,
      estimatedCostUsd,
      latencyMs,
      success: true,
    });

    return NextResponse.json({
      success: true,
      explanation: parsed.explanation || "No explanation could be generated.",
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    console.error("Explain API error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error during explanation";

    // Save Failed Usage Log
    await saveAiUsageLog({
      userId,
      sessionId: installId,
      feature: mode === "check-quiz" ? "quiz" : "eli5",
      provider: "OpenAI",
      model: "gpt-4o-mini",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      latencyMs,
      success: false,
      errorCode: message.slice(0, 100),
    });

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  } finally {
    if (lockAcquired) {
      releaseLock(userId, "explain");
    }
  }
}
