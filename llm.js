// llm.js

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

const OPENROUTER_model = process.env.OPENROUTER_model || "meta-llama/llama-4-maverick:free";
const PROVISIONING_KEY = process.env.OPENROUTER_PROVISIONING_KEY;

// Get fresh API key from provisioning key
async function getNewApiKey() {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/keys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PROVISIONING_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "HenryBot AutoKey",
        label: "runtime-auto",
        limit: 10000,
      }),
    });

    const data = await res.json();
    if (data.key) return data.key;
    console.error("OpenRouter: Failed to get new key", data);
    return null;
  } catch (err) {
    console.error("OpenRouter: Error fetching key", err);
    return null;
  }
}

// Main function to detect intent
async function detectIntent(message) {
  const OPENROUTER_API_KEY = await getNewApiKey();
  if (!OPENROUTER_API_KEY) {
    return "general"; // fallback if key fetch fails
  }

  const prompt = `
You are Henry Bot 2.0, assistant for Kaish Aqua Vista (a water purifier rental company).

Users might speak in Hindi, English, or Hinglish (mixed). Understand their message and classify it into one of the following intents:
- "complaint": if the user is reporting an issue or problem with the purifier.
- "installation": if the user wants to book a new purifier installation at home.
- "payment": if the user asks about making a payment or requests a QR code.
- "general": if the user is asking about fees, rental cost, owner details, or any business-related information that is not a complaint, installation request, or payment.

Only return one word: complaint, installation, payment, general, or cancel.

Examples:
- "How much is the installation fee?" → general
- "Send me the QR code" → payment
- "My RO isn’t working" → complaint
- "I want a new purifier installed" → installation
- "mera RO kaam nahi kar raha" → complaint
- "installation karwana hai" → installation
- "QR bhejo payment karni hai" → payment
- "rental fee kitna hai" → general

Message: "${message}"
Intent:
`.trim();

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENROUTER_model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });

    const data = await res.json();
    const intent = data.choices?.[0]?.message?.content?.toLowerCase().trim();

    return ['complaint', 'installation', 'payment', 'general'].includes(intent) ? intent : 'general';
  } catch (err) {
    console.error('Intent detection failed:', err);
    return 'general';
  }
}

module.exports = detectIntent;
