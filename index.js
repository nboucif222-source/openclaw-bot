const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// دالة مشتركة لمعالجة جميع الرسائل الواردة
async function handleUpdate(req, res) {
  res.sendStatus(200); // إرسال استجابة سريعة لتليجرام لمنع الـ Timeout

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  try {
    // طلب الإجابة من Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const geminiRes = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: userText }] }]
    });

    const reply = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || "لم يتم استلام رد.";

    // إرسال الرد لتليجرام
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (err) {
    console.error('Error handling update:', err.message);
  }
}

// استجابة UptimeRobot على الصفحة الرئيسية (GET)
app.get('/', (req, res) => {
  res.send('Bot is Live and Ready!');
});

// استقبال رسائل تليجرام على كل المسارات المحتملة (POST / و POST /webhook)
app.post('/', handleUpdate);
app.post('/webhook', handleUpdate);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
