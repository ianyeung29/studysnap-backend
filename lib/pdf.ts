// Shim browser globals for pdfjs-dist / pdf-parse module evaluation during SSR/static Next.js build
if (typeof global !== "undefined") {
  if (!(global as any).DOMMatrix) {
    (global as any).DOMMatrix = class DOMMatrix {};
  }
}

// Using require to avoid ESM/CommonJS default export mismatch issues in Next.js
const pdfParse = require("pdf-parse");

export async function parsePdfPages(buffer: Buffer): Promise<string[]> {
  try {
    const data = await pdfParse(buffer);
    const fullText = (data.text || "").trim();

    if (!fullText) {
      throw new Error("This PDF contains no readable text. If it is a scanned document or photo, please import it as a photo/screenshot.");
    }

    // Split text by form-feed page markers (\f) or fallback to paragraphs
    const pageSplits = fullText.split(/\f/);
    const validPages = pageSplits
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);

    if (validPages.length > 0) {
      return validPages;
    }

    return [fullText];
  } catch (err: any) {
    console.error("[PDF Parse Error]:", err);
    throw new Error(err.message || "Failed to parse PDF document. Please ensure the PDF is not password-protected.");
  }
}
