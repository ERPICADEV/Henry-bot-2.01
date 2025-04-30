const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();
const generateOpenRouterApiKey = require('./updateApiKey');

let currentApiKey = process.env.OPENROUTER_API_KEY;

function refreshApiKeyFromEnv() {
  try {
    currentApiKey = process.env.OPENROUTER_API_KEY;
    console.log('API key refreshed from .env file');
    return currentApiKey;
  } catch (err) {
    console.error('Error refreshing API key:', err);
    return null;
  }
}

async function rotateApiKey() {
  console.log('Rotating API key...');
  try {
    const newKey = await generateOpenRouterApiKey();
    if (newKey) {
      currentApiKey = newKey;
      console.log('API key rotated successfully');
      return true;
    } else {
      console.error('Failed to generate new API key');
      refreshApiKeyFromEnv();
      return false;
    }
  } catch (err) {
    console.error('Error rotating API key:', err);
    return false;
  }
}

async function detectIntent(message, retryCount = 0) {
  const prompt = `
You are Henry Bot 2.0, assistant for Kaish Aqua Vista (a water purifier rental company).

Classify the user message into: complaint, installation, payment, general, or cancel.

Examples:
- "How much is the installation fee?" → general
- "Send me the QR code" → payment
- "My RO isn't working" → complaint
- "mera RO kaam nahi kar raha" → complaint
- "installation karwana hai" → installation

Message: "${message}"
Intent:`.trim();

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3-8b-instruct:nitro-maverick',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });

    if ([401, 429].includes(res.status)) {
      console.error(`API error: ${res.status}. ${await res.text()}`);
      if (retryCount < 2) {
        await rotateApiKey();
        return detectIntent(message, retryCount + 1);
      }
      return 'general';
    }

    const data = await res.json();
    const intent = data.choices?.[0]?.message?.content?.toLowerCase().trim();
    return ['complaint', 'installation', 'payment', 'general'].includes(intent) ? intent : 'general';

  } catch (err) {
    console.error('Intent detection failed:', err);
    if (retryCount < 2) {
      await rotateApiKey();
      return detectIntent(message, retryCount + 1);
    }
    return 'general';
  }
}

module.exports = detectIntent;
module.exports.rotateApiKey = rotateApiKey;
module.exports.refreshApiKeyFromEnv = refreshApiKeyFromEnv;
module.exports.getCurrentApiKey = () => currentApiKey;
module.exports.regenerateApiKey = rotateApiKey;
