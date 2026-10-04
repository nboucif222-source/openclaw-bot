const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get('/', (req, res) => res.send('Docker Webhook Bot is Live!'));

// إضافة توجيهات النظام المباشرة بدون تعديل هيكل الكود
const SYSTEM_INSTRUCTION = `أنت مساعد ذكي ومباشر. أجب على سؤال المستخدم فوراً وبشكل دقيق ومباشر دون مقدمات أو إطالة. إذا طلب منك المستخدم تنفيذ مهمة معينة، قم بتنفيذها فوراً وبشكل كامل دون إعطاء نصائح جانبية أو خطط عمل غير مطلوبة.`;

async function fetchGeminiResponse(modelName, userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await axios.post(url, {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: [{ parts: [{ text: userText }] }]
  }, { timeout: 10000 });
  return response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function callGeminiSmart(userText) {
  const models = ['gemini-3.8-flash', 'gemini-2.5-flash'];
  
  for (const model of models) {
    try {
      console.log(`Trying model: ${model}...`);
      const reply = await fetchGeminiResponse(model, userText);
      if (reply) return reply;
    } catch (error) {
      console.log(`Model ${model} failed with status: ${error.response?.status || error.message}`);
    }
  }
  return null;
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  try {
    const replyText = await callGeminiSmart(userText);
    const reply = replyText || 'السيرفر مشغول حالياً بطلبات كثيرة، يرجى المحاولة بعد لحظات.';

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error.message);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
