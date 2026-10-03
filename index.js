const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json({ limit: '50mb' }));

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const memoryStore = {};

const SYSTEM_INSTRUCTION = `
أنت المساعد الذكي الفائق "OpenClaw Ultra AI Agent".
مهامك:
1. الإجابة الفورية والتحليل الدقيق لكافة الأسئلة والنصوص والصور الواردة من المستخدم دون الحاجة لضغط أي أزرار.
2. عند استقبال صورة (شارت تداول، واجهة Binance، تصميم، أو مستند)، قم بتحليلها فوراً وإعطاء تفاصيل وشرح شامل ومفيد للمستخدم.
3. كن ودوداً، محترفاً، وإجاباتك واضحة ومنسقة باستعمال Markdown.
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

app.all('*', async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');
  res.status(200).send('OK');

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
      await sendTelegramMessage(chatId, "🧹 تم مسح الذاكرة المؤقتة بالكامل!");
      return;
    }

    if (userText === '/start') {
      const welcomeMsg = "🔥 **أهلاً بك في OpenClaw Super-Agent!**\n\n" +
                         "أنا جاهز لإجابة جميع أسئلتك وتحليل أي صورة أو شارت ترسله لي فوراً!";
      await sendTelegramMessage(chatId, welcomeMsg, MAIN_KEYBOARD);
      return;
    }

    if (userText.startsWith('/image')) {
      const prompt = userText.replace('/image', '').trim();
      if (!prompt) {
        await sendTelegramMessage(chatId, "⚠️ يرجى كتابة وصف التصميم بعد `/image`.");
        return;
      }
      await sendTelegramMessage(chatId, "🎨 جاري إنشاء التصميم...");
      await generateAndSendImage(chatId, prompt);
      return;
    }

    let currentParts = [];

    // معالجة الصور المرسلة من المستخدم (شارتات، Binance، إلخ)
    if (message.photo) {
      const photo = message.photo[message.photo.length - 1];
      const fileData = await getTelegramFileBase64(photo.file_id);
      if (fileData) {
        currentParts.push({
          inline_data: {
            mime_type: "image/jpeg",
            data: fileData
          }
        });
        const promptText = userText || (message.caption ? message.caption : "قم بتحليل هذه الصورة/الشارت الصادرة عن تطبيق التداول أو العملات واشرح المحتوى بوضوح.");
        currentParts.push({ text: promptText });
      }
    } else if (userText) {
      currentParts.push({ text: userText });
    }

    if (currentParts.length === 0) return;

    if (!memoryStore[chatId]) memoryStore[chatId] = [];
    let history = memoryStore[chatId];

    const geminiPayload = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: [
        ...history,
        { role: 'user', parts: currentParts }
      ]
    };

    let aiReply = "";
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const response = await axios.post(geminiUrl, geminiPayload);
      aiReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (apiError) {
      console.error('Gemini API Error:', apiError?.response?.data || apiError.message);
      aiReply = "⚠️️ حدث خطأ أثناء تحليل الصورة/الطلب، الرجاء إعادة المحاولة بنفس الصورة أو التأكد من سلامة المفتاح GEMINI_API_KEY.";
    }

    if (aiReply) {
      history.push({ role: 'user', parts: currentParts });
      history.push({ role: 'model', parts: [{ text: aiReply }] });
      if (history.length > 10) history = history.slice(-10);
      memoryStore[chatId] = history;

      await sendTelegramMessage(chatId, aiReply);
    }

  } catch (error) {
    console.error('General Error:', error.message);
  }
});

async function handleCallbackQuery(query) {
  const chatId = String(query.message.chat.id);
  const data = query.data;

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: query.id });
  } catch (e) {}

  if (data === "btn_ecom") {
    await sendTelegramMessage(chatId, "🛒 **قسم التجارة الإلكترونية:**\nأرسل سؤالك أو اسم منتجك فوراً.");
  } else if (data === "btn_video") {
    await sendTelegramMessage(chatId, "🎬 **صناعة المحتوى:**\nاكتب فكرة الفيديو وسأصيغ السيناريو.");
  } else if (data === "btn_trading") {
    await sendTelegramMessage(chatId, "📈 **قسم التداول:**\nأرسل لي لقطة الشاشة (Binance / TradingView) وسأقوم بتحليلها فوراً!");
  } else if (data === "btn_saas") {
    await sendTelegramMessage(chatId, "💻 **قسم SaaS والبرمجة:**\nاكتب مشكلتك أو استفسارك البرمجي.");
  } else if (data === "btn_img_gen") {
    await sendTelegramMessage(chatId, "🎨 **توليد الصور:**\nاكتب `/image` متبوعة بالوصف.");
  } else if (data === "btn_clear") {
    delete memoryStore[chatId];
    await sendTelegramMessage(chatId, "🧹 تم مسح الذاكرة!");
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
    console.error('Error fetching file from Telegram:', err.message);
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
