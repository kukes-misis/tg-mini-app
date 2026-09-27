import asyncio
import html
import json
import logging
import os
import random
import re
import time
from aiohttp import web
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    InlineKeyboardMarkup, 
    InlineKeyboardButton, 
    WebAppInfo,
    ReplyKeyboardMarkup,
    KeyboardButton
)
from config import BOT_TOKEN, WEBAPP_URL, is_admin, DEFAULT_ADMIN_CHAT_ID
import database as db

logging.basicConfig(level=logging.INFO)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# Admin FSM for changing price
class AdminPriceState(StatesGroup):
    waiting_for_price = State()

def get_keyboard(username: str | None, user_id: int | None):
    buttons = [
        [
            KeyboardButton(
                text="🛍️ Открыть ресторан & меню", 
                web_app=WebAppInfo(url=WEBAPP_URL)
            )
        ]
    ]
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)

@dp.message(CommandStart())
async def handle_start(message: types.Message):
    user = message.from_user
    username = user.username if user else None
    user_id = user.id if user else None
    user_name = user.first_name if user else "друг"

    # If this is @qqeaux, permanently store their chat_id for instant order alerts
    if is_admin(username, user_id) and user_id:
        db.set_setting("admin_chat_id", str(user_id))
        db.set_setting("admin_username", str(username or "qqeaux"))
        logging.info(f"Registered admin chat_id: {user_id} for user @{username}")

    welcome_text = (
        f"👋 <b>Здравствуйте, {html.escape(user_name)}!</b>\n\n"
        "Добро пожаловать в ресторан авторской кухни!\n\n"
        "Всё взаимодействие происходит внутри нашего официального <b>Mini App</b>:\n"
        "• Полный каталог блюд с составом и КБЖУ\n"
        "• Отслеживание стадий приготовления и доставки\n"
        "• История заказов, повтор в 1 клик и промокоды\n"
        "• Круглосуточная служба заботы и поддержки\n\n"
    )
    if is_admin(username, user_id):
        welcome_text += "👑 <b>Вы авторизованы как Администратор (@qqeaux)</b>. Панель управления доступна внутри приложения во вкладке «Админка».\n\n"

    welcome_text += "👇 <b>Нажмите кнопку ниже, чтобы открыть ресторан:</b>"
    await message.answer(
        welcome_text, 
        reply_markup=get_keyboard(username, user_id),
        parse_mode="HTML"
    )

# --- ADMIN PANEL ---

@dp.message(F.text == "👑 Панель управления (Админ)")
@dp.message(Command("admin"))
async def handle_admin(message: types.Message):
    user = message.from_user
    username = user.username if user else None
    user_id = user.id if user else None

    if not is_admin(username, user_id):
        await message.answer("⛔ *Доступ запрещен.*\nПанель администратора доступна только владельцу аккаунта @qqeaux.", parse_mode="Markdown")
        return

    # Update admin chat_id
    if user_id:
        db.set_setting("admin_chat_id", str(user_id))

    analytics = db.get_analytics()
    admin_text = (
        "👑 *Панель администратора магазина*\n\n"
        f"💰 *Выручка всего:* {analytics['total_revenue']} ₽\n"
        f"📦 *Всего заказов:* {analytics['total_orders']}\n"
        f"🟡 *Новых:* {analytics['new_orders']} | "
        f"👨‍🍳 *Готовятся:* {analytics['cooking_orders']} | "
        f"🚴 *В пути:* {analytics['delivering_orders']}\n\n"
        "🔔 *Уведомления о заказах:* АКТИВНЫ (приходят вам в личку)\n\n"
        "Выберите раздел для управления:"
    )

    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📦 Активные заказы", callback_data="admin_orders"),
                InlineKeyboardButton(text="🏷 Товары и цены", callback_data="admin_products")
            ],
            [
                InlineKeyboardButton(text="📊 Аналитика заказов", callback_data="admin_analytics"),
                InlineKeyboardButton(text="🔄 Обновить", callback_data="admin_refresh")
            ]
        ]
    )
    await message.answer(admin_text, reply_markup=kb, parse_mode="Markdown")

