const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function generateRandomKeyName() {
  return 'key-' + Math.random().toString(36).substring(2, 8);
}

(async () => {
  let browser;
  try {
    browser = await chromium.launchPersistentContext('./user-data', {
      headless: false,
    });
    const page = await browser.newPage();
    
    // Navigate to the API keys page
    await page.goto('https://openrouter.ai/settings/keys', { waitUntil: 'networkidle' });
    
    // Check if logged in and wait if not
    if (await page.locator('text=Sign in').count() > 0) {
      console.log('Not logged in. Please log in manually.');
      await page.waitForTimeout(60000); // Wait 1 minute for manual login
      console.log('Login session saved.');
    }
      
    // Click Create Key button
    await page.waitForSelector('button:text("Create Key")', { state: 'visible' });
    await page.click('button:text("Create Key")');
    console.log('🛜 Create Key button clicked');
    
    // Wait for modal to appear
    await page.waitForSelector('text=Create a Key', { state: 'visible', timeout: 10000 });
    
    // Fill the "Name" field with a random name
    const randomName = generateRandomKeyName();
    await page.waitForSelector('input[placeholder*="Chatbot Key"]', { state: 'visible' });
    await page.fill('input[placeholder*="Chatbot Key"]', randomName);
    console.log(`🖋 Filled random key name: ${randomName}`);
    
    // Try using JavaScript click which worked last time
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const createButton = buttons.find(button => button.textContent.includes('Create') && 
                                    !button.textContent.includes('Create Key'));
      if (createButton) createButton.click();
    });
    console.log('✅ Create inside modal clicked');
    
    // Wait for the API key modal to appear
    await page.waitForSelector('text=Your new key:', { state: 'visible', timeout: 15000 });
    console.log('API key modal appeared');
    
    // Take a screenshot of the modal for debugging
    await page.screenshot({ path: 'api-key-modal.png' });
    console.log('Screenshot of API key modal saved');
    
    // Wait a moment to ensure everything is loaded
    await page.waitForTimeout(1000);
    
    // Try multiple methods to extract the API key
    let apiKey = null;

try {
  // Method 1: Extract from the dialog using JavaScript evaluation
  apiKey = await page.evaluate(() => {
    const elements = document.querySelectorAll('*');
    let matches = [];
    for (const element of elements) {
      if (element.textContent && element.textContent.trim().match(/^sk-or-v1-[a-zA-Z0-9]+/)) {
        matches.push(element.textContent.trim());
      }
    }
    return matches[matches.length - 1]; // Get the last matched API key
  });

  if (apiKey) {
    console.log('Method 1: Found API key using JavaScript evaluation');
  } else {
    throw new Error('Method 1 failed to extract API key');
  }
} catch (error) {
  console.log('Method 1 failed:', error.message);

  try {
    // Method 2: Look for any element containing sk-or-v1 pattern
    const keyText = await page.locator('text=/sk-or-v1-[a-zA-Z0-9]+/').first().textContent();
    apiKey = keyText.match(/sk-or-v1-[a-zA-Z0-9]+/)[0];
    console.log('Method 2: Found API key using text pattern');
  } catch (error) {
    console.log('Method 2 failed:', error.message);

    try {
      // Method 3: Try to copy the key using clipboard (for elements with copy buttons)
      await page.click('button:has-text("Copy")');
      apiKey = await page.evaluate(() => navigator.clipboard.readText());
      console.log('Method 3: Copied API key to clipboard');
    } catch (error) {
      console.log('Method 3 failed:', error.message);

      // Method 4: Last resort - find the copy icon and try to get the key from nearby element
      try {
        await page.click('[data-testid="copy-icon"], svg[class*="copy"], button:has([data-testid="copy-icon"])');
        console.log('Clicked copy button');
        // Just for testing if we can get past this point
        apiKey = "Manual extraction needed - key copied to clipboard";
      } catch (error) {
        console.log('All extraction methods failed');
        throw new Error('Could not extract API key');
      }
    }
  }
}

console.log('✅ API Key extracted:', apiKey);

    
   // Update the .env file
const envPath = path.join(__dirname, '.env');
let envContent = '';

// Check if .env exists, if not create it
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
}

// Overwrite the existing API_KEY value with only the last extracted API key
envContent = envContent.replace(/API_KEY=.*/, `API_KEY=${apiKey}`);

// If API_KEY is not in .env, add it
if (!envContent.includes('API_KEY=')) {
  envContent += `\nAPI_KEY=${apiKey}\n`;
}

fs.writeFileSync(envPath, envContent, 'utf-8');
console.log('✅ .env file updated successfully with the last API key.');

    
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // Close the browser even if there was an error
    if (browser) {
      await browser.close();
    }
  }
})();