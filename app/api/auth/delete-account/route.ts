import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth";
import { anonymizeUser } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const verifiedUser = await verifyUserToken(authHeader);

    if (!verifiedUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in to delete your account." },
        { status: 401 }
      );
    }

    const userId = verifiedUser.userId;

    // 1. Anonymize user records in Neon PostgreSQL (ensures foreign key constraints stay valid for telemetry)
    await anonymizeUser(userId);

    // 2. Request user record deletion from Supabase Auth directory using the server-only service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      try {
        console.log(`[Supabase Auth Admin] Deleting auth user: ${userId}`);
        const deleteUrl = `${supabaseUrl}/auth/v1/admin/users/${userId}`;
        const res = await fetch(deleteUrl, {
          method: "DELETE",
          headers: {
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`Supabase account deletion failed: ${res.status} - ${errText}`);
        } else {
          console.log(`[Supabase Auth Admin] Successfully deleted auth user: ${userId}`);
        }
      } catch (authErr) {
        console.error("Supabase Admin deletion request threw unexpected error:", authErr);
      }
    } else {
      console.warn("⚠️ Supabase admin credentials not configured on backend. Skipping auth directory deletion.");
    }

    return NextResponse.json({
      success: true,
      message: "Account details anonymized and deleted successfully.",
    });
  } catch (err: any) {
    console.error("Account deletion route failed:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error." },
      { status: 500 }
    );
  }
}
