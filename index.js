const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// تهيئة مكتبة Gemini الرسمية
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  systemInstruction: "أنت OpenClaw، مساعد ذكي خبير في إدارة الأعمال والتجارة الإلكترونية وصناعة المحتوى. أجب فوراً بدقة وبشكل مباشر."
});

app.get('/', (req, res) => res.send('OpenClaw Super-Bot is Online & Ready!'));

// معالجة رسائل تليجرام
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  try {
    const result = await model.generateContent(userText);
    const reply = result.response.text() || 'تمت المعالجة بدون نص.';

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (error) {
    console.error('Error:', error.message);
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'حدث خطأ أثناء المعالجة، يرجى المحاولة لاحقاً.'
    });
  }
});

// جدولة مهمة تلقائية (مثال: تنبيه يومي الساعة 9 صباحاً)
cron.schedule('0 9 * * *', () => {
  console.log('OpenClaw Cron Task Running...');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
