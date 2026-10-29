import os
import logging
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, filters

# إعداد السجلات
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

# رقم الـ Chat ID الخاص بك حصرياً
MY_ALLOWED_CHAT_ID = 1824869362

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    
    # التحقق من أن المرسل هو أنت حصرياً
    if chat_id != MY_ALLOWED_CHAT_ID:
        logging.warning(f"Unauthorized access attempt from Chat ID: {chat_id}")
        return # يتجاهل الرسالة تماماً كأن البوت غير موجود بالنسبة لغيرك

    user_message = update.message.text
    logging.info(f"Received message from authorized user: {user_message}")
    
    # الرد المخصص لك
    response_text = f"🤖 أهلاً بك يا رئيس! تلقيت أمرك وسأبدأ تنفيذه فوراً:\n\n> {user_message}"
    
    await update.message.reply_text(response_text)

def main():
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        logging.error("TELEGRAM_BOT_TOKEN is not set!")
        return

    application = ApplicationBuilder().token(token).build()

    application.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_message))

    logging.info("Secure Master Agent is starting...")
    application.run_polling()

if __name__ == '__main__':
    main()
