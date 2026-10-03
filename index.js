const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());

// 1. تهيئة مفاتيح البيئة
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// 2. مسار الصفحة الرئيسية لخدمة UptimeRobot
app.get('/', (req, res) => {
  res.status(200).send('OpenClaw Bot is Live and Ready!');
});

// 3. مسار استلام تحديثات تليجرام (Webhook)
app.post('/', async (req, res) => {
  // الرد المباشر بـ 200 OK لتأكيد الاستلام لتليجرام
  res.sendStatus(200);

  try {
    const message = req.body?.message;
    if (!message) return;

    const chatId = message.chat.id;
    const userText = message.text || message.caption || '';
    const photos = message.photo;

    let responseText = '';

    // أ) في حال إرسال صورة
    if (photos && photos.length > 0) {
      const highestResPhoto = photos[photos.length - 1];
      const fileBase64 = await getBase64FromTelegramFile(highestResPhoto.file_id);

      if (fileBase64) {
        const imagePart = {
          inlineData: {
            data: fileBase64.data,
            mimeType: fileBase64.mimeType
          }
        };
        const prompt = userText || 'اشرح لي هذه الصورة بالتفصيل.';
        const result = await model.generateContent([prompt, imagePart]);
        responseText = result.response.text();
      } else {
        responseText = 'حدث خطأ أثناء تعذّر تحميل الصورة من تليجرام.';
      }
    } 
    // ب) في حال إرسال نص فقط
    else if (userText) {
      const result = await model.generateContent(userText);
      responseText = result.response.text();
    }

    // إرسال الرد إلى مستخدم تليجرام
    if (responseText) {
      await sendTelegramMessage(chatId, responseText);
    }
  } catch (error) {
    console.error('CRITICAL ERROR:', error.message || error);
  }
});

// دالة جلب الصورة وتحويلها إلى Base64
async function getBase64FromTelegramFile(fileId) {
  try {
    const fileRes = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
    const filePath = fileRes.data?.result?.file_path;
    if (!filePath) return null;

    const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
    const imageResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
    const base64Data = Buffer.from(imageResponse.data).toString('base64');

    let mimeType = 'image/jpeg';
    if (filePath.endsWith('.png')) mimeType = 'image/png';
    if (filePath.endsWith('.webp')) mimeType = 'image/webp';

    return { data: base64Data, mimeType };
  } catch (err) {
    console.error('File Download Error:', err.message);
    return null;
  }
}

// دالة إرسال الرسائل عبر تليجرام
async function sendTelegramMessage(chatId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });
  } catch (err) {
    // إعادة محاولة الإرسال بدون تنسيق Markdown في حال وجود رموز خاصة تسببت بخلل
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: text
    }).catch(e => console.error('Send Message Failed:', e.message));
  }
}

// تشغيل الخادم
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
