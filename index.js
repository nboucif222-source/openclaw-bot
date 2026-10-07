const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;

// ذاكرة المحادثة لجميع المستخدمين
const chatHistories = {};

app.get('/', (req, res) => res.send('OpenClaw Bot on OpenRouter is Live!'));

const SYSTEM_INSTRUCTION = `أنت OpenClaw، مساعد أعمال ذكي وخبير في تليجرام. أجب على أسئلة المستخدم بوضوح ودقة باللغة العربية.`;

async function callOpenRouter(chatId, userText) {
  if (!chatHistories[chatId]) {
    chatHistories[chatId] = [];
  }

  // إضافة رسالة المستخدم
  chatHistories[chatId].push({
    role: 'user',
    content: userText
  });

  // الاحتفاظ بأحدث 10 رسائل فقط
  if (chatHistories[chatId].length > 10) {
    chatHistories[chatId] = chatHistories[chatId].slice(-10);
  }

  const messagesPayload = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...chatHistories[chatId]
  ];

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        // استخدام الموجه المجاني التلقائي لاختيار أي نموذج مجاني متاح بدون خطأ 404
        model: 'openrouter/free',
        messages: messagesPayload
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const replyText = response.data?.choices?.[0]?.message?.content;

    if (replyText) {
      chatHistories[chatId].push({
        role: 'assistant',
        content: replyText
      });
    }

    return replyText;
  } catch (error) {
    console.error('OpenRouter Error:', error.response?.data || error.message);
    chatHistories[chatId].pop(); // التراجع عن الرسالة في حال الخطأ
    throw error;
  }
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  // إمكانية مسح السجل بالأمر /reset
  if (userText === '/reset' || userText === '/clear') {
    chatHistories[chatId] = [];
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'تم مسح ذاكرة المحادثة بنجاح!'
    });
    return;
  }

  try {
    const reply = await callOpenRouter(chatId, userText) || 'لم يتم استلام إجابة.';

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (error) {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'عذراً، حدث خطأ مؤقت أثناء معالجة الطلب. يرجى المحاولة لاحقاً.'
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
