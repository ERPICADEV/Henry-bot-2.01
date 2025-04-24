// getApiKey.js
const fetch = require("node-fetch");

const getNewApiKey = async () => {
  const PROVISIONING_KEY = process.env.OPENROUTER_PROVISIONING_KEY;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/keys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PROVISIONING_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "HenryBot AutoKey",
        label: "runtime-auto",
        limit: 10000, // optional usage limit
      }),
    });

    const data = await response.json();
    if (data.key) {
      return data.key;
    } else {
      console.error("Key generation failed:", data);
      return null;
    }
  } catch (err) {
    console.error("Failed to fetch new key:", err);
    return null;
  }
};

module.exports = getNewApiKey;
