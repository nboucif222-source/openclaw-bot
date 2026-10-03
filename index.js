const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 1. مسار GET للصفحة الرئيسية (لكي يعمل UptimeRobot بدون 502)
app.get('/', (req, res) => {
  res.status(200).send('OpenClaw Bot is Live!');
});

// 2. مسار POST الرئيسي الذي ينتظره تيليجرام (يصلح خطأ 404)
app.post('/', async (req, res) => {
  // رد سريع برمز 200 لتأكيد الاستلام فوراً
  res.sendStatus(200);

  try {
    const message = req.body?.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const userText = message.text;

    // طلب الاستجابة من Gemini API
    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: userText }] }]
      }
    );

    const reply = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'لم يتم استلام رد من النموذج.';

    // إرسال الرد إلى تيليجرام
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });

  } catch (error) {
    console.error('Error during webhook processing:', error.response?.data || error.message);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
