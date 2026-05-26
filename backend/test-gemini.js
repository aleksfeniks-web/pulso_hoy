require('dotenv').config();
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const apiKey = process.env.GOOGLE_AI_KEY;

async function run() {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hola, dime hola." }] }],
        generationConfig: { 
          temperature: 0.7, 
          maxOutputTokens: 8192
        }
      })
    });
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text);
  } catch (e) {
    console.error("Error in fetch:", e);
  }
}
run();
