const fs = require('fs');
const path = require('path');

const complaintFile = path.join(__dirname, '..', 'data', 'complaints.csv');
const ownerNumber = '917982652982@c.us';

async function handleComplaint(client, msg, sessions) {
  const sender = msg.from;
  const text = msg.body.trim();

  if (!sessions[sender]) {
    sessions[sender] = { type: 'complaint', step: 0, data: {} };
  }

  const session = sessions[sender];

  try {
    switch (session.step) {
      case 0:
        session.data.name = text;
        session.step = 1;
        await client.sendMessage(sender, '📍 Please enter your address.');
        break;

      case 1:
        session.data.address = text;
        session.step = 2;
        await client.sendMessage(sender, '📝 Please describe your complaint.');
        break;

      case 2:
        session.data.complaint = text;
        session.data.date = new Date().toISOString();
        session.data.phone = sender.replace(/[@:\s]/g, '');

        const row = [
          session.data.date,
          session.data.phone,
          `"${session.data.name}"`,
          `"${session.data.address}"`,
          `"${session.data.complaint}"`
        ].join(',') + '\n';

        if (!fs.existsSync(complaintFile)) {
          fs.writeFileSync(complaintFile, 'date,phone,name,address,complaint\n');
        }

        fs.appendFileSync(complaintFile, row, 'utf8');

        await client.sendMessage(sender, '✅ Your complaint has been registered. We\'ll get back to you soon.');

        // 📤 Send formatted message to owner
        const message = `📩 *New Complaint Registered*\n\n👤 Name: ${session.data.name}\n📞 Phone: ${session.data.phone}\n🏠 Address: ${session.data.address}\n📝 Complaint: ${session.data.complaint}\n🕒 Date: ${session.data.date}`;
        await client.sendMessage(ownerNumber, message);

        delete sessions[sender];
        break;
    }
  } catch (err) {
    console.error('❌ Error while saving complaint:', err.message);
    await client.sendMessage(sender, '⚠️ Sorry, something went wrong while saving your complaint.');
    delete sessions[sender];
  }
}

module.exports = handleComplaint;
