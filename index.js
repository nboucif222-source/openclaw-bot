const express = require('express');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(express.json());

// تهيئة Gemini API والتوكن من متغيرات البيئة
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

app.get('/', (req, res) => {
  res.send('my OpenClaw bot is Active and Ready!');
});

app.post('/telegram-webhook', async (req, res) => {
  // إرجاع 200 فوراً لتليجرام لتجنب إعادة الطلب
  res.sendStatus(200);

  try {
    const message = req.body?.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const userText = message.text;

    // استدعاء موديل Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: userText,
      config: {
        systemInstruction: "أنت مساعد ذكي ونشط يعمل كـ AI Agent تنفذ الأوامر بدقة وبأسلوب مباشر.",
      }
    });

    const aiReply = response.text || "عذراً، لم أستطع معالجة الطلب حالياً.";

    // إرسال الرد المباشر إلى تلغرام
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: aiReply,
    });
  } catch (error) {
    console.error('Error handling Telegram Webhook:', error.message);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
