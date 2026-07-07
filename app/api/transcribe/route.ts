// app/api/transcribe/route.ts — SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { File } from "buffer";

export const maxDuration = 60; // Allow up to 1 minute for Whisper processing

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as any; // Cast as any to read file data in NextJS context

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided." },
        { status: 400 }
      );
    }

    // Convert file to buffer for OpenAI
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    
    // Convert to a File object compatible with OpenAI node SDK
    const file = new File([buffer], "recording.m4a", { type: "audio/m4a" });

    console.log(`[Whisper API] Starting transcription for file of size: ${buffer.length} bytes`);
    
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "en", // force English transcription for study guides
    });

    console.log(`[Whisper API] Transcription complete: ${transcription.text.substring(0, 100)}...`);

    return NextResponse.json({
      success: true,
      transcript: transcription.text,
    });
  } catch (error: unknown) {
    console.error("Transcription error:", error);
    const message =
      error instanceof Error ? error.message : "Unexpected error during transcription";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
