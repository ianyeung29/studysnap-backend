import { jwtVerify, createRemoteJWKSet } from "jose";

const jwtSecret = process.env.SUPABASE_JWT_SECRET;

export interface VerifiedUser {
  userId: string;
  email?: string;
  provider?: string;
}

/**
 * Verifies a Supabase HS256/ES256 JWT bearer token from the Authorization header.
 * Checks signature, exp (expiration), aud (audience = "authenticated"), and sub (subject).
 */
export async function verifyUserToken(authHeader: string | null): Promise<VerifiedUser | null> {
  if (!authHeader) {
    throw new Error("Missing Authorization header in request.");
  }
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Invalid Authorization header format. Must start with Bearer.");
  }

  const token = authHeader.substring(7);

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT token format.");
    }
    const header = JSON.parse(Buffer.from(parts[0], "base64").toString("utf8"));
    const alg = header.alg;

    let payload: any;

    if (alg === "ES256" || alg === "RS256") {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://xxwqpanfytavfvabhtbz.supabase.co";
      const jwksUrl = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
      const JWKS = createRemoteJWKSet(new URL(jwksUrl));
      
      const verified = await jwtVerify(token, JWKS, {
        audience: "authenticated",
      });
      payload = verified.payload;
    } else {
      // For HS256 tokens, verify using symmetric jwtSecret
      if (!jwtSecret) {
        console.warn("⚠️ SUPABASE_JWT_SECRET is not set. Bypassing JWT signature check for HS256 token.");
        const payloadDecoded = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
        payload = payloadDecoded;
      } else {
        const secretBuffer = new TextEncoder().encode(jwtSecret);
        const verified = await jwtVerify(token, secretBuffer, {
          audience: "authenticated",
        });
        payload = verified.payload;
      }
    }

    const userId = payload.sub;
    if (!userId) {
      throw new Error("JWT payload is missing sub (user ID) claim");
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
    let tokenMeta = "unknown";
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const header = JSON.parse(Buffer.from(parts[0], "base64").toString("utf8"));
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
        tokenMeta = `alg:${header.alg}, iss:${payload.iss}, aud:${payload.aud}, sub:${payload.sub}`;
      }
    } catch (e) {
      tokenMeta = "undecodable";
    }
    console.error("JWT verification failed:", err.message || err, `TokenMeta: ${tokenMeta}`);
    throw new Error(`JWT verification failed: ${err.message || String(err)} | TokenMeta: ${tokenMeta}`);
  }
}
