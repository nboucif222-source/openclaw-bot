const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

const TELEGRAM_TOKEN = '8923020145:AAHGNflNNkj7AzQLXFxiq1i5YAdKA9Shy0o';
const WEBHOOK_URL = 'https://openclaw-bot-4idd.onrender.com/webhook';

app.use(express.json());

app.get('/', (req, res) => {
  res.send('OpenClaw Bot is active 24/7!');
});

app.post('/webhook', async (req, res) => {
  console.log('=== NEW TELEGRAM MESSAGE RECEIVED ===');
  console.log(JSON.stringify(req.body, null, 2));

  const message = req.body.message;
  if (message && message.chat) {
    const chatId = message.chat.id;
    const textReceived = message.text || '';

    try {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: `أهلاً بك! تم استلام رسالتك: "${textReceived}" والسيرفر شغال 100% 🚀`
      });
    } catch (err) {
      console.error('Failed to send Telegram response:', err.message);
    }
  }

  res.status(200).send('OK');
});

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  
  // ربط الويب هوك تلقائياً دون أي تدخل يدوي
  try {
    const res = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${WEBHOOK_URL}`);
    console.log('Webhook Auto-Set Result:', res.data);
  } catch (e) {
    console.error('Auto-Set Webhook Error:', e.message);
  }
});
