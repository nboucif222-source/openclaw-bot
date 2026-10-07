const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// دالة إرسال الطلبات إلى n8n
async function triggerN8nAgent(userText, chatId) {
  try {
    const response = await axios.post(N8N_WEBHOOK_URL, {
      chat_id: chatId,
      command: userText,
      timestamp: new Date().toISOString()
    }, { timeout: 15000 });

    return response.data;
  } catch (error) {
    console.error('n8n Trigger Error:', error.message);
    throw error;
  }
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text.trim();

  // توجيه الأوامر التنفيذية إلى n8n عند تبديل الوضع أو البدء بكلمة أمر
  if (userText.startsWith('/agent') || userText.startsWith('نفذ:')) {
    try {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: '⏳ جاري إرسال الأمر إلى محرك n8n للتنفيذ...'
      });

      await triggerN8nAgent(userText, chatId);

    } catch (err) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: '❌ تعذر الاتصال بـ n8n. تأكد من إعداد N8N_WEBHOOK_URL في Render.'
      });
    }
    return;
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
