const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

const TELEGRAM_TOKEN = '8923020145:AAHGNflNNkj7AzQLXFxiq1i5YAdKA9Shy0o';
const WEBHOOK_URL = 'https://openclaw-bot-4idd.onrender.com/webhook';

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is active!');
});

app.post('/webhook', async (req, res) => {
  const message = req.body.message;
  if (message && message.chat && message.text) {
    const chatId = message.chat.id;
    const userText = message.text;

    // إعادة إرسال نفس نص المستخدم (تأكيد عمل البوت)
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: `وصلت رسالتك: "${userText}" 🚀`
    });
  }

  res.status(200).send('OK');
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${WEBHOOK_URL}`);
  } catch (e) {
    console.error('Webhook set error:', e.message);
  }
});
