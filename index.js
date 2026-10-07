const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);
const OPENROUTER_API_KEY = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY;

bot.start((ctx) => ctx.reply('مرحباً بك! أنا بوت ذكاء اصطناعي يعمل عبر OpenRouter. كيف يمكنني مساعدتك اليوم؟'));

bot.on('text', async (ctx) => {
    try {
        await ctx.sendChatAction('typing');
        
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'google/gemini-2.0-flash-exp:free', // يمكنك تغيير النموذج إذا أردت
                messages: [
                    {
                        role: 'system',
                        content: 'أنت مساعد ذكي ومفيد تتحدث باللغة العربية بأسلوب واضح ومباشر.'
                    },
                    {
                        role: 'user',
                        content: ctx.message.text
                    }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const replyMessage = response.data.choices[0].message.content;
        await ctx.reply(replyMessage);

    } catch (error) {
        console.error('Error with OpenRouter API:', error?.response?.data || error.message);
        await ctx.reply('عذراً، حدث خطأ أثناء معالجة الطلب. يرجى المحاولة لاحقاً.');
    }
});

bot.launch();
console.log('Bot is running with OpenRouter...');
