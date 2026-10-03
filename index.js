const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ذاكرة مؤقتة في السيرفر
const memoryStore = {};

const SYSTEM_INSTRUCTION = `
أنت النواة الذكية الفائقة "OpenClaw Ultra AI Agent" - نظام ذكاء اصطناعي سيادي مستمر التعلم.

تتكون بنيتك المعرفية من عدة محركات خبرة متخصصة:
1. خبير صناعة المحتوى والفيديو والتصميم.
2. خبير التجارة الإلكترونية واكتشاف المنتجات الرابحة.
3. خبير برمجيات SaaS والمشاريع الرقمية والبرمجة.
4. خبير الأسواق المالية والتداول وقراءة الشارتات.

قواعد العمل: تقديم إجابات عميقة، مباشرة، ومستندة لأدوات البحث والتحليل المتقدم.
`;

const MAIN_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "🚀 منتج رابح & تسويق", callback_data: "btn_ecom" },
      { text: "🎬 سيناريو فيديو / Prompt", callback_data: "btn_video" }
    ],
    [
      { text: "📈 تحليل تداول / شارت", callback_data: "btn_trading" },
      { text: "💻 خبير SaaS & برمجة", callback_data: "btn_saas" }
    ],
    [
      { text: "🎨 توليد تصميم / صورة", callback_data: "btn_img_gen" },
      { text: "🧹 مسح الذاكرة", callback_data: "btn_clear" }
    ]
  ]
};

app.get('/', (req, res) => {
  res.send('OpenClaw Super AI Agent is Active!');
});

app.post('/telegram-webhook', async (req, res) => {
  res.sendStatus(200);

  try {
    if (req.body?.callback_query) {
      await handleCallbackQuery(req.body.callback_query);
      return;
    }

    const message = req.body?.message;
    if (!message) return;

    const chatId = String(message.chat.id);
    const userText = message.text ? message.text.trim() : "";

    if (userText === '/clear') {
      delete memoryStore[chatId];
      await sendTelegramMessage(chatId, "🧹 تم مسح الذاكرة المؤقتة بالكامل!", MAIN_KEYBOARD);
      return;
    }

    if (userText === '/start') {
      const welcomeMsg = "🔥 **أهلاً بك في OpenClaw Super-Agent!**\n\n" +
                         "مساعدك الفائق المخصص للسيطرة على كافة المجالات:\n\n" +
                         "🛒 التجارة الإلكترونية والمنتجات الرابحة\n" +
                         "🎬 صناعة المحتوى وسيناريوهات الفيديو\n" +
                         "💻 هندسة البرمجيات وSaaS\n" +
                         "📈 التداول وقراءة الشارتات\n\n" +
                         "أرسل سؤالك، صورتك، أو ملفك مباشرة للتنفيذ!";
      await sendTelegramMessage(chatId, welcomeMsg, MAIN_KEYBOARD);
      return;
    }

    if (userText.startsWith('/image')) {
      const prompt = userText.replace('/image', '').trim();
      if (!prompt) {
        await sendTelegramMessage(chatId, "⚠️ يرجى كتابة وصف التصميم المطلوب بعد الأمر `/image`.");
        return;
      }
      await sendTelegramMessage(chatId, "🎨 جاري إنشاء التصميم بأعلى دقة...");
      await generateAndSendImage(chatId, prompt);
      return;
    }

    if (!memoryStore[chatId]) memoryStore[chatId] = [];
    let history = memoryStore[chatId];

    let currentParts = [];
    if (userText) currentParts.push({ text: userText });

    if (message.photo) {
      const photo = message.photo[message.photo.length - 1];
      const fileData = await getTelegramFileBase64(photo.file_id);
      if (fileData) {
        currentParts.push({
          inlineData: { mimeType: "image/jpeg", data: fileData }
        });
        if (!userText) currentParts.push({ text: "قم بتحليل هذه الصورة/الشارت بأسلوب خبير واستخرج كافة التفاصيل." });
      }
    }

    if (currentParts.length === 0) return;

    history.push({ role: 'user', parts: currentParts });
    if (history.length > 15) history = history.slice(-15);

    const geminiPayload = {
      contents: [
        { role: 'user', parts: [{ text: `[SYSTEM INSTRUCTION]: ${SYSTEM_INSTRUCTION}` }] },
        { role: 'model', parts: [{ text: "فهمت النطاق الكامل. أنا جاهز كمساعد فائق للمعالجة." }] },
        ...history
      ],
      tools: [{ googleSearch: {} }]
    };

    let aiReply = "";
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const response = await axios.post(geminiUrl, geminiPayload);
      aiReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (apiError) {
      delete geminiPayload.tools;
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const fallbackResponse = await axios.post(fallbackUrl, geminiPayload);
      aiReply = fallbackResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    if (aiReply) {
      history.push({ role: 'model', parts: [{ text: aiReply }] });
      memoryStore[chatId] = history;
      await sendTelegramMessage(chatId, aiReply, MAIN_KEYBOARD);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
});

async function handleCallbackQuery(query) {
  const chatId = String(query.message.chat.id);
  const data = query.data;

  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: query.id });

  if (data === "btn_ecom") {
    await sendTelegramMessage(chatId, "🛒 **قسم التجارة الإلكترونية:**\nأرسل اسم منتج أو رابط متجر منافس للحصول على دراسة كاملة!");
  } else if (data === "btn_video") {
    await sendTelegramMessage(chatId, "🎬 **صناعة المحتوى:**\nاكتب فكرة الفيديو وسأقوم بصياغة سيناريو احترافي + Prompts!");
  } else if (data === "btn_trading") {
    await sendTelegramMessage(chatId, "📈 **قسم التداول:**\nأرسل لقطة شاشة (Screenshot) للشارت الفني لمعاينته وتحليله!");
  } else if (data === "btn_saas") {
    await sendTelegramMessage(chatId, "💻 **قسم SaaS والبرمجة:**\nاكتب فكرة مشروعك أو المشكلة البرمجية للحصول على حل تقني متكامل!");
  } else if (data === "btn_img_gen") {
    await sendTelegramMessage(chatId, "🎨 **توليد الصور:**\nاكتب الأمر `/image` متبوعاً بالوصف.");
  } else if (data === "btn_clear") {
    delete memoryStore[chatId];
    await sendTelegramMessage(chatId, "🧹 تم مسح الذاكرة!", MAIN_KEYBOARD);
  }
}

async function getTelegramFileBase64(fileId) {
  try {
    const fileRes = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
    const filePath = fileRes.data?.result?.file_path;
    if (!filePath) return null;

    const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
    const imageRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
    return Buffer.from(imageRes.data).toString('base64');
  } catch (err) {
    return null;
  }
}

async function generateAndSendImage(chatId, prompt) {
  try {
    const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}`;
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
      chat_id: chatId,
      photo: imageUrl,
      caption: `✨ **التصميم المطلوب:**\n"${prompt}"`
    });
  } catch (err) {
    await sendTelegramMessage(chatId, "❌ تعذر توليد الصورة حالياً، حاول مجدداً.");
  }
}

async function sendTelegramMessage(chatId, text, replyMarkup = null) {
  const maxLength = 4000;
  for (let i = 0; i < text.length; i += maxLength) {
    const chunk = text.substring(i, i + maxLength);
    const payload = { chat_id: chatId, text: chunk, parse_mode: 'Markdown' };
    if ((i + maxLength) >= text.length && replyMarkup) payload.reply_markup = replyMarkup;
    try {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, payload);
    } catch (e) {
      delete payload.parse_mode;
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, payload);
    }
  }
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
