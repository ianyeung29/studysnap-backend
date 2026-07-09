// app/api/transcribe/route.ts — SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { toFile } from "openai";
import { checkDailyLimit, saveAiUsageLog, saveProductEvent, acquireLock, releaseLock } from "@/lib/db";

export const maxDuration = 60; // Allow up to 1 minute for Whisper processing

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId = "anonymous_beta_tester";
  let isPremium = false;
  let durationSeconds = 0;
  let lockAcquired = false;

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as any; // Cast as any to read file data in NextJS context

    const reqUserId = formData.get("userId") as string;
    if (reqUserId) userId = reqUserId;
    isPremium = formData.get("isPremium") === "true";
    durationSeconds = parseInt((formData.get("durationSeconds") as string) || "0", 10);

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided." },
        { status: 400 }
      );
    }

    // 1. Enforce Early Daily Limit Check on Backend
    const limitCheck = await checkDailyLimit(userId, isPremium);
    if (!limitCheck.allowed) {
      await saveProductEvent({
        userId,
        eventName: "limit_blocked",
        metadata: { isPremium, feature: "transcribe", reason: limitCheck.reason },
      });
      return NextResponse.json(
        { error: limitCheck.reason },
        { status: 429 }
      );
    }

    // 2. Validate Audio Duration Limit for Tier
    const maxAudioMinutes = isPremium
      ? parseInt(process.env.MAX_AUDIO_MINUTES_PREMIUM || "90", 10)
      : parseInt(process.env.MAX_AUDIO_MINUTES_FREE || "15", 10);

    if (durationSeconds > maxAudioMinutes * 60) {
      return NextResponse.json(
        { error: `Audio recording exceeds the ${maxAudioMinutes}-minute limit for your tier.` },
        { status: 400 }
      );
    }

    // 3. Acquire Concurrency Lock
    lockAcquired = acquireLock(userId, "transcribe");
    if (!lockAcquired) {
      return NextResponse.json(
        { error: "Another transcription is currently in progress. Please wait." },
        { status: 429 }
      );
    }

    // Convert file to buffer for OpenAI
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    
    // Use OpenAI's official helper to convert the buffer to a file compatible with their SDK
    const file = await toFile(buffer, "recording.m4a", { type: "audio/m4a" });

    console.log(`[Whisper API] Starting transcription for file of size: ${buffer.length} bytes`);
    
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "en", // force English transcription for study guides
    });

    console.log(`[Whisper API] Transcription complete: ${transcription.text.substring(0, 100)}...`);

    const latencyMs = Date.now() - startTime;
    const estimatedCostUsd = (durationSeconds / 60) * 0.006; // Whisper is $0.006 per minute

    // Save Transcription usage log
    await saveAiUsageLog({
      userId,
      feature: "transcribe",
      provider: "OpenAI",
      model: "whisper-1",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd,
      latencyMs,
      success: true,
    });

    return NextResponse.json({
      success: true,
      transcript: transcription.text,
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    console.error("Transcription error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error during transcription";

    // Save Failed log
    await saveAiUsageLog({
      userId,
      feature: "transcribe",
      provider: "OpenAI",
      model: "whisper-1",
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
      releaseLock(userId, "transcribe");
    }
  }
}
