const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PRIMARY_SESSION_PATH = path.join(__dirname, 'auth.json');
const SECONDARY_SESSION_PATH = path.join(__dirname, 'auth2.json');
const ENV_PATH = path.join(__dirname, '.env');

function generateRandomKeyName() {
  return 'key-' + Math.random().toString(36).substring(2, 8);
}

/**
 * Attempts to generate an OpenRouter API key using the provided session file.
 * Returns an object with either the extracted apiKey or an error.
 * @param {string} sessionPath - Path to the auth session file
 * @returns {Promise<{apiKey?: string, error?: Error}>}
 */
async function generateKey(sessionPath) {
  let browser, context;
  try {
    console.log(`🔑 Starting key generation with ${path.basename(sessionPath)}...`);
    
    // Launch the browser
    browser = await chromium.launch({ headless: true });

    // Use session data if available.
    const contextOptions = fs.existsSync(sessionPath)
      ? { storageState: sessionPath }
      : {};

    context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // Set up response handling to detect rate limits early
    page.on('response', response => {
      if (response.status() === 429) {
        console.log(`⚠️ Rate limit detected on ${response.url()}`);
      }
    });

    // Navigate to the OpenRouter keys page.
    const response = await page.goto('https://openrouter.ai/settings/keys', { waitUntil: 'networkidle' });

    // Check for a rate limit error from the network response.
    if (response && response.status() === 429) {
      const errorResponse = await response.json().catch(() => ({ error: { message: 'Rate limit encountered' } }));
      throw new Error(`Rate limit encountered (429): ${errorResponse.error?.message || 'Too many requests'}`);
    }

    // If not already signed in, notify the user and give time to log in manually.
    if (await page.locator('text=Sign in').count() > 0) {
      console.log('Not logged in. Please log in manually.');
      await page.waitForTimeout(60000); // wait for manual login
      await context.storageState({ path: sessionPath });
      console.log(`✅ Login session saved to ${path.basename(sessionPath)}`);
    }

    // Begin API key generation by clicking the Create Key button.
    await page.waitForSelector('button:text("Create Key")', { state: 'visible' });
    await page.click('button:text("Create Key")');
    console.log('🛜 Create Key button clicked');

    // Wait for the modal to appear.
    await page.waitForSelector('text=Create a Key', { state: 'visible', timeout: 10000 });

    // Fill in a random key name.
    const randomName = generateRandomKeyName();
    await page.fill('input[placeholder*="Chatbot Key"]', randomName);
    console.log(`🖋 Filled random key name: ${randomName}`);

    // Click the secondary create button in the modal.
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const createButton = buttons.find(b => b.textContent.includes('Create') && !b.textContent.includes('Create Key'));
      if (createButton) createButton.click();
    });
    console.log('✅ Create inside modal clicked');

    // Wait for the new API key to appear.
    await page.waitForSelector('text=Your new key:', { state: 'visible', timeout: 15000 });

    // Extract the API key from the page content.
    let apiKey = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const matches = Array.from(elements)
        .map(e => e.textContent?.trim())
        .filter(text => text && text.match(/^sk-or-v1-[a-zA-Z0-9]+/));
      return matches[matches.length - 1];
    });
    if (!apiKey) {
      throw new Error('API key not found in page content');
    }
    console.log('✅ API Key extracted:', apiKey);

    // Update the .env file with the new API key.
    let envContent = fs.existsSync(ENV_PATH)
      ? fs.readFileSync(ENV_PATH, 'utf-8')
      : '';
    
    if (envContent.includes('OPENROUTER_API_KEY=')) {
      envContent = envContent.replace(/OPENROUTER_API_KEY=.*/, `OPENROUTER_API_KEY=${apiKey}`);
    } else {
      envContent += `\nOPENROUTER_API_KEY=${apiKey}\n`;
    }
    fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
    console.log('✅ .env file updated with API key');

    return { apiKey };
  } catch (err) {
    console.error(`❌ Error with session file ${path.basename(sessionPath)}:`, err.message);
    
    // Mark the error as a rate limit error if applicable.
    if (err.message.includes('429') || err.message.toLowerCase().includes('rate limit')) {
      const enhancedError = new Error(err.message);
      enhancedError.isRateLimit = true;
      return { error: enhancedError };
    }
    
    return { error: err };
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

/**
 * Main function which attempts to generate an API key using the primary account,
 * and falls back to the secondary account if a rate limit (429) error is encountered.
 * @returns {Promise<string|null>} The newly generated API key or null if failed
 */
async function updateApiKey() {
  console.log('🟢 Attempting API key generation using primary account (auth.json)...');
  let result = await generateKey(PRIMARY_SESSION_PATH);

  // Check for 429 or other errors.
  if (result.error) {
    if (result.error.isRateLimit) {
      console.warn('⚠️ Received 429 (Too Many Requests) from primary account. Retrying with secondary account (auth2.json)...');
      result = await generateKey(SECONDARY_SESSION_PATH);
      
      if (result.error) {
        console.error('❌ Both accounts failed. Primary account:', result.error.message);
        return null;
      } else {
        console.log('✅ API key successfully generated using secondary account.');
        return result.apiKey;
      }
    } else {
      console.error('❌ An error occurred with the primary account:', result.error.message);
      
      // Optional: Try secondary account for any error, not just rate limits
      console.log('⚠️ Trying secondary account as fallback...');
      result = await generateKey(SECONDARY_SESSION_PATH);
      
      if (result.error) {
        console.error('❌ Secondary account also failed:', result.error.message);
        return null;
      } else {
        console.log('✅ API key successfully generated using secondary account fallback.');
        return result.apiKey;
      }
    }
  } else {
    console.log('✅ API key successfully generated using primary account.');
    return result.apiKey;
  }
}

// For direct execution
if (require.main === module) {
  updateApiKey()
    .then(apiKey => {
      if (apiKey) {
        console.log('🎉 Successfully generated new OpenRouter API key');
        process.exit(0);
      } else {
        console.error('❌ Failed to generate API key');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('💥 Unhandled error:', err);
      process.exit(1);
    });
}

module.exports = updateApiKey;