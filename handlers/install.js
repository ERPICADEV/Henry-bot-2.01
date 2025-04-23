const fs = require('fs');
const path = require('path');

const installFile = path.join(__dirname, '..', 'data', 'installations.csv');
const ownerNumber = '917982652982@c.us';

async function handleInstallRequest(client, msg, sessions) {
  const sender = msg.from;
  const text = msg.body.trim();

  if (!sessions[sender]) {
    sessions[sender] = { type: 'installation', step: 0, data: {} };
  }

  const session = sessions[sender];

  try {
    switch (session.step) {
      case 0:
        session.data.name = text;
        session.step = 1;
        await client.sendMessage(sender, '📍 Please enter your address for installation.');
        break;

      case 1:
        session.data.address = text;
        session.step = 2;
        await client.sendMessage(sender, '📅 Please provide your preferred installation date (e.g. 10th April).');
        break;

      case 2:
        session.data.date = text;
        session.data.phone = sender.replace(/[@:\s]/g, '');
        session.data.registeredAt = new Date().toISOString();

        const row = [
          session.data.registeredAt,
          session.data.phone,
          `"${session.data.name}"`,
          `"${session.data.address}"`,
          `"${session.data.date}"`
        ].join(',') + '\n';

        if (!fs.existsSync(installFile)) {
          fs.writeFileSync(installFile, 'registeredAt,phone,name,address,preferredDate\n');
        }

        fs.appendFileSync(installFile, row, 'utf8');

        await client.sendMessage(sender, '✅ Your RO installation request has been registered.');

        // 📤 Send formatted message to owner
        const message = `🛠️ *New RO Installation Request*\n\n👤 Name: ${session.data.name}\n📞 Phone: ${session.data.phone}\n🏠 Address: ${session.data.address}\n📅 Preferred Date: ${session.data.date}\n🕒 Registered: ${session.data.registeredAt}`;
        await client.sendMessage(ownerNumber, message);

        delete sessions[sender];
        break;
    }
  } catch (err) {
    console.error('❌ Error while saving installation request:', err.message);
    await client.sendMessage(sender, '⚠️ Sorry, something went wrong while saving your request.');
    delete sessions[sender];
  }
}

module.exports = handleInstallRequest;