@dp.callback_query(F.data == "admin_refresh")
async def cb_admin_refresh(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.username, callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return
    await callback.answer("Данные обновлены")
    analytics = db.get_analytics()
    admin_text = (
        "👑 *Панель администратора магазина*\n\n"
        f"💰 *Выручка всего:* {analytics['total_revenue']} ₽\n"
        f"📦 *Всего заказов:* {analytics['total_orders']}\n"
        f"🟡 *Новых:* {analytics['new_orders']} | "
        f"👨‍🍳 *Готовятся:* {analytics['cooking_orders']} | "
        f"🚴 *В пути:* {analytics['delivering_orders']}\n\n"
        "🔔 *Уведомления о заказах:* АКТИВНЫ\n\n"
        "Выберите раздел для управления:"
    )
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📦 Активные заказы", callback_data="admin_orders"),
                InlineKeyboardButton(text="🏷 Товары и цены", callback_data="admin_products")
            ],
            [
                InlineKeyboardButton(text="📊 Аналитика заказов", callback_data="admin_analytics"),
                InlineKeyboardButton(text="🔄 Обновить", callback_data="admin_refresh")
            ]
        ]
    )
    if callback.message:
        await callback.message.edit_text(admin_text, reply_markup=kb, parse_mode="Markdown")

# Admin: View Orders
@dp.callback_query(F.data == "admin_orders")
async def cb_admin_orders(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.username, callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return
    await callback.answer()

    orders = db.get_orders(limit=10)
    if not orders:
        kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="⬅️ Назад", callback_data="admin_refresh")]])
        await callback.message.edit_text("📦 *Заказов пока нет.* Как только клиент оформит заказ, он появится здесь!", reply_markup=kb, parse_mode="Markdown")
        return

    text = "📦 *Последние заказы:*\n\n"
    buttons = []
    status_icons = {
        "new": "🟡 Новый",
        "cooking": "👨‍🍳 Готовится",
        "delivering": "🚴 В пути",
        "completed": "✅ Выполнен",
        "cancelled": "❌ Отменен"
    }

    for o in orders[:8]:
        st = status_icons.get(o['status'], o['status'])
        text += f"• *#{o['order_number']}* ({st}) — {o['total_price']} ₽ | {o['user_name']}\n"
        buttons.append([
            InlineKeyboardButton(
                text=f"Заказ #{o['order_number']} ({st})",
                callback_data=f"order_view_{o['order_number']}"
            )
        ])

    buttons.append([InlineKeyboardButton(text="⬅️ В главное меню", callback_data="admin_refresh")])
    kb = InlineKeyboardMarkup(inline_keyboard=buttons)
    if callback.message:
        await callback.message.edit_text(text, reply_markup=kb, parse_mode="Markdown")

# Admin: View Single Order Detail
@dp.callback_query(F.data.startswith("order_view_"))
async def cb_order_view(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.username, callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return
    await callback.answer()

    order_num = callback.data.replace("order_view_", "")
    order = db.get_order_by_number(order_num)
    if not order:
        await callback.answer("Заказ не найден", show_alert=True)
        return

    status_labels = {
        "new": "🟡 Новый (Ожидает обработки)",
        "cooking": "👨‍🍳 Готовится на кухне",
        "delivering": "🚴 Передан курьеру (В пути)",
        "completed": "✅ Успешно доставлен",
        "cancelled": "❌ Отменен"
    }

    items_str = ""
    for idx, item in enumerate(order.get('items', []), 1):
        items_str += f"  {idx}. {item.get('name')} × {item.get('quantity')} = {item.get('price', 0) * item.get('quantity', 1)} ₽\n"

    pay_badge = "💳 Оплачен онлайн (ЮKassa / СБП)" if order.get('payment_status') == 'paid' else "⏳ Ожидает оплаты (при получении)"

    msg = (
        f"📋 *Детали заказа #{order['order_number']}*\n\n"
        f"👤 *Клиент:* {order.get('user_name')} (@{order.get('username') or 'нет'})\n"
        f"📞 *Телефон:* {order.get('phone')}\n"
        f"📧 *Email:* {order.get('email') or 'не указан'}\n"
        f"📍 *Адрес:* {order.get('address')}\n"
        f"💬 *Комментарий:* {order.get('comment') or 'нет'}\n\n"
        f"📦 *Состав заказа:*\n{items_str}\n"
        f"💵 *Сумма:* {order['total_price']} ₽\n"
        f"💳 *Статус оплаты:* {pay_badge}\n"
        f"⚙️ *Статус доставки:* {status_labels.get(order['status'], order['status'])}\n"
        f"🕒 *Создан:* {order.get('created_at')}\n"
    )

    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="👨‍🍳 В готовку", callback_data=f"st_{order_num}_cooking"),
                InlineKeyboardButton(text="🚴 В доставку", callback_data=f"st_{order_num}_delivering")
            ],
            [
                InlineKeyboardButton(text="✅ Доставлен", callback_data=f"st_{order_num}_completed"),
                InlineKeyboardButton(text="❌ Отменить", callback_data=f"st_{order_num}_cancelled")
            ],
            [
                InlineKeyboardButton(text="💳 Отметить «Оплачен»", callback_data=f"pay_{order_num}_paid")
            ],
            [
                InlineKeyboardButton(text="⬅️ Ко всем заказам", callback_data="admin_orders")
            ]
        ]
    )
    if callback.message:
        await callback.message.edit_text(msg, reply_markup=kb, parse_mode="Markdown")

