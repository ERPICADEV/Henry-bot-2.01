const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const detectIntent = require('./llm');
const handleComplaint = require('./handlers/complaint');
const handleInstallRequest = require('./handlers/install');
const handleGeneralInquiry = require('./handlers/general');

const sessions = {};
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true, args: ['--no-sandbox'] }
});

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('✅ HenryBot 2.0 is ready!'));

client.on('message', async (msg) => {
  const sender = msg.from;
  const text = msg.body.trim().toLowerCase();

  if (text === 'cancel' && sessions[sender]) {
    delete sessions[sender];
    return client.sendMessage(sender, '✅ Your current request has been cancelled.');
  }

  const session = sessions[sender];

  if (session?.type === 'complaint') return handleComplaint(client, msg, sessions);
  if (session?.type === 'installation') return handleInstallRequest(client, msg, sessions);

  const intent = await detectIntent(text);
  console.log(`Intent detected: ${intent}`);

  switch (intent) {
    case 'payment':
      const qr = MessageMedia.fromFilePath('./phonepe_qr.jpeg');
      await client.sendMessage(sender, '📲 Please scan this QR to make the payment:');
      return client.sendMessage(sender, qr);

    case 'complaint':
      sessions[sender] = { type: 'complaint', step: 0, data: {} };
      return client.sendMessage(sender, '👤 Please enter your full name to register your complaint.');

    case 'installation':
      sessions[sender] = { type: 'installation', step: 0, data: {} };
      return client.sendMessage(sender, '👤 Please enter your full name to request installation.');

    case 'general':
      return handleGeneralInquiry(client, msg);

    default:
      return msg.reply('Sorry, there is some error on our side. Please contact the owner at +917982652982');
  }
});

client.initialize();
