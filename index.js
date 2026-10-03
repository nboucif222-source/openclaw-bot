const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 1. مسار الصفحة الرئيسية (استجابة لـ UptimeRobot)
app.get('/', (req, res) => {
  res.send('Bot is running');
});

// 2. مسار استقبال رسائل تليجرام الرئيسي (POST /)
app.post('/', async (req, res) => {
  // أرسل رد 200 لتليجرام فوراً
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  try {
    // نداء مباشر لبسيط لـ Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const geminiRes = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: userText }] }]
    });

    const reply = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "لم يصل رد";

    // إرسال الرد لتليجرام
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (err) {
    console.log('Error:', err.message);
  }
});

app.listen(process.env.PORT || 10000);