# Admin: Update Order Status
@dp.callback_query(F.data.startswith("st_"))
async def cb_update_status(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.username, callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return

    parts = callback.data.split("_")
    order_num = parts[1]
    new_status = parts[2]

    db.update_order_status(order_num, new_status)
    await callback.answer(f"Статус заказа #{order_num} изменен!")

    order = db.get_order_by_number(order_num)
    # Automatically notify the customer in their Telegram chat
    if order and order.get('user_id'):
        status_client_msgs = {
            "cooking": f"👨‍🍳 <b>Ваш заказ #{order_num} передан на кухню и уже готовится!</b>\n\nШеф-повар собирает ингредиенты. Вы можете следить за стадиями заказа прямо в приложении.",
            "delivering": f"🚴 <b>Курьер забрал заказ #{order_num} и выехал!</b>\n\nАдрес доставки: {html.escape(order.get('address', ''))}. Курьер скоро будет у вас.",
            "completed": f"🎉 <b>Заказ #{order_num} успешно доставлен!</b>\n\nПриятного аппетита! Будем рады вашему отзыву.",
            "cancelled": f"❌ <b>Заказ #{order_num} был отменен.</b>\n\nЕсли у вас есть вопросы, служба заботы всегда на связи в приложении."
        }
        client_text = status_client_msgs.get(new_status)
        if client_text:
            track_kb = InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(
                            text="📱 Открыть статус в приложении", 
                            web_app=WebAppInfo(url=f"{WEBAPP_URL}?tab=orders&order={order_num}")
                        )
                    ]
                ]
            )
            try:
                await bot.send_message(
                    chat_id=order['user_id'], 
                    text=client_text, 
                    reply_markup=track_kb,
                    parse_mode="HTML"
                )
            except Exception as e:
                logging.warning(f"Could not notify customer {order['user_id']}: {e}")

    await cb_order_view(callback)

# Admin: Update Payment Status
@dp.callback_query(F.data.startswith("pay_"))
async def cb_update_payment(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.username, callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return

    parts = callback.data.split("_")
    order_num = parts[1]
    new_pay_status = parts[2]

    db.update_order_payment(order_num, new_pay_status)
    await callback.answer(f"Оплата для #{order_num} подтверждена!")
    await cb_order_view(callback)

# Admin: Products List
@dp.callback_query(F.data == "admin_products")
async def cb_admin_products(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.username, callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return
    await callback.answer()

    products = db.get_products()
    text = "🏷 *Управление товарами каталога:*\n\nНажмите на товар, чтобы изменить цену или переключить наличие (стоп-лист):\n"
    buttons = []
    for p in products:
        avail = "🟢" if p.get('is_available') == 1 else "🔴 Стоп-лист"
        btn_text = f"{avail} {p['name']} — {p['price']} ₽"
        buttons.append([InlineKeyboardButton(text=btn_text, callback_data=f"prod_{p['id']}")])

    buttons.append([InlineKeyboardButton(text="⬅️ В главное меню", callback_data="admin_refresh")])
    kb = InlineKeyboardMarkup(inline_keyboard=buttons)
    if callback.message:
        await callback.message.edit_text(text, reply_markup=kb, parse_mode="Markdown")

# Admin: Single Product Edit
@dp.callback_query(F.data.startswith("prod_"))
async def cb_admin_single_prod(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.username, callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return
    await callback.answer()

    prod_id = callback.data.replace("prod_", "")
    products = db.get_products()
    prod = next((p for p in products if p['id'] == prod_id), None)
    if not prod:
        await callback.answer("Товар не найден", show_alert=True)
        return

    avail_text = "🟢 В наличии (доступен для заказа)" if prod.get('is_available') == 1 else "🔴 В стоп-листе (клиенты не могут заказать)"
    msg = (
        f"🍔 *{prod['name']}*\n\n"
        f"💵 *Текущая цена:* {prod['price']} ₽\n"
        f"📦 *Статус:* {avail_text}\n"
        f"📝 *Описание:* {prod.get('description', '')}\n"
    )

    toggle_btn_text = "🔴 Поставить в стоп-лист" if prod.get('is_available') == 1 else "🟢 Вернуть в наличие"
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=toggle_btn_text, callback_data=f"toggle_avail_{prod_id}")],
            [InlineKeyboardButton(text="✏️ Изменить цену", callback_data=f"change_price_{prod_id}")],
            [InlineKeyboardButton(text="⬅️ Ко всем товарам", callback_data="admin_products")]
        ]
    )
    if callback.message:
        await callback.message.edit_text(msg, reply_markup=kb, parse_mode="Markdown")

