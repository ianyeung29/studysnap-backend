import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth";
import { neon } from "@neondatabase/serverless";
import { openai } from "@/lib/openai";
import { checkDailyLimit, saveAiUsageLog, acquireLock, releaseLock, upsertUser } from "@/lib/db";
import { calculateCost } from "@/lib/pricing";

const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl ? neon(databaseUrl) : null;

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId = "unauthenticated_user";
  let installId = "anonymous_beta_tester";
  let isPremium = false;
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

    if (!sql) {
      return NextResponse.json({ error: "Database offline. Chat unavailable." }, { status: 503 });
    }

    const body = await request.json();
    const { sessionId, message, chatHistory = [], isPremium: reqIsPremium = false } = body;
    isPremium = reqIsPremium;

    if (!sessionId || !message) {
      return NextResponse.json({ error: "Missing session ID or chat message." }, { status: 400 });
    }

    // 2. Fetch session data
    const sessions = await sql`
      SELECT title, artifact_json, document_notes 
      FROM sessions 
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;

    if (sessions.length === 0) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const { title, artifact_json: artifactJson, document_notes: documentNotes } = sessions[0];

    // 3. Enforce Daily Limit Check on Backend
    const limitCheck = await checkDailyLimit(userId, isPremium);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.reason }, { status: 429 });
    }

    // 4. Acquire Lock
    lockAcquired = acquireLock(userId, "tutor_chat");
    if (!lockAcquired) {
      return NextResponse.json({ error: "Operation in progress. Please wait." }, { status: 429 });
    }

    // 5. Build prompt context
    const studyMaterials = artifactJson?.content || artifactJson?.summary || "";
    const flashcardsText = artifactJson?.flashcards ? JSON.stringify(artifactJson.flashcards) : "";
    const quizText = artifactJson?.quiz ? JSON.stringify(artifactJson.quiz) : "";
    const pdfText = documentNotes ? JSON.stringify(documentNotes) : "";

    const systemPrompt = `You are a helpful, encouraging AI Study Tutor for the StudySnap platform.
Your task is to answer the user's questions about their study materials, lecture summaries, slides, or flashcards.
You MUST prioritize grounding your answers strictly on the context provided below. If the answer cannot be found or inferred from the context, politely state that it wasn't covered in the lecture materials and offer to explain general concepts to help.

---
[STUDY PACK CONTEXT]
Topic Title: ${title}
Summary/Study Guide Content:
${studyMaterials}

Flashcards Content:
${flashcardsText}

Quiz Content:
${quizText}

Attached Document/Slides Text:
${pdfText}
---

Provide answers that are:
- Concise, clear, and highly readable.
- Structured with bullet points if helpful.
- Friendly, using markdown for formatting (such as bolding key terms).`;

    // 6. Format Message History
    const formattedMessages = [
      { role: "system" as const, content: systemPrompt },
      ...chatHistory.slice(-10).map((msg: any) => ({
        role: (msg.sender === "user" ? "user" : "assistant") as "user" | "assistant",
        content: msg.text,
      })),
      { role: "user" as const, content: message }
    ];

    // 7. Invoke OpenAI GPT-4o-mini (highly effective, low cost model for chat)
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: formattedMessages,
      max_completion_tokens: 1000,
      temperature: 0.7,
    });

    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const aiText = response.choices[0]?.message?.content ?? "Sorry, I couldn't process your request.";
    const latencyMs = Date.now() - startTime;

    // Calculate cost
    const estimatedCostUsd = calculateCost("gpt-4o-mini", promptTokens, completionTokens);

    // Save AI usage log
    await saveAiUsageLog({
      userId,
      sessionId,
      feature: "tutor_chat",
      provider: "OpenAI",
      model: "gpt-4o-mini",
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      estimatedCostUsd,
      latencyMs,
      success: true,
    });

    return NextResponse.json({ success: true, text: aiText });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    console.error("Session Chat API error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";

    // Log failure
    await saveAiUsageLog({
      userId,
      feature: "tutor_chat",
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
      { error: "AI Tutor is currently busy. Please try again." },
      { status: 500 }
    );
  } finally {
    if (lockAcquired) {
      releaseLock(userId, "tutor_chat");
    }
  }
}
