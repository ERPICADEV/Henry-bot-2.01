const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

const ENV_PATH = path.join(__dirname, '..', '.env');
let OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_model = process.env.OPENROUTER_model;
const OPENROUTER_PROVISIONING_KEY = process.env.OPENROUTER_PROVISIONING_KEY;

async function regenerateApiKey() {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_PROVISIONING_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ duration: "7d" })
    });

    const data = await res.json();
    const newKey = data.key;

    if (newKey) {
      const envContents = fs.readFileSync(ENV_PATH, 'utf8');
      const updated = envContents.replace(/OPENROUTER_API_KEY=.*/g, `OPENROUTER_API_KEY=${newKey}`);
      fs.writeFileSync(ENV_PATH, updated);

      OPENROUTER_API_KEY = newKey;
      console.log('🔁 Regenerated OpenRouter API key!');
    }
  } catch (error) {
    console.error('❌ Failed to regenerate API key:', error.message);
  }
}

async function askOpenRouter(question, systemPrompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENROUTER_model,
      messages: [
        { role: 'user', content: question },
        { role: 'system', content: systemPrompt }
      ],
      temperature: 0.5
    })
  });

  if (res.status === 401 || res.status === 402) {
    console.warn('🔑 API key expired or invalid. Attempting regeneration...');
    await regenerateApiKey();
    return askOpenRouter(question, systemPrompt); // Retry with new key
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

async function handleGeneralQuestion(client, msg) {
  const sender = msg.from;
  const userQuestion = msg.body;

  const systemPrompt = `
You are Henry Bot 2.0, a smart assistant for Kaish Aqua Vista, a water purifier rental business.

You understand and can speak Hindi, English, and Hinglish (mixed). 
Answer customer questions based on the following information:
- 💧 Rental Fee: ₹399/month
- 🔧 Installation Fee: ₹100 (one-time)
- 📞 Owner's Contact: +917982652982
- 🛠 Free maintenance & service included in rental
- 🚛 Installation available within 24–48 hours of request

Be very formal like you are talking to a boss
`.trim();

  try {
    const answer = await askOpenRouter(userQuestion, systemPrompt);
    if (answer) {
      await client.sendMessage(sender, answer);
    } else {
      await client.sendMessage(sender, "❌ Sorry, I couldn’t get the answer. Please try again.");
      console.error('❌ No answer received from OpenRouter API.',err.message);
    }
  } catch (err) {
    console.error('❌ Error answering general question:', err.message);
    await client.sendMessage(sender, "⚠️ Something went wrong while getting your answer.");
  }
}

module.exports = handleGeneralQuestion;