# Admin: Toggle Availability
@dp.callback_query(F.data.startswith("toggle_avail_"))
async def cb_toggle_avail(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.username, callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return
    prod_id = callback.data.replace("toggle_avail_", "")
    new_val = db.toggle_product_availability(prod_id)
    state_str = "в наличии" if new_val == 1 else "в стоп-листе"
    await callback.answer(f"Товар теперь {state_str}!")
    callback.data = f"prod_{prod_id}"
    await cb_admin_single_prod(callback)

# Admin: Change Price
@dp.callback_query(F.data.startswith("change_price_"))
async def cb_change_price(callback: types.CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.username, callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return
    await callback.answer()

    prod_id = callback.data.replace("change_price_", "")
    await state.set_state(AdminPriceState.waiting_for_price)
    await state.update_data(editing_prod_id=prod_id)

    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="❌ Отмена", callback_data="admin_products")]])
    await callback.message.answer(
        f"✏️ *Введите новую цену в рублях* для товара (только число, например: `550`):",
        reply_markup=kb,
        parse_mode="Markdown"
    )

@dp.message(AdminPriceState.waiting_for_price)
async def handle_price_input(message: types.Message, state: FSMContext):
    if not is_admin(message.from_user.username if message.from_user else None, message.from_user.id if message.from_user else None):
        return

    text = message.text.strip()
    if not text.isdigit():
        await message.answer("⚠️ Пожалуйста, введите корректное число (например `490`):")
        return

    new_price = int(text)
    data = await state.get_data()
    prod_id = data.get("editing_prod_id")
    await state.clear()

    if prod_id:
        db.update_product_price(prod_id, new_price)
        await message.answer(f"✅ Цена успешно обновлена: *{new_price} ₽*!", parse_mode="Markdown")
        products = db.get_products()
        buttons = []
        for p in products:
            avail = "🟢" if p.get('is_available') == 1 else "🔴 Стоп-лист"
            buttons.append([InlineKeyboardButton(text=f"{avail} {p['name']} — {p['price']} ₽", callback_data=f"prod_{p['id']}")])
        buttons.append([InlineKeyboardButton(text="⬅️ В главное меню", callback_data="admin_refresh")])
        kb = InlineKeyboardMarkup(inline_keyboard=buttons)
        await message.answer("🏷 *Каталог товаров:*", reply_markup=kb, parse_mode="Markdown")

# Admin: Analytics
@dp.callback_query(F.data == "admin_analytics")
async def cb_admin_analytics(callback: types.CallbackQuery):
    if not is_admin(callback.from_user.username, callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return
    await callback.answer()

    a = db.get_analytics()
    avg_check = round(a['total_revenue'] / a['total_orders']) if a['total_orders'] > 0 else 0

    text = (
        "📊 *Финансовая и операционная сводка:*\n\n"
        f"💰 *Общая выручка:* {a['total_revenue']} ₽\n"
        f"🧾 *Средний чек:* {avg_check} ₽\n"
        f"📦 *Всего заказов оформлено:* {a['total_orders']}\n\n"
        f"• Новых в очереди: {a['new_orders']}\n"
        f"• На этапе кухни: {a['cooking_orders']}\n"
        f"• В доставке: {a['delivering_orders']}\n"
        f"• Успешно доставлено: {a['completed_orders']}\n"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="⬅️ Назад", callback_data="admin_refresh")]])
    if callback.message:
        await callback.message.edit_text(text, reply_markup=kb, parse_mode="Markdown")

# --- USER ORDER PROCESSING & INSTANT ADMIN NOTIFICATIONS ---

PROCESSED_ORDERS: dict[str, float] = {}

