const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// مسار الصفحة الرئيسية لخدمة UptimeRobot
app.get('/', (req, res) => {
  res.status(200).send('OpenClaw Bot is Live!');
});

// مسار Webhook
app.post('/', async (req, res) => {
  res.sendStatus(200); // رد سريع لمنع Timeout

  try {
    const message = req.body?.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const userText = message.text;

    // استدعاء Gemini API مباشرة عبر Axios
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: userText }] }]
      }
    );

    const reply = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'عذراً، لم أستطع فهم الإجابة.';

    // إرسال الرد لتليجرام
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
