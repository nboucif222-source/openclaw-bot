const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
// أضف رابط الـ Webhook الخاص بـ n8n هنا أو في متغيرات البيئة Render
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// الاتصال بقاعدة البيانات
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Memory Database'))
    .catch(err => console.error('MongoDB Connection Error:', err));
}

const MemorySchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  history: [
    {
      role: String,
      parts: Array,
      timestamp: { type: Date, default: Date.now }
    }
  ]
});

const UserMemory = mongoose.model('UserMemory', MemorySchema);

const SYSTEM_INSTRUCTION = `
أنت المساعد الذكي الفائق والشامل "OpenClaw AI".
تتحكم في أتمتة المهام عبر n8n، معالجة البيانات، التجارة الإلكترونية، تحليل الأسواق، وربط Google Sheets.
`;

const MAIN_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "⚡ تنفيذ عبر n8n", callback_data: "btn_n8n_info" },
      { text: "🛒 تحليل منتج", callback_data: "btn_ecom" }
    ],
    [
      { text: "🎨 توليد صورة إعلان", callback_data: "btn_image_help" },
      { text: "🧹 مسح الذاكرة", callback_data: "btn_clear" }
    ]
  ]
};

app.get('/', (req, res) => {
  res.send('OpenClaw + n8n Integration Bot is Active!');
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
      if (MONGODB_URI) await UserMemory.deleteOne({ chatId });
      await sendTelegramMessage(chatId, "🧹 تم مسح الذاكرة بالكامل!", MAIN_KEYBOARD);
      return;
    }

    if (userText === '/start') {
      const welcomeMsg = "🚀 أهلاً بك! البوت متصل بالكامل للتحكم في n8n، معالجة الصور، Google Sheets، وتحليل البيانات.\n\n" +
                         "▪️ لأرسال أمر أو صورة مباشرة إلى n8n، ابدأ رسالتك بـ `/n8n` أو قم بإرفاق الصورة وسيتم معالجتها ونقلها فوراً.";
      await sendTelegramMessage(chatId, welcomeMsg, MAIN_KEYBOARD);
      return;
    }

    // إذا كان الأمر مخصصاً للتحكم بـ n8n
    if (userText.startsWith('/n8n') || message.photo) {
      let photoUrl = null;

      if (message.photo) {
        const photo = message.photo[message.photo.length - 1];
        photoUrl = await getTelegramFileUrl(photo.file_id);
      }

      if (N8N_WEBHOOK_URL) {
        await sendTelegramMessage(chatId, "⏳ جاري إرسال البيانات إلى n8n وتحديث Google Sheets...");
        
        const n8nResponse = await triggerN8nWorkflow({
          chatId,
          text: userText.replace('/n8n', '').trim(),
          photoUrl: photoUrl,
          user: message.from
        });

        if (n8nResponse && n8nResponse.message) {
          await sendTelegramMessage(chatId, `✅ **رد n8n:**\n${n8nResponse.message}`, MAIN_KEYBOARD);
          return;
        }
      } else {
        await sendTelegramMessage(chatId, "⚠️ يرجى إضافة متغير البيئة `N8N_WEBHOOK_URL` في Render لربط سيرفر n8n الخاص بك.");
      }
    }

    // المعالجة العادية لـ Gemini
    let history = [];
    if (MONGODB_URI) {
      const userRecord = await UserMemory.findOne({ chatId });
      if (userRecord) history = userRecord.history;
    }

    let currentParts = [];
    if (userText) currentParts.push({ text: userText });

    if (message.photo) {
      const photo = message.photo[message.photo.length - 1];
      const fileData = await getTelegramFileBase64(photo.file_id);
      if (fileData) {
        currentParts.push({
          inlineData: { mimeType: "image/jpeg", data: fileData }
        });
        if (!userText) currentParts.push({ text: "قم بتحليل الصورة وإعداد بياناتها لإدخالها في جدول البيانات." });
      }
    }

    if (currentParts.length === 0) return;

    history.push({ role: 'user', parts: currentParts });
    if (history.length > 20) history = history.slice(-20);

    const geminiPayload = {
      contents: [
        { role: 'user', parts: [{ text: `[SYSTEM INSTRUCTION]: ${SYSTEM_INSTRUCTION}` }] },
        { role: 'model', parts: [{ text: "جاهز لتنفيذ الأوامر وتحليل الصور وإرسالها لـ n8n و Google Sheets." }] },
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
      if (MONGODB_URI) {
        await UserMemory.findOneAndUpdate({ chatId }, { chatId, history }, { upsert: true, new: true });
      }
      await sendTelegramMessage(chatId, aiReply, MAIN_KEYBOARD);
    }

  } catch (error) {
    console.error('Webhook Error:', error.message);
  }
});

// إرسال البيانات إلى سيرفر n8n
async function triggerN8nWorkflow(payload) {
  try {
    const res = await axios.post(N8N_WEBHOOK_URL, payload);
    return res.data;
  } catch (err) {
    console.error('Error triggering n8n:', err.message);
    return null;
  }
}

async function handleCallbackQuery(query) {
  const chatId = String(query.message.chat.id);
  const data = query.data;

  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: query.id });

  if (data === "btn_n8n_info") {
    await sendTelegramMessage(chatId, "⚡ **الربط مع n8n:**\nأرسل أياً من أمر البحث أو الصورة مسبوقة بـ `/n8n` ليتم تحويلها مباشرة إلى Workflow الخاص بك وإدراجها في Google Sheets.");
  } else if (data === "btn_clear") {
    if (MONGODB_URI) await UserMemory.deleteOne({ chatId });
    await sendTelegramMessage(chatId, "🧹 تم مسح الذاكرة!", MAIN_KEYBOARD);
  }
}

async function getTelegramFileUrl(fileId) {
  try {
    const fileRes = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
    const filePath = fileRes.data?.result?.file_path;
    return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
  } catch (err) {
    return null;
  }
}

async function getTelegramFileBase64(fileId) {
  try {
    const downloadUrl = await getTelegramFileUrl(fileId);
    const imageRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
    return Buffer.from(imageRes.data).toString('base64');
  } catch (err) {
    return null;
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
