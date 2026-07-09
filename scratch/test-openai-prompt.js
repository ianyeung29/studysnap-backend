const { OpenAI } = require('openai');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const openAiKeyLine = envFile.split('\n').find(line => line.startsWith('OPENAI_API_KEY'));
const apiKey = openAiKeyLine.split('=')[1].replace(/"/g, '').trim();

const openai = new OpenAI({ apiKey });

async function testPrompt() {
  const imagePath = `C:/Users/IanYeungFluent/.gemini/antigravity/brain/74ad9304-964d-4a56-aab1-4e505f156183/app_preview_1783455772322.png`;
  const base64Image = fs.readFileSync(imagePath).toString('base64');
  
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all visible text from this image. Preserve the structure (headings, lists, formulas) as best you can. If the image contains a diagram, briefly describe it in brackets. Return only the extracted content.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        }
      ],
      max_completion_tokens: 2000,
    });
    console.log("Response text:", res.choices[0].message.content);
  } catch (err) {
    console.error("OpenAI call failed:", err);
  }
}

testPrompt();
