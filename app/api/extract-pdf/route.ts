import { NextRequest, NextResponse } from "next/server";
import { parsePdfPages } from "@/lib/pdf";
import { checkDailyLimit, saveAiUsageLog, saveProductEvent, acquireLock, releaseLock, upsertUser } from "@/lib/db";
import { verifyUserToken } from "@/lib/auth";

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

    const formData = await request.formData();
    const pdfFile = formData.get("pdf") as File | null;

    const reqInstallId = formData.get("userId") as string;
    if (reqInstallId) installId = reqInstallId;
    isPremium = formData.get("isPremium") === "true";

    if (!pdfFile) {
      return NextResponse.json(
        { error: "No PDF file provided." },
        { status: 400 }
      );
    }

    if (pdfFile.type !== "application/pdf" && !pdfFile.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Unsupported document format. Please upload a PDF file." },
        { status: 400 }
      );
    }

    // 2. Check limits (use "ocr" daily limits classification)
    const limitCheck = await checkDailyLimit(userId, isPremium);
    if (!limitCheck.allowed) {
      await saveProductEvent({
        userId,
        eventName: "limit_blocked",
        metadata: { isPremium, feature: "pdf_extract", reason: limitCheck.reason, installId },
      });
      return NextResponse.json(
        { error: limitCheck.reason },
        { status: 429 }
      );
    }

    // 3. Acquire Concurrency Lock
    lockAcquired = acquireLock(userId, "pdf_extract");
    if (!lockAcquired) {
      return NextResponse.json(
        { error: "Another document processing operation is in progress. Please wait." },
        { status: 429 }
      );
    }

    // 4. Extract PDF pages
    const bytes = await pdfFile.arrayBuffer();
    const pages = await parsePdfPages(Buffer.from(bytes));
    const latencyMs = Date.now() - startTime;

    // Save AI usage log (consider free weight for raw text parsing)
    await saveAiUsageLog({
      userId,
      sessionId: installId,
      feature: "pdf_extract",
      provider: "LocalParser",
      model: "pdf-parse",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0.0,
      latencyMs,
      success: true,
    });

    return NextResponse.json({ success: true, pages });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    console.error("PDF extraction error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";

    // Save PDF failed log
    await saveAiUsageLog({
      userId,
      sessionId: installId,
      feature: "pdf_extract",
      provider: "LocalParser",
      model: "pdf-parse",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      latencyMs,
      success: false,
      errorCode: message.slice(0, 100),
    });

    return NextResponse.json(
      { error: "Failed to extract text from PDF. Please try again." },
      { status: 500 }
    );
  } finally {
    if (lockAcquired) {
      releaseLock(userId, "pdf_extract");
    }
  }
}
