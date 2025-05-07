const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();
const updateApiKey = require('./updateApiKey');
const fs = require('fs');
const path = require('path');

// Cache and configuration
let currentApiKey = process.env.OPENROUTER_API_KEY;
const ENV_PATH = path.join(__dirname, '.env');
const MAX_RETRIES = 2;

/**
 * Custom error class for API responses
 */
class OpenRouterError extends Error {
  constructor(statusCode, message, metadata = {}) {
    super(message);
    this.name = 'OpenRouterError';
    this.statusCode = statusCode;
    this.metadata = metadata;
  }

  static fromResponse(response, responseBody) {
    const message = responseBody?.error?.message || 'Unknown OpenRouter error';
    const metadata = {
      code: responseBody?.error?.code,
      ...responseBody?.error?.metadata
    };
    return new OpenRouterError(response.status, message, metadata);
  }
}

/**
 * Refreshes API key from .env file
 * @returns {string|null} The refreshed API key or null if failed
 */
function refreshApiKeyFromEnv() {
  try {
    require('dotenv').config({ path: ENV_PATH, override: true });
    currentApiKey = process.env.OPENROUTER_API_KEY;
    console.log('API key refreshed from .env file');
    return currentApiKey;
  } catch (err) {
    console.error('Error refreshing API key:', err);
    return null;
  }
}

/**
 * Rotates to a new API key using the updateApiKey module
 * @returns {Promise<boolean>} Success status of the rotation
 */
async function rotateApiKey() {
  console.log('🔄 Rotating API key...');
  try {
    const newKey = await updateApiKey();
    if (newKey) {
      currentApiKey = newKey;
      console.log('✅ API key rotated successfully');
      return true;
    } else {
      console.error('❌ Failed to generate new API key');
      refreshApiKeyFromEnv();
      return false;
    }
  } catch (err) {
    console.error('❌ Error rotating API key:', err);
    return false;
  }
}

/**
 * Detects intent from user message using OpenRouter AI
 * @param {string} message - User message to analyze
 * @param {number} retryCount - Number of retry attempts made
 * @returns {Promise<string>} Detected intent
 */
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
    console.log(`🔍 Detecting intent (attempt ${retryCount + 1}/${MAX_RETRIES + 1})...`);
    
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://henrybot.local' // Optional but recommended by OpenRouter
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3-8b-instruct:nitro-maverick',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });

    // Handle non-200 responses
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const error = OpenRouterError.fromResponse(res, errorBody);
      
      console.error(`🚫 API error: [${res.status}] ${error.message}`);
      
      // Handle rate limits and authentication errors by rotating API key
      if ([401, 429].includes(res.status)) {
        if (retryCount < MAX_RETRIES) {
          console.log(`⚠️ Attempting API key rotation due to ${res.status} error...`);
          await rotateApiKey();
          return detectIntent(message, retryCount + 1);
        } else {
          console.error(`❌ Max retries (${MAX_RETRIES}) reached for intent detection`);
        }
      }
      
      return 'general'; // Default fallback if retries exhausted
    }

    // Process successful response
    const data = await res.json();
    const intent = data.choices?.[0]?.message?.content?.toLowerCase().trim();
    
    // Validate intent is within expected categories
    const validIntents = ['complaint', 'installation', 'payment', 'general', 'cancel'];
    const normalizedIntent = validIntents.includes(intent) ? intent : 'general';
    
    console.log(`✅ Intent detected: ${normalizedIntent}`);
    return normalizedIntent;
    
  } catch (err) {
    console.error('💥 Intent detection failed:', err);
    
    // Retry logic for network errors and unexpected exceptions
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Retrying with new API key (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      await rotateApiKey();
      return detectIntent(message, retryCount + 1);
    }
    
    return 'general'; // Default fallback
  }
}

module.exports = detectIntent;
module.exports.rotateApiKey = rotateApiKey;
module.exports.refreshApiKeyFromEnv = refreshApiKeyFromEnv;
module.exports.getCurrentApiKey = () => currentApiKey;
module.exports.regenerateApiKey = rotateApiKey;