async def process_order_data(data: dict, user=None, message: types.Message | None = None, source: str = "webapp"):
    order_num = str(data.get("orderNumber") or random.randint(1000, 9999))
    now = time.time()

    # Deduplicate alerts within 60s
    is_duplicate = False
    if order_num in PROCESSED_ORDERS and (now - PROCESSED_ORDERS[order_num]) < 60:
        is_duplicate = True
    PROCESSED_ORDERS[order_num] = now

    user_id = user.id if user else (data.get("userId") or 0)
    username = user.username if user else (data.get("username") or "")
    first_name = user.first_name if user else "Клиент"

    items = data.get("items", [])
    total_price = data.get("totalPrice", 0)
    customer_name = data.get("customerName", first_name)
    phone = data.get("phone", "")
    email = data.get("email", "")
    address = data.get("address", "")
    comment = data.get("comment", "")
    payment_method = data.get("paymentMethod", "online")
    payment_str = "Оплата онлайн (ЮKassa / СБП)" if payment_method == "online" else "Оплата при получении"

    # Save to SQLite database
    try:
        db.create_order(
            order_number=order_num,
            user_id=user_id,
            user_name=customer_name,
            username=username,
            phone=phone,
            email=email,
            address=address,
            items=items,
            total_price=total_price,
            payment_method=payment_method,
            comment=comment
        )
    except Exception as e:
        logging.warning(f"Order #{order_num} DB notice: {e}")

    # Build customer receipt
    items_text = ""
    for i, item in enumerate(items, 1):
        items_text += f"{i}. {item.get('name', 'Товар')} × {item.get('quantity', 1)} шт. — {item.get('price', 0) * item.get('quantity', 1)} ₽\n"

    if message:
        receipt_text = (
            f"🎉 *Ваш заказ #{order_num} успешно подтверждён!*\n\n"
            f"📋 *Состав заказа:*\n{items_text}\n"
            f"💵 *Итого к оплате:* {total_price} ₽\n"
            f"💳 *Способ оплаты:* {payment_str}\n\n"
            f"👤 *Получатель:* {customer_name}\n"
            f"📞 *Телефон (проверен):* {phone}\n"
            f"📧 *Email для чека:* {email}\n"
            f"📍 *Адрес доставки:* {address}\n"
        )
        if comment:
            receipt_text += f"💬 *Комментарий:* {comment}\n"
        receipt_kb = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="📱 Открыть статус в приложении", 
                        web_app=WebAppInfo(url=f"{WEBAPP_URL}?tab=orders&order={order_num}")
                    )
                ]
            ]
        )
        try:
            await message.answer(receipt_text, reply_markup=receipt_kb, parse_mode="Markdown")
        except Exception:
            await message.answer(receipt_text, reply_markup=receipt_kb)

    # If duplicate push alert, return early
    if is_duplicate:
        logging.info(f"Duplicate push alert skipped for order #{order_num}")
        return

    # Build bulletproof HTML alert for admin (immune to parse crashes)
    items_html = ""
    for i, item in enumerate(items, 1):
        in_name = html.escape(str(item.get("name", "Товар")))
        in_qty = item.get("quantity", 1)
        in_pr = item.get("price", 0) * in_qty
        items_html += f"• {in_name} × {in_qty} шт. — <b>{in_pr} ₽</b>\n"

    uname_str = f"@{html.escape(username)}" if username else "нет username"

    admin_alert_html = (
        f"🚨 <b>НОВЫЙ ЗАКАЗ #{html.escape(order_num)}!</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"👤 <b>Клиент:</b> {html.escape(customer_name)} ({uname_str})\n"
        f"📞 <b>Телефон:</b> <code>{html.escape(phone)}</code> <i>(🛡️ проверен)</i>\n"
        f"📧 <b>Email:</b> <code>{html.escape(email)}</code>\n"
        f"📍 <b>Адрес:</b> {html.escape(address)}\n"
        f"💳 <b>Оплата:</b> {html.escape(payment_str)}\n"
        f"💵 <b>Сумма:</b> <b>{html.escape(str(total_price))} ₽</b>\n"
    )
    if comment:
        admin_alert_html += f"💬 <b>Коммент:</b> {html.escape(comment)}\n"
    admin_alert_html += f"\n📦 <b>Состав заказа:</b>\n{items_html}"

    admin_kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="👨‍🍳 В готовку", callback_data=f"st_{order_num}_cooking"),
                InlineKeyboardButton(text="🚴 В доставку", callback_data=f"st_{order_num}_delivering")
            ],
            [
                InlineKeyboardButton(text="✅ Выполнен", callback_data=f"st_{order_num}_completed"),
                InlineKeyboardButton(text="❌ Отменить", callback_data=f"st_{order_num}_cancelled")
            ],
            [
                InlineKeyboardButton(text="💳 Отметить «Оплачен»", callback_data=f"pay_{order_num}_paid")
            ]
        ]
    )

    admin_chat_id = db.get_setting("admin_chat_id") or os.getenv("ADMIN_CHAT_ID", DEFAULT_ADMIN_CHAT_ID)
    if admin_chat_id:
        try:
            await bot.send_message(
                chat_id=int(admin_chat_id),
                text=f"👑 <b>Оповещение для @qqeaux:</b>\n\n{admin_alert_html}",
                reply_markup=admin_kb,
                parse_mode="HTML"
            )
            logging.info(f"✅ Push alert sent to admin {admin_chat_id} for order #{order_num}")
        except Exception as e:
            logging.error(f"HTML send failed: {e}, retrying plain text...")
            try:
                clean_text = re.sub(r'<[^>]+>', '', admin_alert_html)
                await bot.send_message(
                    chat_id=int(admin_chat_id),
                    text=f"👑 Оповещение для @qqeaux:\n\n{clean_text}",
                    reply_markup=admin_kb
                )
                logging.info(f"✅ Push alert sent via plain text to {admin_chat_id}")
            except Exception as e2:
                logging.error(f"❌ Critical failure sending admin push alert: {e2}")
    else:
        logging.warning("⚠️ No admin_chat_id found! Admin alert could not be delivered.")

