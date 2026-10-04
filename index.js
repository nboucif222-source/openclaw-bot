const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get('/', (req, res) => res.send('Docker Webhook Bot is Live!'));

const SYSTEM_INSTRUCTION = `أنت مساعد ذكي ومباشر. أجب على سؤال المستخدم فوراً وبشكل دقيق ومباشر دون مقدمات أو إطالة. إذا طلب منك المستخدم تنفيذ مهمة معينة، قم بتنفيذها فوراً وبشكل كامل دون إعطاء نصائح جانبية أو خطط عمل غير مطلوبة.`;

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await axios.post(url, {
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: [{ parts: [{ text: userText }] }]
    }, { timeout: 12000 });

    const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'لم يتم استلام رد.';

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'حدث خطأ في معالجة الطلب، يرجى المحاولة بعد قليل.'
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
