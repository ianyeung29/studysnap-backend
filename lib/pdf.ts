// Shim browser globals for pdfjs-dist / pdf-parse module evaluation during SSR/static Next.js build
if (typeof global !== "undefined") {
  if (!(global as any).DOMMatrix) {
    (global as any).DOMMatrix = class DOMMatrix {};
  }
}

// Using require to avoid ESM/CommonJS default export mismatch issues in Next.js
const { PDFParse } = require("pdf-parse");
import { openai, deepseek } from "@/lib/openai";

function extractEmbeddedImagesFromPdf(buffer: Buffer): Buffer[] {
  const images: Buffer[] = [];
  const str = buffer.toString("binary");
  let startIdx = 0;

  while (startIdx < str.length) {
    const streamHeaderR = str.indexOf("stream\r\n", startIdx);
    const streamHeaderN = str.indexOf("stream\n", startIdx);
    let streamPos = -1;

    if (streamHeaderR !== -1 && (streamHeaderN === -1 || streamHeaderR < streamHeaderN)) {
      streamPos = streamHeaderR + 8;
    } else if (streamHeaderN !== -1) {
      streamPos = streamHeaderN + 7;
    } else {
      break;
    }

    const endPos = str.indexOf("endstream", streamPos);
    if (endPos === -1) break;

    const raw = str.substring(streamPos, endPos);
    // Check for JPEG magic bytes \xFF\xD8\xFF
    if (raw.startsWith("\xFF\xD8\xFF")) {
      images.push(Buffer.from(raw, "binary"));
    }
    startIdx = endPos + 9;
  }

  return images;
}

export async function parsePdfPages(buffer: Buffer): Promise<string[]> {
  let parser: any = null;
  let digitalTextPages: string[] = [];

  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    if (result && result.pages && Array.isArray(result.pages)) {
      digitalTextPages = result.pages
        .map((p: any) => (p.text || "").replace(/-- \d+ of \d+ --/g, "").trim())
        .filter((t: string) => t.length > 0);
    } else if (result && result.text) {
      const cleaned = result.text.replace(/-- \d+ of \d+ --/g, "").trim();
      if (cleaned.length > 0) digitalTextPages = [cleaned];
    }
  } catch (err) {
    console.warn("[PDFParse digital stream extraction note]:", err);
  } finally {
    if (parser && typeof parser.destroy === "function") {
      try {
        await parser.destroy();
      } catch (dErr) {
        // ignore destroy error
      }
    }
  }

  // If digital text was found and has substantial characters, return it
  const totalDigitalChars = digitalTextPages.join(" ").trim().length;
  if (totalDigitalChars >= 25) {
    return digitalTextPages;
  }

  // Otherwise, this is a scanned image PDF -> Extract embedded JPEG images and run AI Vision OCR!
  const embeddedImages = extractEmbeddedImagesFromPdf(buffer);
  if (embeddedImages.length > 0) {
    console.log(`[Scanned PDF Detected] Found ${embeddedImages.length} embedded images. Running AI Vision OCR...`);
    const ocrPages: string[] = [];

    for (let i = 0; i < Math.min(embeddedImages.length, 10); i++) {
      const imgBuffer = embeddedImages[i];
      const base64 = imgBuffer.toString("base64");

      let pageText = "";
      try {
        const ocrRes = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all visible text, tables, headings, and supply lists from this scanned document page accurately." },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" } },
              ],
            },
          ],
          max_completion_tokens: 2000,
        });
        pageText = ocrRes.choices[0]?.message?.content?.trim() || "";
      } catch (openAiErr) {
        console.warn("[OpenAI PDF OCR Failed] Attempting DeepSeek Vision OCR fallback:", openAiErr);
        if (deepseek) {
          try {
            const dsRes = await deepseek.chat.completions.create({
              model: "deepseek-v4-flash-vision-exp",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Extract all visible text, tables, headings, and supply lists from this scanned document page accurately." },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
                  ],
                },
              ],
              max_tokens: 2000,
            });
            pageText = dsRes.choices[0]?.message?.content?.trim() || "";
          } catch (dsErr) {
            console.error("[DeepSeek Vision PDF OCR Error]:", dsErr);
          }
        }
      }

      if (pageText) {
        ocrPages.push(pageText);
      }
    }

    if (ocrPages.length > 0) {
      return ocrPages;
    }
  }

  if (digitalTextPages.length > 0) {
    return digitalTextPages;
  }

  throw new Error("This PDF contains no readable text or supported images. Please import it directly as a photo/screenshot.");
}
