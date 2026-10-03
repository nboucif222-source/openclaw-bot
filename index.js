const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

// الاتصال بقاعدة البيانات للذاكرة الدائمة
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Memory Database'))
    .catch(err => console.error('MongoDB Connection Error:', err));
}

// schema الذاكرة الدائمة
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

// التوجيهات الفائقة (System Instruction) لجعل البوت متفوقاً على كافة النماذج
const SYSTEM_INSTRUCTION = `
أنت النواة الذكية الفائقة "OpenClaw Ultra AI Agent" - نظام ذكاء اصطناعي سيادي مستمر التعلم، مصمم لتجاوز قدرات Claude وOpenAI Agents.

تتكون بنيتك المعرفية من عدة محركات خبرة متخصصة:

1. خبير صناعة المحتوى والفيديو (Content & Video Strategist):
   - صياغة سيناريوهات الفيديوهات القصيرة (Reels/TikTok) والطويلة (YouTube) بتقسيم دقيق (Visuals, Audio, Hook, CTA).
   - توليد أوامر فائقة الدقة (Master Prompts) لأدوات توليد الفيديو والصور الذكية (Midjourney, Runway, Luma, Higgsfield, Flux).

2. خبير التجارة الإلكترونية واكتشاف المنتجات (E-Commerce & Winning Products Hunter):
   - تحليل متاجر المنافسين واستخراج نقاط القوة والضعف.
   - هندسة الإعلانات، كسر اعتراضات العملاء، وصياغة نصوص تسويقية عالية التحويل (High-Converting Copywriting).

3. خبير برمجيات SaaS والمشاريع الرقمية (SaaS & Micro-SaaS Architect):
   - تخطيط مشاريع SaaS، اختيار الهيكلية البرمجية (Tech Stack)، وتحديد نماذج الاشتراكات والتسعير.

4. خبير الأسواق المالية والتداول (Trading & Financial Markets Specialist):
   - تحليل الرسوم البيانية (Charts) المرفقة بالصور وفك شفرات المؤشرات الفنية، وإدارة المخاطر في الفوركس والأسهم.

5. خبير البرمجة والحلول التقنية (Senior Software Engineer):
   - كتابة الكود النظيف، تصحيح الأخطاء (Debugging)، وتصميم حلول الويب والتطبيقات مع أفضل الممارسات.

قواعد العمل الأساسية:
- الإجابة تكون عميقة، مباشرة، غنية بالتفاصيل والخطوات العملية العملية.
- استخدم الذاكرة الدائمة المتاحة والبحث الحي بذكاء لتقديم أدق تحليل ممكن.
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
  res.send('OpenClaw Ultimate Super AI Agent is Active!');
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

    // 1. مسح الذاكرة /clear
    if (userText === '/clear') {
      if (MONGODB_URI) await UserMemory.deleteOne({ chatId });
      await sendTelegramMessage(chatId, "🧹 تم مسح الذاكرة بالكامل! بدأنا جلسة تحليل جديدة.", MAIN_KEYBOARD);
      return;
    }

    // 2. أمر البداية /start
    if (userText === '/start') {
      const welcomeMsg = "🔥 **أهلاً بك في OpenClaw Super-Agent!**\n\n" +
                         "مساعدك الفائق المخصص للسيطرة على كافة المجالات:\n\n" +
                         "🛒 **التجارة الإلكترونية:** تحليل المنتجات الرابحة والمنافسين\n" +
                         "🎬 **صناعة المحتوى:** سيناريوهات فيديو وأوامر AI توليدية\n" +
                         "💻 **SaaS والبرمجة:** هندسة المشاريع وبناء التطبيقات\n" +
                         "📈 **التداول والمال:** قراءة الشارتات والتحليل الفني\n" +
                         "🖼️ **الصور والملفات:** معالجة وتحليل الشاشات والـ PDF\n\n" +
                         "أرسل سؤالك، صورتك، أو ملفك مباشرة للتنفيد!";
      await sendTelegramMessage(chatId, welcomeMsg, MAIN_KEYBOARD);
      return;
    }

    // 3. أمر توليد الصور /image
    if (userText.startsWith('/image')) {
      const prompt = userText.replace('/image', '').trim();
      if (!prompt) {
        await sendTelegramMessage(chatId, "⚠️ يرجى كتابة وصف التصميم المطلوب بعد الأمر `/image`.");
        return;
      }
      await sendTelegramMessage(chatId, "🎨 جاري إنشاء الصورة والتصميم بأعلى دقة...");
      await generateAndSendImage(chatId, prompt);
      return;
    }

    // جلب الذاكرة الدائمة
    let history = [];
    if (MONGODB_URI) {
      const userRecord = await UserMemory.findOne({ chatId });
      if (userRecord) history = userRecord.history;
    }

    let currentParts = [];
    if (userText) currentParts.push({ text: userText });

    // معالجة الصور (Vision)
    if (message.photo) {
      const photo = message.photo[message.photo.length - 1];
      const fileData = await getTelegramFileBase64(photo.file_id);
      if (fileData) {
        currentParts.push({
          inlineData: { mimeType: "image/jpeg", data: fileData }
        });
        if (!userText) currentParts.push({ text: "قم بتحليل هذه الصورة/الشارت بأسلوب خبير واستخرج كافة التفاصيل منه." });
      }
    }

    // معالجة الملفات والـ PDF
    if (message.document) {
      const doc = message.document;
      const fileData = await getTelegramFileBase64(doc.file_id);
      if (fileData) {
        currentParts.push({
          inlineData: { mimeType: doc.mime_type || "application/pdf", data: fileData }
        });
        if (!userText) currentParts.push({ text: "قم بتحليل هذا المستند واستخراج ملخص تنفيذي دقيق منه." });
      }
    }

    if (currentParts.length === 0) return;

    history.push({ role: 'user', parts: currentParts });
    if (history.length > 20) history = history.slice(-20);

    const geminiPayload = {
      contents: [
        { role: 'user', parts: [{ text: `[SYSTEM INSTRUCTION]: ${SYSTEM_INSTRUCTION}` }] },
        { role: 'model', parts: [{ text: "فهمت النطاق الكامل. أنا جاهز كمساعد فائق لمعالجة كافة الطلبات والتحليلات." }] },
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
      console.log('Error in primary request, attempting fallback...');
      delete geminiPayload.tools;
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const fallbackResponse = await axios.post(fallbackUrl, geminiPayload);
      aiReply = fallbackResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    if (!aiReply) {
      aiReply = "عذراً، حدث ضغط على النظام. يرجى إعادة إرسال طلبك.";
    } else {
      history.push({ role: 'model', parts: [{ text: aiReply }] });
      if (MONGODB_URI) {
        await UserMemory.findOneAndUpdate({ chatId }, { chatId, history }, { upsert: true, new: true });
      }
    }

    await sendTelegramMessage(chatId, aiReply, MAIN_KEYBOARD);

  } catch (error) {
    console.error('Webhook Error:', error.message);
  }
});

// معالجة الأزرار التفاعلية
async function handleCallbackQuery(query) {
  const chatId = String(query.message.chat.id);
  const data = query.data;

  await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: query.id });

  if (data === "btn_ecom") {
    await sendTelegramMessage(chatId, "🛒 **قسم التجارة الإلكترونية:**\nأرسل اسم منتج أو رابط متجر منافس للحصول على دراسة كاملة واستراتيجية إعلانات رابحة!");
  } else if (data === "btn_video") {
    await sendTelegramMessage(chatId, "🎬 **صناعة المحتوى والفيديو:**\nاكتب فكرة الفيديو وسأقوم بصياغة سيناريو احترافي + Prompts لأدوات الفيديوهات الذكية!");
  } else if (data === "btn_trading") {
    await sendTelegramMessage(chatId, "📈 **قسم التداول:**\nأرسل لقطة شاشة (Screenshot) للشارت الفني لمعاينته وتحليله فوراً!");
  } else if (data === "btn_saas") {
    await sendTelegramMessage(chatId, "💻 **قسم SaaS والبرمجة:**\nاكتب فكرة مشروعك السحابي أو المشكلة البرمجية للحصول على حل تقني متكامل!");
  } else if (data === "btn_img_gen") {
    await sendTelegramMessage(chatId, "🎨 **توليد الصور والتصاميم:**\nاكتب الأمر `/image` متبوعاً بالوصف، مثال:\n`/image تصميم إعلان احترافي لمنتج عطر زجاجي فخم`");
  } else if (data === "btn_clear") {
    if (MONGODB_URI) await UserMemory.deleteOne({ chatId });
    await sendTelegramMessage(chatId, "🧹 تم مسح الذاكرة بالكامل!", MAIN_KEYBOARD);
  }
}

// جلب الصور والملفات وتحويلها Base64
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

// توليد الصور وإرسالها
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

// إرسال الرسائل مجزأة مع Markdown
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
