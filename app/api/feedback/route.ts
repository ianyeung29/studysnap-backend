import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/auth";

export const maxDuration = 30;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "ianyeung30@gmail.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    let verifiedUser = null;
    if (authHeader) {
      try {
        verifiedUser = await verifyUserToken(authHeader);
      } catch (e) {
        console.log("[Feedback Route] Unverified token provided, proceeding as guest feedback.");
      }
    }
    
    const body = await request.json();
    const { feedbackType = "Suggestion", feedbackText, userEmail: bodyEmail, installId } = body;

    if (!feedbackText || !feedbackText.trim()) {
      return NextResponse.json({ error: "Feedback text is required." }, { status: 400 });
    }

    const senderEmail = verifiedUser?.email || bodyEmail || "Anonymous User";
    const userId = verifiedUser?.userId || installId || "guest";

    const subject = `[StudySnap ${feedbackType}] Feedback from ${senderEmail}`;
    
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
        <h2 style="color: #a855f7; margin-top: 0;">⚡ StudySnap User Feedback</h2>
        <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #a855f7;">
          <p style="margin: 4px 0;"><strong>Category:</strong> ${feedbackType}</p>
          <p style="margin: 4px 0;"><strong>User Email:</strong> ${senderEmail}</p>
          <p style="margin: 4px 0;"><strong>User / Install ID:</strong> ${userId}</p>
          <p style="margin: 4px 0;"><strong>Submitted At:</strong> ${new Date().toISOString()}</p>
        </div>

        <h3 style="color: #e2e8f0; margin-bottom: 8px;">Message Content:</h3>
        <div style="background: #1e293b; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-size: 15px; line-height: 1.5; color: #f1f5f9;">
${feedbackText.trim()}
        </div>
        
        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; text-align: center;">
          Sent automatically via StudySnap Mobile App & Resend API
        </p>
      </div>
    `;

    console.log(`[Feedback] Processing ${feedbackType} from ${senderEmail}`);

    if (RESEND_API_KEY) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "StudySnap Feedback <onboarding@resend.dev>",
          to: [ADMIN_EMAIL],
          reply_to: senderEmail.includes("@") ? senderEmail : undefined,
          subject,
          html: htmlBody,
        }),
      });

      const resendData = await resendRes.json();

      if (!resendRes.ok) {
        console.error("[Resend Error]", resendData);
        return NextResponse.json({ 
          error: resendData.message || "Failed to send email via Resend API.",
          fallbackMailto: true 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: "Feedback delivered successfully to admin email via Resend.",
        id: resendData.id 
      });
    } else {
      console.warn("[Resend Warning] RESEND_API_KEY environment variable is not configured on server.");
      return NextResponse.json({ 
        success: true,
        warning: "RESEND_API_KEY not set on server.",
        fallbackMailto: true 
      });
    }
  } catch (error: any) {
    console.error("[Feedback API Error]", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
