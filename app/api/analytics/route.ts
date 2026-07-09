import { NextResponse } from "next/server";
import { saveProductEvent } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, eventName, metadata, platform, appVersion } = body;

    if (!userId || !eventName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: userId and eventName are mandatory." },
        { status: 400 }
      );
    }

    await saveProductEvent({
      userId,
      eventName,
      metadata,
      platform,
      appVersion,
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
