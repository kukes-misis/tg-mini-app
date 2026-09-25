import asyncio
import json
import logging
import os
import random
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
from config import BOT_TOKEN, WEBAPP_URL, is_admin
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
                text="🛍️ Открыть магазин (Mini App)", 
                web_app=WebAppInfo(url=WEBAPP_URL)
            )
        ]
    ]
    if is_admin(username, user_id):
        buttons.append([KeyboardButton(text="👑 Панель управления (Админ)")])

    buttons.append([
        KeyboardButton(text="💼 Заказать разработку"),
        KeyboardButton(text="ℹ️ О проекте")
    ])
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)

@dp.message(CommandStart())
async def handle_start(message: types.Message):
    user = message.from_user
    username = user.username if user else None
    user_id = user.id if user else None
    user_name = user.first_name if user else "друг"

    welcome_text = (
        f"👋 *Здравствуйте, {user_name}!* \n\n"
        "Добро пожаловать в демонстрационный интернет-магазин нового поколения на базе *Telegram Mini App*.\n\n"
        "✨ *Преимущества формата:*\n"
        "• Мгновенно открывается внутри Telegram\n"
        "• Не нужно ничего скачивать из App Store / Google Play\n"
        "• Плавный адаптивный интерфейс с корзиной и выбором доставки\n"
        "• Онлайн-оплата картами и через СБП (ЮKassa)\n\n"
    )
    if is_admin(username, user_id):
        welcome_text += "👑 *Вы авторизованы как Администратор (@qqeaux)*. Вам доступна кнопка управления магазином.\n\n"

    welcome_text += "👇 *Нажмите кнопку ниже, чтобы открыть приложение:* "
    await message.answer(
        welcome_text, 
        reply_markup=get_keyboard(username, user_id),
        parse_mode="Markdown"
    )

# --- ADMIN PANEL ---

@dp.message(F.text == "👑 Панель управления (Админ)")
@dp.message(Command("admin"))
async def handle_admin(message: types.Message):
    user = message.from_user
    if not is_admin(user.username if user else None, user.id if user else None):
        await message.answer("⛔ *Доступ запрещен.*\nПанель администратора доступна только владельцу аккаунта @qqeaux.", parse_mode="Markdown")
        return

    analytics = db.get_analytics()
    admin_text = (
        "👑 *Панель администратора магазина*\n\n"
        f"💰 *Выручка всего:* {analytics['total_revenue']} ₽\n"
        f"📦 *Всего заказов:* {analytics['total_orders']}\n"
        f"🟡 *Новых:* {analytics['new_orders']} | "
        f"👨‍🍳 *Готовятся:* {analytics['cooking_orders']} | "
        f"🚴 *В пути:* {analytics['delivering_orders']}\n\n"
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

    pay_badge = "💳 Оплачен онлайн" if order.get('payment_status') == 'paid' else "⏳ Ожидает оплаты / при получении"

    msg = (
        f"📋 *Детали заказа #{order['order_number']}*\n\n"
        f"👤 *Клиент:* {order.get('user_name')} (@{order.get('username') or 'без username'})\n"
        f"📞 *Телефон:* {order.get('phone')}\n"
        f"📍 *Адрес:* {order.get('address')}\n"
        f"💬 *Комментарий:* {order.get('comment') or 'нет'}\n\n"
        f"📦 *Состав:*\n{items_str}\n"
        f"💵 *Сумма:* {order['total_price']} ₽\n"
        f"💳 *Статус оплаты:* {pay_badge}\n"
        f"⚙️ *Текущий статус:* {status_labels.get(order['status'], order['status'])}\n"
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

# Admin: Update Order Status Handler
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
    # Notify customer if user_id is saved
    if order and order.get('user_id'):
        status_client_msgs = {
            "cooking": f"👨‍🍳 *Заказ #{order_num} передан на кухню и уже готовится!*",
            "delivering": f"🚴 *Заказ #{order_num} передан курьеру и мчит по адресу: {order.get('address')}!*",
            "completed": f"🎉 *Заказ #{order_num} успешно доставлен!* Приятного аппетита! Ждем вас снова.",
            "cancelled": f"❌ *Заказ #{order_num} был отменен.* Если возникли вопросы, свяжитесь с поддержкой."
        }
        client_text = status_client_msgs.get(new_status)
        if client_text:
            try:
                await bot.send_message(chat_id=order['user_id'], text=client_text, parse_mode="Markdown")
            except Exception as e:
                logging.warning(f"Could not notify customer {order['user_id']}: {e}")

    # Re-render order view
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

# Admin: Products & Prices List
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
    # Re-render single prod
    callback.data = f"prod_{prod_id}"
    await cb_admin_single_prod(callback)

# Admin: Change Price prompt
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
        # Show updated admin products
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

# --- USER ORDER PROCESSING ---

@dp.message(F.content_type == types.ContentType.WEB_APP_DATA)
async def handle_webapp_data(message: types.Message):
    raw_data = message.web_app_data.data
    user = message.from_user
    user_id = user.id if user else 0
    username = user.username if user else ""
    first_name = user.first_name if user else "Клиент"

    try:
        data = json.loads(raw_data)
        order_num = str(random.randint(1000, 9999))
        items = data.get("items", [])
        total_price = data.get("totalPrice", 0)
        phone = data.get("phone", "")
        address = data.get("address", "")
        comment = data.get("comment", "")
        payment_method = data.get("paymentMethod", "online")

        # Save to SQLite database
        db.create_order(
            order_number=order_num,
            user_id=user_id,
            user_name=data.get("customerName", first_name),
            username=username,
            phone=phone,
            address=address,
            items=items,
            total_price=total_price,
            payment_method=payment_method,
            comment=comment
        )

        items_text = ""
        for i, item in enumerate(items, 1):
            items_text += f"{i}. {item['name']} × {item['quantity']} шт. — {item['price'] * item['quantity']} ₽\n"

        payment_str = "Оплата онлайн (ЮKassa / СБП)" if payment_method == "online" else "Оплата при получении"

        # Customer Receipt
        receipt_text = (
            f"🎉 *Ваш заказ #A-{order_num} успешно оформлен!*\n\n"
            f"📋 *Состав заказа:*\n{items_text}\n"
            f"💵 *Итого к оплате:* {total_price} ₽\n"
            f"💳 *Способ оплаты:* {payment_str}\n\n"
            f"👤 *Получатель:* {data.get('customerName', first_name)}\n"
            f"📞 *Телефон:* {phone}\n"
            f"📍 *Адрес доставки:* {address}\n"
        )
        if comment:
            receipt_text += f"💬 *Комментарий:* {comment}\n"

        receipt_text += "\n⏱ *Ориентировочное время доставки:* 35–45 минут."
        await message.answer(receipt_text, parse_mode="Markdown")

        # INSTANT ADMIN NOTIFICATION
        # Look for admin user_id among orders or notify current if matches
        admin_alert = (
            f"🚨 *НОВЫЙ ЗАКАЗ #A-{order_num}!*\n\n"
            f"👤 *Клиент:* {data.get('customerName', first_name)} (@{username or 'нет'})\n"
            f"📞 *Телефон:* {phone}\n"
            f"📍 *Адрес:* {address}\n"
            f"💵 *Сумма:* {total_price} ₽ ({payment_str})\n\n"
            f"📦 *Товары:*\n{items_text}"
        )
        if comment:
            admin_alert += f"💬 *Коммент:* {comment}\n"

        admin_kb = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(text="👨‍🍳 В готовку", callback_data=f"st_{order_num}_cooking"),
                    InlineKeyboardButton(text="🚴 В доставку", callback_data=f"st_{order_num}_delivering")
                ],
                [
                    InlineKeyboardButton(text="✅ Выполнен", callback_data=f"st_{order_num}_completed"),
                    InlineKeyboardButton(text="❌ Отменить", callback_data=f"st_{order_num}_cancelled")
                ]
            ]
        )

        # Send alert if admin matches
        if is_admin(username, user_id):
            await message.answer(f"👑 *Оповещение администратора:* \n\n{admin_alert}", reply_markup=admin_kb, parse_mode="Markdown")

    except Exception as e:
        logging.error(f"Error parsing web_app_data: {e}", exc_info=True)
        await message.answer(f"✅ Заказ принят! Данные: {raw_data}")

