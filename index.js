require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // اختياري: لحصر البوت بحسابك فقط

// 1. قراءة ملف skills.md من جذر المستودع
let skillsContent = '';
try {
  const skillPath = path.join(__dirname, 'skills.md');
  if (fs.existsSync(skillPath)) {
    skillsContent = fs.readFileSync(skillPath, 'utf8');
  }
} catch (err) {
  console.warn('Could not load skills.md:', err.message);
}

const SYSTEM_PROMPT = `
أنت OpenClaw، الوكيل المشرف الذكي (Supervisor AI).
أسلوبك: عملي، دقيق، ومباشر باللغة العربية.
${skillsContent}
`.trim();

// 2. قائمة مزودي الذكاء الاصطناعي المجانيين (Primary -> Fallbacks)
const LLM_PROVIDERS = [
  {
    name: 'Google Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: process.env.GOOGLE_API_KEY,
    model: 'gemini-2.5-flash'
  },
  {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile'
  },
  {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: process.env.OPENROUTER_API_KEY,
    model: 'openrouter/free'
  }
];

// 3. محرك التفكير مع التبديل التلقائي عند الفشل
async function askSupervisor(userMessage) {
  const errors = [];

  for (const provider of LLM_PROVIDERS) {
    if (!provider.key) continue;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.key}`
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.3,
          max_tokens: 1024
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText.slice(0, 100)}`);
      }

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;

      if (reply) {
        return { provider: provider.name, reply: reply.trim() };
      }
    } catch (error) {
      clearTimeout(timeout);
      console.error(`[${provider.name}] failed:`, error.message);
      errors.push(`${provider.name}: ${error.message}`);
    }
  }

  throw new Error(`فشلت جميع النماذج: ${errors.join(' | ')}`);
}

// 4. دالة إرسال الرد إلى تيليغرام
async function sendTelegramMessage(chatId, text) {
  if (!TELEGRAM_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text
    })
  });
}

// 5. مسار استقبال رسائل تيليغرام (Telegram Webhook)
app.post('/telegram', async (req, res) => {
  // نرد بـ 200 فوراً لتيليغرام حتى لا يعيد إرسال الرسالة عند بطء الذكاء الاصطناعي
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message || !message.text) return;

  const chatId = String(message.chat.id);
  const userText = message.text;

  // حماية اختيارية: الرد على حسابك فقط إذا ضبطت TELEGRAM_CHAT_ID
  if (ALLOWED_CHAT_ID && chatId !== String(ALLOWED_CHAT_ID)) {
    return;
  }

  try {
    const result = await askSupervisor(userText);
    await sendTelegramMessage(chatId, `${result.reply}\n\n⚡ [${result.provider}]`);
  } catch (err) {
    await sendTelegramMessage(chatId, `⚠️ حدث خطأ أثناء المعالجة:\n${err.message}`);
  }
});

// 6. مسار الفحص الصحي لـ Render
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    agent: 'OpenClaw Supervisor',
    telegram_ready: Boolean(TELEGRAM_TOKEN),
    providers: LLM_PROVIDERS.filter(p => Boolean(p.key)).map(p => p.name)
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 OpenClaw Supervisor running on port ${PORT}`);
});
