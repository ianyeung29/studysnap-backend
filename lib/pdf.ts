// Shim browser globals for pdfjs-dist evaluation during SSR/static Next.js build
if (typeof global !== "undefined") {
  if (!(global as any).DOMMatrix) {
    (global as any).DOMMatrix = class DOMMatrix {};
  }
}

import { getDocumentProxy, extractText, extractImages } from "unpdf";
import { PNG } from "pngjs";
import { openai, deepseek } from "@/lib/openai";

function convertImageToPngBuffer(img: { data: Uint8ClampedArray | Uint8Array; width: number; height: number; channels: number }): Buffer {
  const png = new PNG({ width: img.width, height: img.height });
  if (img.channels === 4) {
    png.data = Buffer.from(img.data);
  } else if (img.channels === 3) {
    const rgba = Buffer.alloc(img.width * img.height * 4);
    for (let i = 0, j = 0; i < img.data.length; i += 3, j += 4) {
      rgba[j] = img.data[i];
      rgba[j + 1] = img.data[i + 1];
      rgba[j + 2] = img.data[i + 2];
      rgba[j + 3] = 255;
    }
    png.data = rgba;
  } else {
    const rgba = Buffer.alloc(img.width * img.height * 4);
    for (let i = 0, j = 0; i < img.data.length; i++, j += 4) {
      const gray = img.data[i];
      rgba[j] = gray;
      rgba[j + 1] = gray;
      rgba[j + 2] = gray;
      rgba[j + 3] = 255;
    }
    png.data = rgba;
  }
  return PNG.sync.write(png);
}

export async function parsePdfPages(buffer: Buffer): Promise<string[]> {
  const uint8Data = new Uint8Array(buffer);
  let pdf: any = null;
  let digitalPages: string[] = [];

  try {
    pdf = await getDocumentProxy(uint8Data);
    const textResult = await extractText(pdf, { mergePages: false });
    if (textResult && Array.isArray(textResult.text)) {
      digitalPages = textResult.text
        .map((t: string) => (t || "").trim())
        .filter((t: string) => t.length > 0);
    }
  } catch (textErr) {
    console.warn("[unpdf digital extraction note]:", textErr);
  }

  // If substantial digital text was found, return it immediately
  const totalDigitalChars = digitalPages.join(" ").trim().length;
  if (totalDigitalChars >= 25) {
    return digitalPages;
  }

  // Otherwise, extract images from each page and run AI Vision OCR
  if (pdf) {
    const numPages = Math.min(pdf.numPages || 1, 10);
    const ocrPages: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      try {
        const pageImages = await extractImages(pdf, pageNum);
        if (pageImages && pageImages.length > 0) {
          // Take the largest image on the page (the main scanned document)
          const primaryImg = pageImages.reduce((prev: any, curr: any) =>
            curr.width * curr.height > prev.width * prev.height ? curr : prev
          );

          const pngBuffer = convertImageToPngBuffer(primaryImg);
          const base64 = pngBuffer.toString("base64");

          let pageText = "";
          try {
            const ocrRes = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Extract all visible text, lists, headings, and tables from this document page accurately. Return only the extracted text." },
                    { type: "image_url", image_url: { url: `data:image/png;base64,${base64}`, detail: "high" } },
                  ],
                },
              ],
              max_completion_tokens: 2000,
            });
            pageText = ocrRes.choices[0]?.message?.content?.trim() || "";
          } catch (openAiErr) {
            console.warn("[OpenAI PDF Vision OCR Failed] Trying DeepSeek Vision backup:", openAiErr);
            if (deepseek) {
              try {
                const dsRes = await deepseek.chat.completions.create({
                  model: "deepseek-v4-flash-vision-exp",
                  messages: [
                    {
                      role: "user",
                      content: [
                        { type: "text", text: "Extract all visible text, lists, headings, and tables from this document page accurately. Return only the extracted text." },
                        { type: "image_url", image_url: { url: `data:image/png;base64,${base64}` } },
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
      } catch (pageErr) {
        console.warn(`[PDF Page ${pageNum} image OCR error]:`, pageErr);
      }
    }

    if (ocrPages.length > 0) {
      return ocrPages;
    }
  }

  if (digitalPages.length > 0) {
    return digitalPages;
  }

  throw new Error("Could not extract readable text or images from this PDF. Please take a photo or screenshot of the page to import it.");
}
