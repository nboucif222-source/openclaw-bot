const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get('/', (req, res) => {
  res.send('my OpenClaw bot is Active and Ready!');
});

app.post('/telegram-webhook', async (req, res) => {
  // إرجاع 200 OK فوراً لتلغرام لمنع مهلة الانتظار
  res.sendStatus(200);

  try {
    const message = req.body?.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const userText = message.text;

    // استخدام الموديل المستقر gemini-2.0-flash المعتمد في REST API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await axios.post(geminiUrl, {
      contents: [{ parts: [{ text: userText }] }]
    });

    const aiReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "عذراً، لم أستطع معالجة الطلب حالياً.";

    // إرسال الرد المباشر إلى تلغرام
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: aiReply,
    });
  } catch (error) {
    console.error('Error handling Telegram Webhook:', error.response?.data || error.message);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
