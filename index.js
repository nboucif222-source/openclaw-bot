const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;

// النماذج المجانية المتاحة بالترتيب
const FREE_MODELS = [
  'qwen/qwen-2.5-72b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/free'
];

const chatHistories = {};

app.get('/', (req, res) => res.send('OpenClaw Multi-Tool Bot is Live!'));

const SYSTEM_INSTRUCTION = `أنت OpenClaw، مساعد ذكي متكامل وخبير في التجارة الإلكترونية والأعمال.
يمكنك مساعدة المستخدمين في:
1. الإجابة عن الاستفسارات والتحليل وتلخيص النصوص.
2. توليد الصور والرسومات.
3. البحث المباشر عن المعلومات والأخبار عبر الويب.
4. تسجيل الطلبيات والبيانات.
أجب دائماً بلغة عربية واضحة ومباشرة.`;

// --- 1. ميزة البحث في الويب (DuckDuckGo Instant Search) ---
async function searchWeb(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });
    const html = response.data;
    // استخراج النصوص الفرعية من نتائج البحث
    const snippets = [];
    const regExp = /<a class="result__snippet[^>]*>(.*?)<\/a>/g;
    let match;
    while ((match = regExp.exec(html)) !== null && snippets.length < 4) {
      const cleanText = match[1].replace(/<[^>]+>/g, '').trim();
      if (cleanText) snippets.push(cleanText);
    }
    return snippets.join('\n---\n');
  } catch (err) {
    console.error('Web Search Error:', err.message);
    return null;
  }
}

// --- 2. ميزة إنشاء الصور (Pollinations AI - Free) ---
function generateImageUrl(prompt) {
  const encodedPrompt = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
}

// --- 3. طلب الذكاء الاصطناعي مع التبديل التلقائي ---
async function callOpenRouter(chatId, userText, extraContext = '') {
  if (!chatHistories[chatId]) chatHistories[chatId] = [];

  let fullPrompt = userText;
  if (extraContext) {
    fullPrompt += `\n\n[معلومات إضافية مسترجعة من الويب/النظام]:\n${extraContext}`;
  }

  chatHistories[chatId].push({ role: 'user', content: fullPrompt });
  if (chatHistories[chatId].length > 10) {
    chatHistories[chatId] = chatHistories[chatId].slice(-10);
  }

  const messagesPayload = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...chatHistories[chatId]
  ];

  let lastError = null;
  for (const modelName of FREE_MODELS) {
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        { model: modelName, messages: messagesPayload },
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
        chatHistories[chatId].push({ role: 'assistant', content: replyText });
        return replyText;
      }
    } catch (error) {
      console.warn(`Model ${modelName} failed:`, error.response?.data?.error?.message || error.message);
      lastError = error;
    }
  }

  chatHistories[chatId].pop();
  throw lastError || new Error('All AI models failed.');
}

// --- 4. معالج الرسائل الرئيسي (Webhook) ---
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userText = message.text.trim();

  // إعادة ضبط الذاكرة
  if (userText === '/reset' || userText === '/clear') {
    chatHistories[chatId] = [];
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'تم مسح ذاكرة المحادثة بنجاح!'
    });
    return;
  }

  // A. اكتشاف طلب توليد صور
  const imageKeywords = ['ارسم', 'انشئ صورة', 'إنشاء صورة', 'صورة لـ', 'صوره لـ', 'generate image', 'draw'];
  const isImageReq = imageKeywords.some(kw => userText.toLowerCase().includes(kw));

  if (isImageReq) {
    try {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: 'جاري صياغة وإنشاء الصورة، يرجى الانتظار...'
      });

      const imageUrl = generateImageUrl(userText);

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
        chat_id: chatId,
        photo: imageUrl,
        caption: `✨ هذه هي الصورة المطلوبة بناءً على وصفك: "${userText}"`
      });
      return;
    } catch (err) {
      console.error('Photo Send Error:', err.message);
    }
  }

  // B. اكتشاف طلب البحث في الويب
  const searchKeywords = ['ابحث عن', 'بحث عن', 'ماهو سعر', 'أخبار', 'search', 'google'];
  const isSearchReq = searchKeywords.some(kw => userText.toLowerCase().includes(kw));

  let webContext = '';
  if (isSearchReq) {
    const searchResults = await searchWeb(userText);
    if (searchResults) {
      webContext = searchResults;
    }
  }

  // C. المعالجة عبر الذكاء الاصطناعي
  try {
    const reply = await callOpenRouter(chatId, userText, webContext);
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: reply
    });
  } catch (error) {
    console.error('Final Error:', error.message);
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: 'عذراً، حدث خطأ أثناء معالجة الطلب. يرجى إعادة المحاولة لاحقاً.'
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
