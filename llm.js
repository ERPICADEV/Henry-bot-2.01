// llm.js

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_model = process.env.OPENROUTER_model
async function detectIntent(message) {
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

    return ['complaint', 'installation', 'payment', 'general',].includes(intent) ? intent : 'general';
  } catch (err) {
    console.error('Intent detection failed:', err);
    return 'general';
  }
}

module.exports = detectIntent;