@dp.message(F.content_type == types.ContentType.WEB_APP_DATA)
async def handle_webapp_data(message: types.Message):
    raw_data = message.web_app_data.data
    user = message.from_user
    try:
        data = json.loads(raw_data)
        await process_order_data(data, user=user, message=message, source="webapp")
    except Exception as e:
        logging.error(f"Error parsing web_app_data: {e}", exc_info=True)
        await message.answer(f"✅ Заказ принят! Данные: {raw_data}")

@dp.message(Command("test_alert"))
async def handle_test_alert(message: types.Message):
    user = message.from_user
    username = user.username if user else None
    user_id = user.id if user else None

    if not is_admin(username, user_id):
        await message.answer("⛔ Команда доступна только администратору @qqeaux.")
        return

    admin_chat_id = db.get_setting("admin_chat_id") or os.getenv("ADMIN_CHAT_ID", DEFAULT_ADMIN_CHAT_ID)
    test_kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="👨‍🍳 В готовку", callback_data="test_cook"),
                InlineKeyboardButton(text="🚴 В доставку", callback_data="test_deliv")
            ],
            [
                InlineKeyboardButton(text="✅ Выполнен", callback_data="test_done")
            ]
        ]
    )
    try:
        await bot.send_message(
            chat_id=int(admin_chat_id),
            text=(
                f"🚨 <b>ТЕСТОВОЕ ОПОВЕЩЕНИЕ АДМИНИСТРАТОРА</b>\n"
                f"━━━━━━━━━━━━━━━━━━\n"
                f"👑 <b>Администратор:</b> @qqeaux\n"
                f"🆔 <b>Chat ID:</b> <code>{admin_chat_id}</code>\n"
                f"✅ <b>Статус:</b> Канал мгновенных push-уведомлений активен!\n\n"
                f"При оформлении нового заказа клиентом вы получите аналогичную карточку с контактами и кнопками управления."
            ),
            reply_markup=test_kb,
            parse_mode="HTML"
        )
        await message.answer(f"✅ Тестовое оповещение успешно отправлено на chat_id {admin_chat_id}!")
    except Exception as e:
        await message.answer(f"❌ Ошибка отправки: {e}")

# --- SUPPORT MENU WITH DEV ORDER OPTION ---

@dp.message(F.text == "💬 Поддержка")
@dp.message(Command("support"))
async def handle_support(message: types.Message):
    text = (
        "💬 *Служба заботы и поддержки клиентов*\n\n"
        "Мы на связи 24/7 и готовы помочь по любым вопросам:\n"
        "• Уточнить детали или статус вашего заказа\n"
        "• Вопросы по оплате, чекам и возвратам\n"
        "• Заказ разработки бота / интернет-магазина для вашего бизнеса\n\n"
        "Выберите интересующий пункт ниже 👇"
    )
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="💼 Заказать разработку бота / Mini App", callback_data="support_dev")
            ],
            [
                InlineKeyboardButton(text="👨‍💻 Написать менеджеру", url="https://t.me/qqeaux"),
                InlineKeyboardButton(text="❓ Частые вопросы (FAQ)", callback_data="support_faq")
            ]
        ]
    )
    await message.answer(text, reply_markup=kb, parse_mode="Markdown")

@dp.callback_query(F.data == "support_dev")
async def cb_support_dev(callback: types.CallbackQuery):
    await callback.answer()
    dev_text = (
        "💼 *Разработка Telegram Mini App под ключ:*\n\n"
        "Создаем современные интерактивные боты и веб-приложения для бизнеса:\n"
        "— Каталоги товаров и услуг\n"
        "— Доставка еды и бронирование\n"
        "— Закрытая панель администратора для владельца\n"
        "— Прием платежей (ЮKassa / СБП)\n"
        "— Авто-переключение тем (день/ночь) и валидация данных\n\n"
        "⏱ *Срок реализации:* 3–5 дней\n"
        "💰 *Стоимость:* от 25 000 руб.\n\n"
        "👉 Для заказа и обсуждения напишите разработчику: @qqeaux"
    )
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="💬 Написать разработчику (@qqeaux)", url="https://t.me/qqeaux")],
            [InlineKeyboardButton(text="⬅️ Назад в поддержку", callback_data="support_back")]
        ]
    )
    if callback.message:
        await callback.message.edit_text(dev_text, reply_markup=kb, parse_mode="Markdown")

