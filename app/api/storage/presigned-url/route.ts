// app/api/storage/presigned-url/route.ts — SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth";
import { getPresignedUploadUrl, isR2Configured } from "@/lib/r2";
import { saveUserFileRecord } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const verifiedUser = await verifyUserToken(authHeader);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    if (!isR2Configured) {
      return NextResponse.json(
        { error: "Cloudflare R2 storage is not configured on server." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { fileName, fileType, mimeType, fileSize, sessionId } = body;

    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: "Missing required fields: fileName, fileType" },
        { status: 400 }
      );
    }

    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const timestamp = Date.now();
    const r2Key = `users/${verifiedUser.userId}/${fileType}/${timestamp}_${sanitizedFileName}`;

    const contentType = mimeType || (
      fileType === "upload_pdf" || fileType === "output_pdf" ? "application/pdf" :
      fileType === "upload_image" ? "image/jpeg" :
      fileType === "upload_audio" ? "audio/m4a" : "application/octet-stream"
    );

    const uploadUrl = await getPresignedUploadUrl(r2Key, contentType, 3600);

    // Save record to database
    const savedRecord = await saveUserFileRecord({
      userId: verifiedUser.userId,
      sessionId: sessionId || undefined,
      fileName,
      fileType,
      r2Key,
      fileSize: fileSize || 0,
      mimeType: contentType,
    });

    return NextResponse.json({
      uploadUrl,
      r2Key,
      fileId: savedRecord.id,
      fileName: savedRecord.fileName,
      fileType: savedRecord.fileType,
    });
  } catch (err: any) {
    console.error("Presigned URL generation failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate presigned upload URL." },
      { status: 500 }
    );
  }
}
