const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// دالة المعالجة
async function handleMessage(req, res) {
  // 1. إرسال رد سريع لتليجرام لمنع الـ Timeout
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  try {
    // 2. استدعاء Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const geminiRes = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: userText }] }]
    });

    const reply = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "عذراً، لم أستطع معالجة النص.";

    // 3. إرسال الرد لتليجرام
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

// مسار UptimeRobot
app.get('/', (req, res) => res.send('Bot is Live!'));

// استلام تحديثات تليجرام على كل من / و /webhook لتفادي أي 404
app.post('/', handleMessage);
app.post('/webhook', handleMessage);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
