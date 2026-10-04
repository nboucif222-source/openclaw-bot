const express = require('express');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get('/', (req, res) => res.send('OpenClaw Super-Bot is Online & Live!'));

const SYSTEM_INSTRUCTION = `أنت OpenClaw، مساعد ذكي خبير ومباشر في تليجرام. أجب على سؤال المستخدم فوراً وبشكل دقيق ومختصر دون إطالة أو مقدمات.`;

// معالجة رسائل تليجرام
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  try {
    // إرسال الطلب المباشر للنموذج المعتمد gemini-3.8-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await axios.post(url, {
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: [{ parts: [{ text: userText }] }],
      tools: [
        { google_search: {} } // تفعيل أداة البحث المباشر
      ]
    }, { timeout: 15000 });

    const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'لم يتم استلام إجابة من النموذج.';

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (error) {
    console.error('API Error Details:', error.response?.data || error.message);
    
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'عذراً، حدث خطأ أثناء معالجة الطلب. يرجى المحاولة مرة أخرى.'
    });
  }
});

// جدولة مهمة تلقائية يومية
cron.schedule('0 9 * * *', () => {
  console.log('OpenClaw Daily Task Triggered');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
