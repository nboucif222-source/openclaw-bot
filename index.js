const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// مسار UptimeRobot
app.get('/', (req, res) => {
  res.status(200).send('Bot is Live!');
});

// معالجة تحديثات تليجرام
async function handleUpdate(req, res) {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  try {
    // طلب مباشر عبر REST API مع الموديل المعتمد gemini-1.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: userText }] }]
    });

    const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'لم يتم استلام رد.';

    // إرسال الرد لتليجرام
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (error) {
    console.error('Error details:', error.response?.data || error.message);
  }
}

app.post('/', handleUpdate);
app.post('/webhook', handleUpdate);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
