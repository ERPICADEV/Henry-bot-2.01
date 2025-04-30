const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = path.join(__dirname, 'auth.json');
const ENV_PATH = path.join(__dirname, '.env');

function generateRandomKeyName() {
  return 'key-' + Math.random().toString(36).substring(2, 8);
}

async function generateOpenRouterApiKey() {
  let browser, context;
  try {
    const browserArgs = { headless: false };
    browser = await chromium.launch(browserArgs);

    const contextOptions = fs.existsSync(SESSION_PATH)
      ? { storageState: SESSION_PATH }
      : {};

    context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    await page.goto('https://openrouter.ai/settings/keys', { waitUntil: 'networkidle' });

    if (await page.locator('text=Sign in').count() > 0) {
      console.log('Not logged in. Please log in manually.');
      await page.waitForTimeout(60000);
      await context.storageState({ path: SESSION_PATH });
      console.log('✅ Login session saved to auth.json');
    }

    await page.waitForSelector('button:text("Create Key")', { state: 'visible' });
    await page.click('button:text("Create Key")');
    console.log('🛜 Create Key button clicked');

    await page.waitForSelector('text=Create a Key', { state: 'visible', timeout: 10000 });

    const randomName = generateRandomKeyName();
    await page.fill('input[placeholder*="Chatbot Key"]', randomName);
    console.log(`🖋 Filled random key name: ${randomName}`);

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const createButton = buttons.find(b => b.textContent.includes('Create') && !b.textContent.includes('Create Key'));
      if (createButton) createButton.click();
    });
    console.log('✅ Create inside modal clicked');

    await page.waitForSelector('text=Your new key:', { state: 'visible', timeout: 15000 });

    let apiKey = null;
    try {
      apiKey = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const matches = Array.from(elements)
          .map(e => e.textContent?.trim())
          .filter(text => text?.match(/^sk-or-v1-[a-zA-Z0-9]+/));
        return matches[matches.length - 1];
      });
      if (!apiKey) throw new Error('API key not found');
      console.log('Method 1: Found API key via JS');
    } catch (error) {
      console.error('API key extraction failed:', error.message);
      apiKey = 'Manual extraction needed';
    }

    console.log('✅ API Key extracted:', apiKey);

    let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
    if (envContent.includes('API_KEY=')) {
      envContent = envContent.replace(/API_KEY=.*/, `API_KEY=${apiKey}`);
    } else {
      envContent += `\nAPI_KEY=${apiKey}\n`;
    }
    fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
    console.log('✅ .env file updated with API key');

    return apiKey;
  } catch (err) {
    console.error('❌ Error:', err);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = generateOpenRouterApiKey;
