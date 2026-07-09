import { NextResponse } from "next/server";
import { saveProductEvent } from "@/lib/db";
import { verifyUserToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    let verifiedUser = null;

    if (authHeader) {
      verifiedUser = await verifyUserToken(authHeader);
      if (!verifiedUser) {
        return NextResponse.json(
          { success: false, error: "Unauthorized. Invalid token." },
          { status: 401 }
        );
      }
    }

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

    // Pre-login allowed events (anonymous)
    const PRE_LOGIN_EVENTS = [
      "onboarding_completed",
      "paywall_viewed",
      "trial_started",
      "delete_local_data_clicked",
      "settings_viewed",
      "limit_blocked",
    ];

    // All allowed events
    const ALLOWED_EVENTS = [
      ...PRE_LOGIN_EVENTS,
      "start_session_clicked",
      "recording_started",
      "recording_stopped",
      "photo_added",
      "audio_imported",
      "study_guide_generated",
      "flashcards_generated",
      "quiz_generated",
      "practice_started",
      "generation_failed",
      "artifact_cache_hit",
      "feedback_submitted",
    ];

    if (!ALLOWED_EVENTS.includes(eventName)) {
      return NextResponse.json(
        { success: false, error: "Rejected unknown telemetry event." },
        { status: 400 }
      );
    }

    // If no verified user token, verify event is pre-login allowed
    if (!verifiedUser && !PRE_LOGIN_EVENTS.includes(eventName)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. This event requires authentication." },
        { status: 401 }
      );
    }

    const finalUserId = verifiedUser ? verifiedUser.userId : userId;
    const finalMetadata = {
      ...(metadata || {}),
      ...(verifiedUser ? { installId: userId } : {}), // correlate install ID post-login
    };

    await saveProductEvent({
      userId: finalUserId,
      eventName,
      metadata: finalMetadata,
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
