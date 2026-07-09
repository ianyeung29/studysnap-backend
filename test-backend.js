// test-backend.js — Test script for Next.js AI endpoints
const http = require("http");

const SAMPLE_NOTES = `
Title: Photosynthesis & Cellular Respiration
Photosynthesis is the process by which plants convert light energy into chemical energy.
Formula: 6CO2 + 6H2O + light energy -> C6H12O6 + 6O2
It occurs in the chloroplasts. Light reactions happen in the thylakoid membrane, producing ATP and NADPH.
Calvin cycle happens in the stroma, producing glucose.
Cellular respiration is the opposite: converting glucose into ATP energy.
`;

function testSummarize() {
  console.log("Starting backend test for /api/summarize...");

  const data = JSON.stringify({
    notes: SAMPLE_NOTES,
    templateId: "study-guide",
  });

  const options = {
    hostname: "localhost",
    port: 3001,
    path: "/api/summarize",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length,
    },
  };

  const req = http.request(options, (res) => {
    console.log(`[Response Status]: ${res.statusCode}`);
    let body = "";

    res.on("data", (chunk) => {
      body += chunk;
    });

    res.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        if (parsed.success) {
          console.log("\n✅ BACKEND TEST PASSED!");
          console.log(`Title: ${parsed.title}`);
          console.log(`Content length: ${parsed.content.length} chars`);
          console.log(`Highlights count: ${parsed.highlights ? parsed.highlights.length : "undefined"}`);
          if (parsed.highlights) {
            console.log("Highlights sample:", JSON.stringify(parsed.highlights.slice(0, 3), null, 2));
          }
          console.log("\n--- Output Preview ---");
          console.log(parsed.content.substring(0, 300) + "...\n");
        } else {
          console.error("\n❌ BACKEND TEST FAILED (API returned error):");
          console.error(parsed.error || parsed);
        }
      } catch (e) {
        console.error("\n❌ BACKEND TEST FAILED (Failed to parse JSON):");
        console.error("Raw response:", body);
      }
    });
  });

  req.on("error", (e) => {
    console.error("\n❌ BACKEND TEST FAILED (Connection error):");
    console.error(e.message);
  });

  req.write(data);
  req.end();
}

testSummarize();
