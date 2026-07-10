async function testJwks() {
  const url = "https://xxwqpanfytavfvabhtbz.supabase.co/auth/v1/.well-known/jwks.json";
  try {
    const res = await fetch(url);
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Keys:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to fetch JWKS:", err);
  }
}
testJwks();
