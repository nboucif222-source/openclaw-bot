const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// تهيئة مكتبة Gemini بالنموذج المعتمد والمستقر
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  tools: [{ googleSearch: {} }] // تفعيل أداة البحث المباشر في جوجل
});

const SYSTEM_INSTRUCTION = `أنت OpenClaw، مساعد ذكي خبير ومباشر في تليجرام. 
أجب على سؤال المستخدم فوراً وبشكل دقيق ومختصر دون إطالة أو مقدمات.`;

app.get('/', (req, res) => res.send('OpenClaw Super-Bot is Online!'));

// معالجة رسائل تليجرام
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      systemInstruction: SYSTEM_INSTRUCTION
    });

    const reply = result.response.text() || 'لم أتمكن من العثور على إجابة مناسبة.';

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (error) {
    console.error('Error Details:', error?.message || error);
    
    // في حال تعذر نموذج 2.5 نستخدم الطلب المباشر الاحتياطي
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'عذراً، حدث خطأ مؤقت أثناء معالجة الطلب. يرجى المحاولة مرة أخرى.'
    });
  }
});

// جدولة مهمة تلقائية يومية
cron.schedule('0 9 * * *', () => {
  console.log('OpenClaw Daily Task Triggered');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
