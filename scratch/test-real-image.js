const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync('.env.local', 'utf8');
const openAiKeyLine = envFile.split('\n').find(line => line.startsWith('OPENAI_API_KEY'));
const apiKey = openAiKeyLine.split('=')[1].replace(/"/g, '').trim();

const openai = new OpenAI({ apiKey });

async function testModel(modelName) {
  console.log(`\n--- Testing ${modelName} ---`);
  // Path to a real image from the artifacts directory
  const imagePath = `C:/Users/IanYeungFluent/.gemini/antigravity/brain/74ad9304-964d-4a56-aab1-4e505f156183/app_preview_1783455772322.png`;
  
  if (!fs.existsSync(imagePath)) {
    console.error("Image path does not exist!");
    return;
  }
  
  const base64Image = fs.readFileSync(imagePath).toString('base64');
  
  try {
    const res = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image in one short sentence." },
            { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }
          ]
        }
      ]
    });
    console.log(`Success with ${modelName}:`, res.choices[0].message.content);
  } catch (err) {
    console.error(`Failed for ${modelName}:`, err.message);
  }
}

async function run() {
  await testModel("gpt-4o-mini");
  await testModel("gpt-5.4-mini");
}

run();
