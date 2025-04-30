const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { rotateApiKey, getCurrentApiKey } = require('../llm');

async function handleGeneralQuestion(client, msg, retryCount = 0) {
  const sender = msg.from;
  const question = msg.body;

  const systemPrompt = `
You are Henry Bot 2.0, assistant for Kaish Aqua Vista.

You understand Hindi, English, and Hinglish. Use the following info:
- ₹399/month rental
- ₹100 installation (one-time)
- Free service
- 24–48 hour install
- Owner: +917982652982

Respond very formally like you're talking to a boss.
`.trim();

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getCurrentApiKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3-8b-instruct:nitro-maverick',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        temperature: 0.5
      })
    });

    if ([401, 429].includes(res.status)) {
      if (retryCount < 2) {
        await rotateApiKey();
        return handleGeneralQuestion(client, msg, retryCount + 1);
      }
      return client.sendMessage(sender, "⚠️ We're facing issues. Please try again later.");
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;

    await client.sendMessage(sender, reply || "❌ Sorry, I couldn't get the answer. Try again.");

  } catch (err) {
    console.error('Error in general question:', err);
    if (retryCount < 2) {
      await rotateApiKey();
      return handleGeneralQuestion(client, msg, retryCount + 1);
    }
    await client.sendMessage(sender, "⚠️ Something went wrong. Please try again later.");
  }
}

module.exports = handleGeneralQuestion;
