// handlers/general.js
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_model = process.env.OPENROUTER_model

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
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENROUTER_model,
        messages: [
          { role: 'user', content: userQuestion },
          { role: 'system', content: systemPrompt }
        ],
        temperature: 0.5
      })
    });

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content;

    if (answer) {
      await client.sendMessage(sender, answer);
    } else {
      await client.sendMessage(sender, "❌ Sorry, I couldn’t get the answer. Please try again.");
      console.error('❌ No answer received from OpenRouter API:', data);
    }
  } catch (err) {
    console.error('❌ Error answering general question:', err.message);
    await client.sendMessage(sender, "⚠️ Something went wrong while getting your answer.");
  }
}

module.exports = handleGeneralQuestion; 
