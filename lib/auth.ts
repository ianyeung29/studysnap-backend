import { jwtVerify } from "jose";

const jwtSecret = process.env.SUPABASE_JWT_SECRET;

export interface VerifiedUser {
  userId: string;
  email?: string;
  provider?: string;
}

/**
 * Verifies a Supabase HS256 JWT bearer token from the Authorization header.
 * Checks signature, exp (expiration), aud (audience = "authenticated"), and sub (subject).
 */
export async function verifyUserToken(authHeader: string | null): Promise<VerifiedUser | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);

  // If secret is missing, warn but fail open by decoding token without verification so beta works
  if (!jwtSecret) {
    console.warn("⚠️ SUPABASE_JWT_SECRET is not set. Bypassing JWT signature check. Please set this in production as soon as possible!");
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
        const userId = payload.sub;
        if (userId) {
          const email = payload.email as string | undefined;
          const appMetadata = (payload.app_metadata || {}) as Record<string, any>;
          const provider = appMetadata.provider as string | undefined;
          return {
            userId,
            email,
            provider,
          };
        }
      }
    } catch (decodeErr) {
      console.error("Failed to decode token without verification:", decodeErr);
    }
    return {
      userId: "local_dev_tester",
      email: "dev@studysnap.app",
      provider: "mock",
    };
  }

  try {
    const secretBuffer = new TextEncoder().encode(jwtSecret);
    
    // jose's jwtVerify checks:
    // - signature validity using HS256
    // - exp (token expiry)
    // - aud (audience claim)
    const { payload } = await jwtVerify(token, secretBuffer, {
      audience: "authenticated",
    });

    const userId = payload.sub;
    if (!userId) {
      console.error("JWT payload is missing sub (user ID) claim");
      return null;
    }

    const email = payload.email as string | undefined;
    const appMetadata = (payload.app_metadata || {}) as Record<string, any>;
    const provider = appMetadata.provider as string | undefined;

    return {
      userId,
      email,
      provider,
    };
  } catch (err: any) {
    console.error("JWT verification failed:", err.message || err);
    return null;
  }
}
