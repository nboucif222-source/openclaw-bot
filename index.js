const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get('/', (req, res) => res.send('Docker Webhook Bot is Live!'));

// دالة لإعادة المحاولة عند حدوث خطأ 503
async function callGeminiWithRetry(userText, retries = 3, delay = 2000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(url, {
        contents: [{ parts: [{ text: userText }] }]
      });
      return response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      const status = error.response?.status;
      if (status === 503 && i < retries - 1) {
        console.log(`Gemini API busy (503). Retrying in ${delay / 1000}s... (Attempt ${i + 1}/${retries})`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2; // مضاعفة وقت الانتظار تلقائياً
      } else {
        throw error;
      }
    }
  }
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  try {
    const replyText = await callGeminiWithRetry(userText);
    const reply = replyText || 'لم يتم استلام رد من النموذج.';

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'السيرفر مشغول حالياً بطلبات كثيرة، يرجى المحاولة بعد لحظات.'
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
