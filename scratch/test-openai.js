const { OpenAI } = require('openai');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const openAiKeyLine = envFile.split('\n').find(line => line.startsWith('OPENAI_API_KEY'));
const apiKey = openAiKeyLine.split('=')[1].replace(/"/g, '').trim();

async function testOpenAI() {
  console.log("Testing OpenAI with gpt-5.4-mini...");
  console.log("API Key loaded:", apiKey ? "Yes" : "No");
  
  const openai = new OpenAI({
    apiKey: apiKey
  });

  try {
    const dummyJpgBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${dummyJpgBase64}` } }
          ]
        }
      ]
    });
    console.log("Success:", res.choices[0].message.content);
  } catch (err) {
    console.error("OpenAI call failed:");
    console.error(err);
  }
}

testOpenAI();
