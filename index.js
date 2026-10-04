const express = require('express');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// كائن لتخزين سجل المحادثات لكل مستخدم بشكل مستقل
const chatHistories = {};

app.get('/', (req, res) => res.send('OpenClaw Super-Bot with Memory is Online!'));

const SYSTEM_INSTRUCTION = `أنت OpenClaw، مساعد أعمال ذكي وخبير في تليجرام. أجب على أسئلة المستخدم بوضوح ودقة بناءً على سياق المحادثة السابقة.`;

async function callGeminiWithHistory(chatId, userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;

  // إنشاء سجل للمستخدم إذا لم يكن موجوداً
  if (!chatHistories[chatId]) {
    chatHistories[chatId] = [];
  }

  // إضافة رسالة المستخدم الجديدة إلى الذاكرة
  chatHistories[chatId].push({
    role: 'user',
    parts: [{ text: userText }]
  });

  // الاحتفاظ بأخر 10 رسائل فقط في الذاكرة لتفادي حجم الحمولات الكبير
  if (chatHistories[chatId].length > 10) {
    chatHistories[chatId] = chatHistories[chatId].slice(-10);
  }

  try {
    const response = await axios.post(url, {
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: chatHistories[chatId]
    }, { timeout: 15000 });

    const replyText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (replyText) {
      // إضافة رد الذكاء الاصطناعي إلى الذاكرة أيضاً
      chatHistories[chatId].push({
        role: 'model',
        parts: [{ text: replyText }]
      });
    }

    return replyText;
  } catch (error) {
    console.error('Gemini API Error:', error.response?.data || error.message);
    // في حال حدوث خطأ، نتراجع عن إضافة الرسالة الأخيرة حتى لا يختل التسلسل
    chatHistories[chatId].pop();
    throw error;
  }
}

// معالجة استقبال رسائل تليجرام
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text;

  // إمكانية مسح الذاكرة عند إرسال أمر /reset
  if (userText === '/reset' || userText === '/clear') {
    chatHistories[chatId] = [];
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'تم مسح ذاكرة المحادثة بنجاح! كيف يمكنني مساعدتك الآن؟'
    });
    return;
  }

  try {
    const reply = await callGeminiWithHistory(chatId, userText) || 'لم يتم استلام إجابة.';

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (error) {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'عذراً، حدث خطأ مؤقت أثناء معالجة الطلب.'
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
