const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// خادم Express لإبقاء Render نشطاً
const app = express();
app.get('/', (req, res) => res.send('Bot is running...'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// تشغيل البوت بنظام Long Polling
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userText = msg.text;

  if (!userText) return;

  try {
    // الرابط المحدث بالإصدار الصحيح
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await axios.post(url, {
      contents: [{ parts: [{ text: userText }] }]
    });

    const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'لم يتم استلام رد.';
    await bot.sendMessage(chatId, reply);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
});
