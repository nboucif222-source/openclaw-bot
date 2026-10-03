const express = require('express');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// تهيئة مكتبة Google Gen AI الحديثة المتوافقة مع كافة أنواع المفاتيح
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 1. مسار الصفحة الرئيسية لـ UptimeRobot
app.get('/', (req, res) => {
  res.status(200).send('Bot is Live!');
});

// 2. مسار استقبال تحديثات تليجرام (يشمل / و /webhook)
async function handleUpdate(req, res) {
  res.sendStatus(200); // إجابة سريعة لتليجرام لمنع الـ Timeout

  try {
    const message = req.body?.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const userText = message.text;

    // استدعاء موديل gemini-2.5-flash باستخدام المكتبة الحديثة
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userText,
    });

    const reply = response.text || 'لم أتمكن من الحصول على رد.';

    // إرسال الرد لتليجرام
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (error) {
    console.error('Error in handling update:', error.message || error);
  }
}

app.post('/', handleUpdate);
app.post('/webhook', handleUpdate);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
