import asyncio
import json
import logging
import os
import random
from aiohttp import web
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import CommandStart
from aiogram.types import (
    InlineKeyboardMarkup, 
    InlineKeyboardButton, 
    WebAppInfo,
    ReplyKeyboardMarkup,
    KeyboardButton
)
from config import BOT_TOKEN, WEBAPP_URL, ADMIN_ID

logging.basicConfig(level=logging.INFO)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

def get_main_keyboard():
    kb = ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(
                    text="🛍️ Открыть магазин (Mini App)", 
                    web_app=WebAppInfo(url=WEBAPP_URL)
                )
            ],
            [
                KeyboardButton(text="💼 Заказать разработку"),
                KeyboardButton(text="ℹ️ О проекте")
            ]
        ],
        resize_keyboard=True
    )
    return kb

@dp.message(CommandStart())
async def handle_start(message: types.Message):
    user_name = message.from_user.first_name if message.from_user else "друг"
    welcome_text = (
        f"👋 *Здравствуйте, {user_name}!* \n\n"
        "Добро пожаловать в демонстрационный интернет-магазин нового поколения на базе *Telegram Mini App*.\n\n"
        "✨ *Преимущества формата:*\n"
        "• Мгновенно открывается внутри Telegram\n"
        "• Не нужно ничего скачивать из App Store / Google Play\n"
        "• Плавный адаптивный интерфейс с корзиной и выбором доставки\n"
        "• Онлайн-оплата картами и через СБП (ЮKassa)\n\n"
        "👇 *Нажмите кнопку ниже, чтобы открыть приложение:* "
    )
    await message.answer(
        welcome_text, 
        reply_markup=get_main_keyboard(),
        parse_mode="Markdown"
    )

@dp.message(F.text == "💼 Заказать разработку")
async def handle_order_dev(message: types.Message):
    info_text = (
        "💼 *Разработка Telegram Mini App под ключ:*\n\n"
        "Разрабатываем современные интерактивные боты и веб-приложения для вашего бизнеса:\n"
        "— Каталоги товаров и услуг\n"
        "— Доставка еды и бронирование\n"
        "— Личные кабинеты клиентов\n"
        "— Прием платежей (ЮKassa / СБП)\n"
        "— Синхронизация с CRM и Google Таблицами\n\n"
        "⏱ *Срок реализации:* 3–7 дней\n"
        "💰 *Стоимость:* от 25 000 руб.\n\n"
        "Для обсуждения проекта напишите разработчику в личные сообщения!"
    )
    await message.answer(info_text, parse_mode="Markdown")

@dp.message(F.text == "ℹ️ О проекте")
async def handle_about(message: types.Message):
    about_text = (
        "ℹ️ *О демонстрационном стенде:*\n\n"
        "Этот проект демонстрирует связку:\n"
        "1. *Frontend:* React 19 + TypeScript + Tailwind CSS (Telegram WebApp SDK)\n"
        "2. *Backend:* Python (Aiogram 3 Async Framework)\n"
        "3. *Оплата:* Интеграция с официальным шлюзом ЮKassa\n\n"
        "Нажмите кнопку *«🛍️ Открыть магазин (Mini App)»* внизу экрана, чтобы протестировать оформление заказа."
    )
    await message.answer(about_text, parse_mode="Markdown")

@dp.callback_query(F.data == "business_info")
async def handle_callback_business(callback: types.CallbackQuery):
    await callback.answer()
    if callback.message:
        await handle_order_dev(callback.message)

@dp.message(F.content_type == types.ContentType.WEB_APP_DATA)
async def handle_webapp_data(message: types.Message):
    raw_data = message.web_app_data.data
    try:
        data = json.loads(raw_data)
        order_num = random.randint(1000, 9999)

        items_text = ""
        for i, item in enumerate(data.get("items", []), 1):
            items_text += f"{i}. {item['name']} × {item['quantity']} шт. — {item['price'] * item['quantity']} ₽\n"

        payment_str = "Оплата онлайн (ЮKassa / СБП)" if data.get("paymentMethod") == "online" else "Оплата при получении"

        receipt_text = (
            f"🎉 *Ваш заказ #A-{order_num} успешно оформлен!*\n\n"
            f"📋 *Состав заказа:*\n{items_text}\n"
            f"💵 *Итого к оплате:* {data.get('totalPrice', 0)} ₽\n"
            f"💳 *Способ оплаты:* {payment_str}\n\n"
            f"👤 *Получатель:* {data.get('customerName')}\n"
            f"📞 *Телефон:* {data.get('phone')}\n"
            f"📍 *Адрес доставки:* {data.get('address')}\n"
        )
        if data.get("comment"):
            receipt_text += f"💬 *Комментарий:* {data.get('comment')}\n"

        receipt_text += "\n⏱ *Ориентировочное время доставки:* 35–45 минут."
        await message.answer(receipt_text, parse_mode="Markdown")

    except Exception as e:
        logging.error(f"Error parsing web_app_data: {e}")
        await message.answer(f"✅ Заказ принят! Данные: {raw_data}")

# Web Health Check server for Cloud hosting (Render / Koyeb / Railway)
async def health_check(request):
    return web.Response(text="Bot is running 24/7!", status=200)

async def start_web_server():
    app = web.Application()
    app.router.add_get("/", health_check)
    app.router.add_get("/health", health_check)
    
    port = int(os.getenv("PORT", 8080))
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logging.info(f"Web health-check server started on port {port}")

async def main():
    logging.info("🤖 Starting Telegram Bot...")
    # Start web server for cloud host
    await start_web_server()
    # Start bot polling
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logging.info("Bot stopped.")
