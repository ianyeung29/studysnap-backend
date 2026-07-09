import { NextResponse } from "next/server";
import { saveProductEvent } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const rawText = await req.text();
    
    // Prevent massive payloads (max 10KB to protect database storage)
    if (rawText.length > 10240) {
      return NextResponse.json(
        { success: false, error: "Payload too large." },
        { status: 413 }
      );
    }

    const body = JSON.parse(rawText);
    const { userId, eventName, metadata, platform, appVersion } = body;

    if (!userId || !eventName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: userId and eventName are mandatory." },
        { status: 400 }
      );
    }

    // Enforce parameter length limits to prevent DB injection spam
    if (userId.length < 5 || userId.length > 100 || eventName.length > 100) {
      return NextResponse.json(
        { success: false, error: "Invalid parameter lengths." },
        { status: 400 }
      );
    }

    // List of accepted analytics event names
    const ALLOWED_EVENTS = [
      "onboarding_completed",
      "start_session_clicked",
      "recording_started",
      "recording_stopped",
      "photo_added",
      "audio_imported",
      "study_guide_generated",
      "flashcards_generated",
      "quiz_generated",
      "practice_started",
      "paywall_viewed",
      "trial_started",
      "generation_failed",
      "delete_local_data_clicked",
      "artifact_cache_hit",
      "feedback_submitted",
      "settings_viewed",
      "limit_blocked",
    ];

    if (!ALLOWED_EVENTS.includes(eventName)) {
      return NextResponse.json(
        { success: false, error: "Rejected unknown telemetry event." },
        { status: 400 }
      );
    }

    await saveProductEvent({
      userId,
      eventName,
      metadata: metadata || {},
      platform: platform ? String(platform).substring(0, 50) : undefined,
      appVersion: appVersion ? String(appVersion).substring(0, 50) : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error logging product analytics event:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to log event" },
      { status: 500 }
    );
  }
}
