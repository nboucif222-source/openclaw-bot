const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;

// قائمة بالنماذج المجانية مرتبة حسب الأفضلية والأداء باللغة العربية
const FREE_MODELS = [
  'qwen/qwen-2.5-72b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/free'
];

// ذاكرة المحادثة لكل شات
const chatHistories = {};

app.get('/', (req, res) => res.send('OpenClaw Bot via OpenRouter is Live!'));

const SYSTEM_INSTRUCTION = `أنت OpenClaw، مساعد أعمال ذكي وخبير في منصة تليجرام والتجارة الإلكترونية. أجب على أسئلة المستخدم بوضوح ودقة ودون تعقيد باللغة العربية.`;

async function callOpenRouterWithFallback(chatId, userText) {
  if (!chatHistories[chatId]) {
    chatHistories[chatId] = [];
  }

  // إضافة رسالة المستخدم الجديدة
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

  let lastError = null;

  // المحاولة عبر النماذج المتاحة بالتتابع في حال فشل أي نموذج
  for (const modelName of FREE_MODELS) {
    try {
      console.log(`Trying model: ${modelName}`);
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: modelName,
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
        // حفظ رد البوت في الذاكرة عند النجاح
        chatHistories[chatId].push({
          role: 'assistant',
          content: replyText
        });
        return replyText;
      }
    } catch (error) {
      console.warn(`Model ${modelName} failed:`, error.response?.data?.error?.message || error.message);
      lastError = error;
      // الانتقال تلقائياً للنموذج التالي في القائمة
    }
  }

  // التراجع عن حفظ رسالة المستخدم في الذاكرة إذا فشلت كل المحاولات
  chatHistories[chatId].pop();
  throw lastError || new Error('All models failed to respond.');
}

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  // أمر إعادة ضبط الذاكرة
  if (userText === '/reset' || userText === '/clear') {
    chatHistories[chatId] = [];
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'تم مسح ذاكرة المحادثة بنجاح!'
    });
    return;
  }

  try {
    const reply = await callOpenRouterWithFallback(chatId, userText);

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (error) {
    console.error('Final Delivery Error:', error.message);
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'عذراً، الخوادم المجانية موقوفية حالياً أو تواجه ضغطاً كبيراً. يرجى المحاولة بعد قليل.'
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
