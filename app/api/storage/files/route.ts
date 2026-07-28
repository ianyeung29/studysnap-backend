// app/api/storage/files/route.ts — SERVER ONLY
import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth";
import { getPresignedDownloadUrl, deleteFromR2, isR2Configured } from "@/lib/r2";
import { getUserFileRecords, deleteUserFileRecord } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const verifiedUser = await verifyUserToken(authHeader);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const records = await getUserFileRecords(verifiedUser.userId);

    // Enrich records with fresh presigned download URLs
    const enrichedFiles = await Promise.all(
      records.map(async (rec) => {
        let downloadUrl = "";
        if (isR2Configured && rec.r2Key) {
          try {
            downloadUrl = await getPresignedDownloadUrl(rec.r2Key, 86400); // 24hr valid
          } catch (e) {
            console.warn(`Failed to generate download URL for ${rec.r2Key}:`, e);
          }
        }
        return {
          ...rec,
          downloadUrl,
        };
      })
    );

    return NextResponse.json({ files: enrichedFiles });
  } catch (err: any) {
    console.error("Fetch user files failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to retrieve user cloud files." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const verifiedUser = await verifyUserToken(authHeader);
    if (!verifiedUser) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const r2Key = searchParams.get("r2Key");

    if (!r2Key) {
      return NextResponse.json({ error: "r2Key search param is required." }, { status: 400 });
    }

    if (!r2Key.startsWith(`users/${verifiedUser.userId}/`)) {
      return NextResponse.json({ error: "Unauthorized file access." }, { status: 403 });
    }

    if (isR2Configured) {
      await deleteFromR2(r2Key);
    }
    await deleteUserFileRecord(verifiedUser.userId, r2Key);

    return NextResponse.json({ success: true, message: "File deleted from Cloudflare R2." });
  } catch (err: any) {
    console.error("Delete user file failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete file from Cloudflare R2." },
      { status: 500 }
    );
  }
}
