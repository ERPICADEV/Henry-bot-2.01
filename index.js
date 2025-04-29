// index.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const detectIntent = require('./llm');
const handleComplaint = require('./handlers/complaint');
const handleInstallRequest = require('./handlers/install');
const handleGeneralInquiry = require('./handlers/general');
const generateOpenRouterApiKey = require('./updateApiKey')

const sessions = {}; // Store session data

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox']
  }
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ HenryBot 2.0 is ready!');
});

client.on('message', async (msg) => {
 const sender = msg.from;
const text = msg.body.trim().toLowerCase();

// 🔁 Check for "cancel" any time
if (text === 'cancel' && sessions[sender]) {
  delete sessions[sender];
  await client.sendMessage(sender, '✅ Your current request has been cancelled.');
  return;
}

// 🔁 If user is in the middle of complaint flow
if (sessions[sender] && sessions[sender].type === 'complaint') {
  await handleComplaint(client, msg, sessions);
  return;
}


  // 🔁 If user is in the middle of installation flow
  if (sessions[sender] && sessions[sender].type === 'installation') {
    await handleInstallRequest(client, msg, sessions);
    return;
  }

  // 🧠 Detect intent if no active session
  const intent = await detectIntent(text);
  console.log(`Intent detected: ${intent}`);
  
  switch (intent) {
    case 'payment':
      const media = MessageMedia.fromFilePath('./phonepe_qr.jpeg');
      await client.sendMessage(sender, '📲 Please scan this QR to make the payment:');
      await client.sendMessage(sender, media);

      break;

    case 'complaint':
      sessions[sender] = { type: 'complaint', step: 0, data: {} };
      await client.sendMessage(sender, '👤 Please enter your full name to register your complaint.');
      break;

    case 'installation':
      sessions[sender] = { type: 'installation', step: 0, data: {} };
      await client.sendMessage(sender, '👤 Please enter your full name to request installation.');
      break;

    case 'general':
      await handleGeneralInquiry(client, msg);
      break;
    case 'rate_limited':
      await generateOpenRouterApiKey ()
    break;
    default:
      msg.reply('Sorry there is some error from our side for any detail please contact owner +917982652982');
  }

});

client.initialize();