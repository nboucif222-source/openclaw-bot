const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ذاكرة المؤقتة للمحادثات
const memoryStore = {};

const SYSTEM_INSTRUCTION = "أنت مساعد ذكي ومتخصص في تحليل النصوص والصور بدقة عالية.";

// دالة إرسال الرسائل لتليجرام
async function sendTelegramMessage(chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });
  } catch (err) {
    console.error('Telegram Send Error:', err?.response?.data || err.message);
  }
}

// دالة جلب رابط الصورة من تليجرام وتحويلها إلى Base64
async function getBase64FromTelegramFile(fileId) {
  try {
    const fileRes = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
    const filePath = fileRes.data?.result?.file_path;
    if (!filePath) return null;

    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
    const imageRes = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const base64Data = Buffer.from(imageRes.data, 'binary').toString('base64');
    
    // تحديد نوع الصورة الممدود (mimeType)
    let mimeType = 'image/jpeg';
    if (filePath.endsWith('.png')) mimeType = 'image/png';
    if (filePath.endsWith('.webp')) mimeType = 'image/webp';

    return { base64Data, mimeType };
  } catch (err) {
    console.error('File Download Error:', err.message);
    return null;
  }
}

// الويب هوك الخاص بتلقي التحديثات من تليجرام
app.post('/', async (req, res) => {
  res.sendStatus(200); // الرد السريع على تليجرام لتجنب المهلة

  try {
    const message = req.body?.message;
    if (!message) return;

    const chatId = message.chat?.id;
    const userText = message.text || message.caption || "";
    const photoArray = message.photo;

    if (!chatId) return;

    let currentParts = [];

    // معالجة النص إذا وجد
    if (userText) {
      currentParts.push({ text: userText });
    }

    // معالجة الصورة إذا وجدت
    if (photoArray && photoArray.length > 0) {
      const largestPhoto = photoArray[photoArray.length - 1]; // اختيار أعلى جودة
      const imageData = await getBase64FromTelegramFile(largestPhoto.file_id);
      
      if (imageData) {
        currentParts.push({
          inlineData: {
            mimeType: imageData.mimeType,
            data: imageData.base64Data
          }
        });
      }
    }

    if (currentParts.length === 0) return;

    // إدارة ذاكرة المحادثة لكل شات
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
    // النماذج المتاحة بالتتابع لتفادي أي إيقاف أو ضغط
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

    for (const modelName of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await axios.post(geminiUrl, geminiPayload);
        aiReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiReply) break; // نجاح الاتصال
      } catch (err) {
        console.log(`Model ${modelName} failed or busy, trying next...`);
      }
    }

    if (!aiReply) {
      aiReply = "عذراً، حدث خطأ أثناء معالجة الصورة أو النص. يرجى المحاولة مرة أخرى لاحقاً.";
    }

    // حفظ الإجابة في الذاكرة وإرسالها للمستخدم
    if (aiReply) {
      history.push({ role: 'user', parts: currentParts });
      history.push({ role: 'model', parts: [{ text: aiReply }] });
      
      // الحفاظ على آخر 10 رسائل فقط للذاكرة
      if (history.length > 10) history = history.slice(-10);
      memoryStore[chatId] = history;

      await sendTelegramMessage(chatId, aiReply);
    }

  } catch (error) {
    console.error('General Webhook Error:', error.message);
  }
});

app.get('/', (req, res) => {
  res.send('OpenClaw Bot is Live and Ready!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