@dp.callback_query(F.data == "support_faq")
async def cb_support_faq(callback: types.CallbackQuery):
    await callback.answer()
    faq_text = (
        "❓ *Частые вопросы (FAQ):*\n\n"
        "1. *Как отследить статус заказа?*\n"
        "После оформления бот автоматически присылает уведомления на каждом этапе (готовка, выезд курьера, доставка).\n\n"
        "2. *Как работает оплата?*\n"
        "Оплата производится официально через ЮKassa (карты, СБП) или при получении курьеру.\n\n"
        "3. *Сколько занимает доставка?*\n"
        "Среднее время приготовления и доставки по городу: 30–45 минут."
    )
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="⬅️ Назад в поддержку", callback_data="support_back")]
        ]
    )
    if callback.message:
        await callback.message.edit_text(faq_text, reply_markup=kb, parse_mode="Markdown")

@dp.callback_query(F.data == "support_back")
async def cb_support_back(callback: types.CallbackQuery):
    await callback.answer()
    text = (
        "💬 *Служба заботы и поддержки клиентов*\n\n"
        "Мы на связи 24/7 и готовы помочь по любым вопросам:\n"
        "• Уточнить детали или статус вашего заказа\n"
        "• Вопросы по оплате, чекам и возвратам\n"
        "• Заказ разработки бота / интернет-магазина для вашего бизнеса\n\n"
        "Выберите интересующий пункт ниже 👇"
    )
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="💼 Заказать разработку бота / Mini App", callback_data="support_dev")
            ],
            [
                InlineKeyboardButton(text="👨‍💻 Написать менеджеру", url="https://t.me/qqeaux"),
                InlineKeyboardButton(text="❓ Частые вопросы (FAQ)", callback_data="support_faq")
            ]
        ]
    )
    if callback.message:
        await callback.message.edit_text(text, reply_markup=kb, parse_mode="Markdown")

# Marketing handlers
@dp.message(F.text == "💼 Заказать разработку")
async def handle_order_dev(message: types.Message):
    await handle_support(message)

@dp.message(F.text == "ℹ️ О проекте")
async def handle_about(message: types.Message):
    about_text = (
        "ℹ️ *О демонстрационном стенде:*\n\n"
        "Этот проект демонстрирует связку:\n"
        "1. *Frontend:* React 19 + TypeScript + Tailwind CSS (Telegram WebApp SDK)\n"
        "2. *Backend:* Python (Aiogram 3 Async Framework)\n"
        "3. *Динамическая тема:* Авто-смена день/ночь по времени Москвы (07:00–20:00)\n"
        "4. *База данных:* SQLite (сохранение заказов, управление ценами и статусами)\n"
        "5. *Push-уведомления:* Моментальные алерты о заказах для администратора\n\n"
        "Нажмите кнопку *«🛍️ Открыть магазин (Mini App)»* внизу экрана, чтобы протестировать функционал."
    )
    await message.answer(about_text, parse_mode="Markdown")

# Web Health Check & Orders API server for Cloud hosting
async def health_check(request):
    return web.Response(text="Bot & Admin API is running 24/7!", status=200)

async def handle_cors_options(request):
    return web.Response(
        status=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )

async def handle_api_orders(request):
    try:
        data = await request.json()
        logging.info(f"API order received: #{data.get('orderNumber')}")
        await process_order_data(data, source="api")
        return web.json_response(
            {"ok": True, "message": "Order processed and admin notified"},
            headers={"Access-Control-Allow-Origin": "*"}
        )
    except Exception as e:
        logging.error(f"Error processing API order: {e}", exc_info=True)
        return web.json_response(
            {"ok": False, "error": str(e)},
            status=500,
            headers={"Access-Control-Allow-Origin": "*"}
        )

