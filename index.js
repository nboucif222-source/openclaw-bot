require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3000;

// تحميل مهارة الإشراف (Skill) إن وجدت
let supervisorSkill = '';
try {
  const skillPath = path.join(__dirname, 'skills', 'supervisor.md');
  if (fs.existsSync(skillPath)) {
    supervisorSkill = fs.readFileSync(skillPath, 'utf8');
  }
} catch (err) {
  console.warn('No skill file loaded, using default prompt.');
}

const SYSTEM_PROMPT = `
أنت OpenClaw، الوكيل المشرف الذكي (Supervisor AI).
أسلوبك: عملي، دقيق، ومباشر بدون حشو.
${supervisorSkill}
`.trim();

// قائمة مزودي الذكاء الاصطناعي المجانيين بالترتيب (Primary -> Fallbacks)
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

// دالة الاتصال الذكية مع التبديل التلقائي عند الفشل (Auto-Fallback)
async function askSupervisor(userMessage) {
  const errors = [];

  for (const provider of LLM_PROVIDERS) {
    if (!provider.key) continue;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // مهلة 25 ثانية كحد أقصى لكل مزود

    try {
      console.log(`[OpenClaw] Trying ${provider.name}...`);
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
        throw new Error(`HTTP ${response.status}: ${errText.slice(0, 120)}`);
      }

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;

      if (reply) {
        console.log(`[OpenClaw] Success via ${provider.name}`);
        return {
          provider: provider.name,
          model: provider.model,
          reply: reply.trim()
        };
      }
    } catch (error) {
      clearTimeout(timeout);
      console.error(`[OpenClaw] ${provider.name} failed:`, error.message);
      errors.push(`${provider.name}: ${error.message}`);
    }
  }

  throw new Error(`All LLM providers failed. Details: ${errors.join(' | ')}`);
}

// 1. مسار الفحص الصحي لـ Render (يمنع توقف الخدمة)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    agent: 'OpenClaw Supervisor',
    providers_configured: LLM_PROVIDERS.filter(p => Boolean(p.key)).map(p => p.name)
  });
});

// 2. مسار المحادثة وتنفيذ الأوامر
app.post('/chat', async (req, res) => {
  try {
    const message = req.body?.message;
    if (!message) {
      return res.status(400).json({ error: 'يرجى إرسال حقل message في الطلب.' });
    }

    const result = await askSupervisor(message);
    res.status(200).json({
      status: 'success',
      ...result
    });
  } catch (err) {
    res.status(502).json({
      status: 'error',
      message: err.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 OpenClaw Supervisor is running on port ${PORT}`);
});