# Standard marketing handlers
@dp.message(F.text == "💼 Заказать разработку")
async def handle_order_dev(message: types.Message):
    info_text = (
        "💼 *Разработка Telegram Mini App под ключ:*\n\n"
        "Разрабатываем современные интерактивные боты и веб-приложения для вашего бизнеса:\n"
        "— Каталоги товаров и услуг\n"
        "— Доставка еды и онлайн-запись\n"
        "— Панель администратора с управлением заказами и ценами\n"
        "— Прием платежей (ЮKassa / СБП)\n"
        "— Синхронизация с CRM и складом\n\n"
        "⏱ *Срок реализации:* 3–7 дней\n"
        "💰 *Стоимость:* от 25 000 руб.\n\n"
        "Для заказа напишите разработчику: @qqeaux"
    )
    await message.answer(info_text, parse_mode="Markdown")

@dp.message(F.text == "ℹ️ О проекте")
async def handle_about(message: types.Message):
    about_text = (
        "ℹ️ *О демонстрационном стенде:*\n\n"
        "Этот проект демонстрирует связку:\n"
        "1. *Frontend:* React 19 + TypeScript + Tailwind CSS (Telegram WebApp SDK)\n"
        "2. *Backend:* Python (Aiogram 3 Async Framework)\n"
        "3. *База данных:* SQLite (сохранение заказов, управление ценами и статусами)\n"
        "4. *Безопасность:* Ролевой доступ (панель админа строго для @qqeaux)\n\n"
        "Нажмите кнопку *«🛍️ Открыть магазин (Mini App)»* внизу экрана, чтобы протестировать функционал."
    )
    await message.answer(about_text, parse_mode="Markdown")

# Web Health Check server for Cloud hosting
async def health_check(request):
    return web.Response(text="Bot & Admin API is running 24/7!", status=200)

async def start_web_server():
    app = web.Application()
    app.router.add_get("/", health_check)
    app.router.add_get("/health", health_check)
    
    port = int(os.getenv("PORT", 8080))
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logging.info(f"Web server started on port {port}")

async def main():
    logging.info("🤖 Starting Telegram Bot with Admin Panel...")
    await start_web_server()
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logging.info("Bot stopped.")