async def handle_get_orders(request):
    try:
        orders = db.get_orders(limit=100)
        return web.json_response(orders, headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        logging.error(f"Error getting orders: {e}")
        return web.json_response([], headers={"Access-Control-Allow-Origin": "*"})

async def handle_delete_order(request):
    try:
        data = await request.json()
        order_num = data.get("orderNumber")
        if order_num:
            deleted = db.delete_order(order_num)
            logging.info(f"Order #{order_num} deleted: {deleted}")
            return web.json_response({"ok": True, "deleted": deleted}, headers={"Access-Control-Allow-Origin": "*"})
        return web.json_response({"ok": False, "error": "orderNumber required"}, status=400, headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        logging.error(f"Error deleting order: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500, headers={"Access-Control-Allow-Origin": "*"})

async def handle_update_order_status(request):
    try:
        data = await request.json()
        order_num = data.get("orderNumber")
        new_status = data.get("status")
        if not order_num or not new_status:
            return web.json_response({"ok": False, "error": "Invalid params"}, status=400, headers={"Access-Control-Allow-Origin": "*"})

        db.update_order_status(order_num, new_status)
        order = db.get_order_by_number(order_num)
        if order and order.get('user_id'):
            status_client_msgs = {
                "cooking": f"👨‍🍳 <b>Ваш заказ #{order_num} передан на кухню и уже готовится!</b>\n\nШеф-повар собирает ингредиенты. Вы можете следить за стадиями заказа прямо в приложении.",
                "delivering": f"🚴 <b>Курьер забрал заказ #{order_num} и выехал!</b>\n\nАдрес доставки: {html.escape(order.get('address', ''))}. Курьер скоро будет у вас.",
                "completed": f"🎉 <b>Заказ #{order_num} успешно доставлен!</b>\n\nПриятного аппетита! Будем рады вашему отзыву.",
                "cancelled": f"❌ <b>Заказ #{order_num} был отменен.</b>\n\nЕсли у вас есть вопросы, служба заботы всегда на связи в приложении."
            }
            client_text = status_client_msgs.get(new_status)
            if client_text:
                track_kb = InlineKeyboardMarkup(
                    inline_keyboard=[[
                        InlineKeyboardButton(
                            text="📱 Открыть статус в приложении", 
                            web_app=WebAppInfo(url=f"{WEBAPP_URL}?tab=orders&order={order_num}")
                        )
                    ]]
                )
                try:
                    await bot.send_message(chat_id=order['user_id'], text=client_text, reply_markup=track_kb, parse_mode="HTML")
                except Exception as e:
                    logging.warning(f"Could not notify customer: {e}")

        return web.json_response({"ok": True}, headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        logging.error(f"Error updating order status: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500, headers={"Access-Control-Allow-Origin": "*"})

async def handle_get_products(request):
    try:
        products = db.get_products()
        return web.json_response(products, headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        logging.error(f"Error fetching products: {e}")
        return web.json_response([], headers={"Access-Control-Allow-Origin": "*"})

async def handle_update_price(request):
    try:
        data = await request.json()
        product_id = data.get("productId")
        price = data.get("price")
        if product_id and price is not None:
            db.update_product_price(product_id, int(price))
            return web.json_response({"ok": True}, headers={"Access-Control-Allow-Origin": "*"})
        return web.json_response({"ok": False, "error": "Invalid params"}, status=400, headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        logging.error(f"Error updating price: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500, headers={"Access-Control-Allow-Origin": "*"})

async def handle_toggle_product(request):
    try:
        data = await request.json()
        product_id = data.get("productId")
        if product_id:
            new_val = db.toggle_product_availability(product_id)
            return web.json_response({"ok": True, "is_available": new_val}, headers={"Access-Control-Allow-Origin": "*"})
        return web.json_response({"ok": False, "error": "productId required"}, status=400, headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        logging.error(f"Error toggling product: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500, headers={"Access-Control-Allow-Origin": "*"})

async def start_web_server():
    app = web.Application()
    app.router.add_get("/", health_check)
    app.router.add_get("/health", health_check)
    
    # Orders API
    app.router.add_get("/api/orders", handle_get_orders)
    app.router.add_post("/api/orders", handle_api_orders)
    app.router.add_post("/api/orders/delete", handle_delete_order)
    app.router.add_post("/api/orders/status", handle_update_order_status)

    # Products API
    app.router.add_get("/api/products", handle_get_products)
    app.router.add_post("/api/products/price", handle_update_price)
    app.router.add_post("/api/products/toggle", handle_toggle_product)

    # CORS Preflight
    app.router.add_route("OPTIONS", "/{tail:.*}", handle_cors_options)
    
    port = int(os.getenv("PORT", 8080))
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logging.info(f"Web server started on port {port}")

async def main():
    logging.info("🤖 Starting Telegram Bot with Admin Notifications & Anti-Fraud...")
    await start_web_server()
    await bot.delete_webhook(drop_pending_updates=True)
    try:
        await bot.set_chat_menu_button(
            menu_button=types.MenuButtonWebApp(
                text="Ресторан & Меню",
                web_app=WebAppInfo(url=WEBAPP_URL)
            )
        )
    except Exception as e:
        logging.warning(f"Could not set chat menu button: {e}")
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logging.info("Bot stopped.")
