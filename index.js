
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

const TELEGRAM_TOKEN = '8923020145:AAHGNflNNkj7AzQLXFxiq1i5YAdKA9Shy0o';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WEBHOOK_URL = 'https://openclaw-bot-4idd.onrender.com/webhook';

app.use(express.json());

app.get('/', (req, res) => {
  res.send('OpenClaw Bot + Gemini AI is live!');
});

app.post('/webhook', async (req, res) => {
  const message = req.body.message;
  if (message && message.chat && message.text) {
    const chatId = message.chat.id;
    const userText = message.text;

    try {
      const geminiResponse = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: userText }] }]
        }
      );

      const aiReply = geminiResponse.data.candidates[0].content.parts[0].text;

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: aiReply
      });

    } catch (err) {
      console.error('Error generating AI response:', err.response ? err.response.data : err.message);
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: 'عذراً، حدث خطأ أثناء معالجة الطلب الذكي.'
      });
    }
  }

  res.status(200).send('OK');
});

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${WEBHOOK_URL}`);
  } catch (e) {
    console.error('Webhook set error:', e.message);
  }
});
