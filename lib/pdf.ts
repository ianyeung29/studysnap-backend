// Shim browser globals for pdfjs-dist / pdf-parse module evaluation during SSR/static Next.js build
if (typeof global !== "undefined") {
  if (!(global as any).DOMMatrix) {
    (global as any).DOMMatrix = class DOMMatrix {};
  }
}

// Using require to avoid ESM/CommonJS default export mismatch issues in Next.js
const { PDFParse } = require("pdf-parse");

export async function parsePdfPages(buffer: Buffer): Promise<string[]> {
  let parser: any = null;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    if (!result || !result.text || !result.text.trim()) {
      throw new Error("This PDF contains no readable text. If it is a scanned document or photo, please import it as a photo/screenshot.");
    }

    if (result.pages && Array.isArray(result.pages) && result.pages.length > 0) {
      const pageTexts = result.pages
        .map((p: any) => (p.text || "").trim())
        .filter((t: string) => t.length > 0);

      if (pageTexts.length > 0) {
        return pageTexts;
      }
    }

    return [result.text.trim()];
  } catch (err: any) {
    console.error("[PDF Parse Error]:", err);
    throw new Error(err.message || "Failed to parse PDF document. Please ensure the PDF is not password-protected.");
  } finally {
    if (parser && typeof parser.destroy === "function") {
      try {
        await parser.destroy();
      } catch (dErr) {
        // ignore destroy error
      }
    }
  }
}
