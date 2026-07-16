// Using require to avoid ESM/CommonJS default export mismatch issues in Next.js
const pdfParse = require("pdf-parse");

export async function parsePdfPages(buffer: Buffer): Promise<string[]> {
  const pages: string[] = [];

  const renderPage = (pageData: any) => {
    return pageData.getTextContent().then((textContent: any) => {
      const text = textContent.items.map((item: any) => item.str).join(" ");
      // pageData.pageIndex is 0-indexed (e.g. 0 for Page 1, 1 for Page 2)
      pages[pageData.pageIndex] = text;
      return text;
    });
  };

  try {
    await pdfParse(buffer, {
      pagerender: renderPage
    });
  } catch (err) {
    console.error("[PDF Parse Error]:", err);
    throw new Error("Failed to parse PDF document.");
  }

  // Filter out any empty/undefined pages and return
  return pages.map(p => p || "");
}
