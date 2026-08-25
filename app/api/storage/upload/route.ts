// app/api/storage/upload/route.ts — SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth";
import { uploadBufferToR2, isR2Configured } from "@/lib/r2";
import { saveUserFileRecord, getUserFileRecords } from "@/lib/db";

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
        { status: 530 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileType = (formData.get("fileType") as string) || "output_pdf";
    const sessionId = (formData.get("sessionId") as string) || "";
    const customFileName = (formData.get("fileName") as string) || (file?.name || "document.pdf");

    if (!file) {
      return NextResponse.json({ error: "No file provided in form data." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Deduplication check: If user already uploaded this exact file, reuse it
    const existingFiles = await getUserFileRecords(verifiedUser.userId);
    const existing = existingFiles.find(
      (f) => f.fileName === customFileName && Number(f.fileSize) === buffer.length && f.fileType === fileType
    );

    if (existing) {
      console.log(`[R2 Deduplication] Reusing existing file: ${customFileName} (${existing.r2Key})`);
      return NextResponse.json({
        success: true,
        downloadUrl: `https://pub-${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.dev/${existing.r2Key}`,
        r2Key: existing.r2Key,
        fileId: existing.id,
        fileName: existing.fileName,
        fileType: existing.fileType,
        fileSize: existing.fileSize,
        isDuplicate: true,
      });
    }

    const sanitizedFileName = customFileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const timestamp = Date.now();
    const r2Key = `users/${verifiedUser.userId}/${fileType}/${timestamp}_${sanitizedFileName}`;
    const contentType = file.type || (
      fileType === "output_pdf" || fileType === "upload_pdf" ? "application/pdf" :
      fileType === "upload_image" ? "image/jpeg" : "application/octet-stream"
    );

    // Direct upload buffer to Cloudflare R2
    const downloadUrl = await uploadBufferToR2(buffer, r2Key, contentType);

    // Save metadata record in Neon PostgreSQL
    const savedRecord = await saveUserFileRecord({
      userId: verifiedUser.userId,
      sessionId: sessionId || undefined,
      fileName: customFileName,
      fileType: fileType as any,
      r2Key,
      fileSize: buffer.length,
      mimeType: contentType,
    });

    return NextResponse.json({
      success: true,
      downloadUrl,
      r2Key,
      fileId: savedRecord.id,
      fileName: savedRecord.fileName,
      fileType: savedRecord.fileType,
      fileSize: savedRecord.fileSize,
    });
  } catch (err: any) {
    console.error("Direct file upload to R2 failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to upload file to Cloudflare R2." },
      { status: 500 }
    );
  }
}
