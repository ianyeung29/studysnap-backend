import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl ? neon(databaseUrl) : null;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const verifiedUser = await verifyUserToken(authHeader);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Database connection offline." }, { status: 503 });
    }

    const sessions = await sql`
      SELECT * FROM sessions 
      WHERE user_id = ${verifiedUser.userId} 
      ORDER BY updated_at DESC
    `;

    return NextResponse.json({ success: true, sessions });
  } catch (err: any) {
    console.error("GET sessions error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch sessions." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const verifiedUser = await verifyUserToken(authHeader);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Database connection offline." }, { status: 503 });
    }

    const sessionData = await request.json();
    const {
      id,
      title,
      course,
      parentFolder,
      templateId,
      audioUri,
      audioDuration,
      createdAt,
      updatedAt,
      artifactJson,
      documentNotes,
    } = sessionData;

    if (!id || !title) {
      return NextResponse.json({ error: "Missing session identifier or title." }, { status: 400 });
    }

    await sql`
      INSERT INTO sessions (
        id, user_id, title, course, parent_folder, template_id, 
        audio_uri, audio_duration, created_at, updated_at, 
        artifact_json, document_notes
      )
      VALUES (
        ${id}, 
        ${verifiedUser.userId}, 
        ${title}, 
        ${course || null}, 
        ${parentFolder || null}, 
        ${templateId || null},
        ${audioUri || null}, 
        ${audioDuration || 0}, 
        ${createdAt || new Date().toISOString()}, 
        ${updatedAt || new Date().toISOString()},
        ${artifactJson ? JSON.stringify(artifactJson) : null}, 
        ${documentNotes ? JSON.stringify(documentNotes) : null}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        course = EXCLUDED.course,
        parent_folder = EXCLUDED.parent_folder,
        template_id = EXCLUDED.template_id,
        audio_uri = EXCLUDED.audio_uri,
        audio_duration = EXCLUDED.audio_duration,
        updated_at = EXCLUDED.updated_at,
        artifact_json = EXCLUDED.artifact_json,
        document_notes = EXCLUDED.document_notes
    `;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("POST sessions error:", err);
    return NextResponse.json({ error: err.message || "Failed to sync session." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const verifiedUser = await verifyUserToken(authHeader);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Database connection offline." }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing session ID parameter." }, { status: 400 });
    }

    await sql`
      DELETE FROM sessions 
      WHERE id = ${id} AND user_id = ${verifiedUser.userId}
    `;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE session error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete session." }, { status: 500 });
  }
}
