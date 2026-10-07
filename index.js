const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;

// ذاكرة المحادثة لكل مستخدم
const chatHistories = {};

app.get('/', (req, res) => res.send('OpenClaw Bot via OpenRouter is Live!'));

const SYSTEM_INSTRUCTION = `أنت OpenClaw، مساعد أعمال ذكي وخبير في تليجرام. أجب على أسئلة المستخدم بوضوح ودقة بناءً على سياق المحادثة السابقة.`;

async function callOpenRouter(chatId, userText) {
  if (!chatHistories[chatId]) {
    chatHistories[chatId] = [];
  }

  // إضافة رسالة المستخدم الجديدة
  chatHistories[chatId].push({
    role: 'user',
    content: userText
  });

  // الاحتفاظ بأحدث 10 رسائل فقط للحد من استهلاك الذاكرة
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
        model: 'google/gemini-2.5-flash:free', // اسم النموذج المجاني والمستقر على OpenRouter
        messages: messagesPayload
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
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
    chatHistories[chatId].pop(); // التراجع عن إدراج الرسالة عند الفشل
    throw error;
  }
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  // مسح ذاكرة المحادثة عند طلب /reset
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
