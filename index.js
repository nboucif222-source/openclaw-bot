const { Telegraf } = require('telegraf');
const { GoogleGenAI } = require('@google/genai');

// قراءة المتغيرات البيئية من Render
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// رقم الـ Chat ID الخاص بك حصرياً للحماية
const ALLOWED_CHAT_ID = 1824869362;

bot.on('text', async (ctx) => {
    const chatId = ctx.chat.id;

    // التحقق الأمني: تجاهل أي شخص غيرك
    if (chatId !== ALLOWED_CHAT_ID) {
        console.log(`Unauthorized access attempt from: ${chatId}`);
        return;
    }

    const userMessage = ctx.message.text;
    console.log(`Received message from owner: ${userMessage}`);

    try {
        // إرسال الرسالة إلى نموذج Gemini (استخدام gemini-2.5-flash أو حسب المتاح لديك)
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userMessage,
            config: {
                systemInstruction: "أنت مساعد ذكي ومستقل (Master Agent) تعمل كمرشد ومستشار شخصي لإدارة المشاريع وتحليل الأسواق والنيشات، وخاصة السوق الجزائري."
            }
        });

        const replyText = response.text || "عذراً، لم أستطع توليد إجابة.";
        await ctx.reply(replyText);

    } catch (error) {
        console.error("Error communicating with Gemini API:", error);
        await ctx.reply("حدث خطأ أثناء معالجة طلبك عبر الذكاء الاصطناعي.");
    }
});

// بدء تشغيل البوت
bot.launch();
console.log('OpenClaw Node.js Bot with Gemini is running...');

// إيقاف آمن
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
