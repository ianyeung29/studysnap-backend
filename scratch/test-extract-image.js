const fs = require('fs');
const path = require('path');

async function testExtract() {
  console.log("Starting test for local /api/extract-image with a real image...");
  
  const imagePath = `C:/Users/IanYeungFluent/.gemini/antigravity/brain/74ad9304-964d-4a56-aab1-4e505f156183/app_preview_1783455772322.png`;
  if (!fs.existsSync(imagePath)) {
    console.error("Image path does not exist!");
    return;
  }

  const buffer = fs.readFileSync(imagePath);
  
  const formData = new FormData();
  const blob = new Blob([buffer], { type: 'image/png' });
  formData.append('image', blob, 'photo.png');

  try {
    const res = await fetch('http://localhost:3001/api/extract-image', {
      method: 'POST',
      body: formData
    });
    
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error during fetch:", err);
  }
}

testExtract();
