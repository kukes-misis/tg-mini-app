import asyncio
import html
import logging
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    InlineKeyboardMarkup, 
    InlineKeyboardButton, 
    ReplyKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardRemove
)
from config import ADMIN_BOT_TOKEN, BOT_TOKEN, ADMIN_LOGIN, ADMIN_PASSWORD
import database as db

# Bot instance for the dedicated Admin Bot
admin_bot = Bot(token=ADMIN_BOT_TOKEN)
admin_dp = Dispatcher()

# Client bot instance to notify clients when admin changes order status
customer_bot = Bot(token=BOT_TOKEN)

# FSM States
class AdminLoginState(StatesGroup):
    waiting_for_login = State()
    waiting_for_password = State()

class AdminPriceEditState(StatesGroup):
    waiting_for_price = State()

def get_admin_menu_keyboard():
    buttons = [
        [
            KeyboardButton(text="📦 Активные заказы"),
            KeyboardButton(text="📋 История заказов")
        ],
        [
            KeyboardButton(text="🏷 Стоп-лист и Цены"),
            KeyboardButton(text="📊 Аналитика")
        ],
        [
            KeyboardButton(text="🗑 Очистить базу"),
            KeyboardButton(text="🚪 Выйти из системы")
        ]
    ]
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)

# --- AUTHENTICATION FLOW ---

@admin_dp.message(CommandStart())
async def handle_admin_start(message: types.Message, state: FSMContext):
    chat_id = message.chat.id
    if db.is_admin_session(chat_id):
        await message.answer(
            "👑 <b>Диспетчерская Vibe Kitchen</b>\n\n"
            "Вы уже авторизованы в системе. Выберите раздел меню ниже:",
            reply_markup=get_admin_menu_keyboard(),
            parse_mode="HTML"
        )
        return

    await state.set_state(AdminLoginState.waiting_for_login)
    await message.answer(
        "🔒 <b>Вход в Диспетчерскую Vibe Kitchen</b>\n\n"
        "Система защищена. Пожалуйста, введите ваш <b>логин</b> администратора:",
        reply_markup=ReplyKeyboardRemove(),
        parse_mode="HTML"
    )

@admin_dp.message(AdminLoginState.waiting_for_login)
async def process_admin_login(message: types.Message, state: FSMContext):
    entered_login = (message.text or "").strip()
    if entered_login == ADMIN_LOGIN:
        await state.set_state(AdminLoginState.waiting_for_password)
        await message.answer("🔑 Логин принят. Теперь введите <b>пароль</b>:", parse_mode="HTML")
    else:
        await message.answer("❌ Неверный логин. Попробуйте еще раз или напишите /start:")

@admin_dp.message(AdminLoginState.waiting_for_password)
async def process_admin_password(message: types.Message, state: FSMContext):
    entered_password = (message.text or "").strip()
    
    # Try deleting the password message for security
    try:
        await message.delete()
    except Exception:
        pass

    if entered_password == ADMIN_PASSWORD:
        db.add_admin_session(message.chat.id)
        await state.clear()
        await message.answer(
            "✅ <b>Авторизация успешна!</b>\n\n"
            "Добро пожаловать в панель диспетчера Vibe Kitchen.\n"
            "Все оповещения о новых заказах клиентов будут мгновенно приходить сюда.",
            reply_markup=get_admin_menu_keyboard(),
            parse_mode="HTML"
        )
    else:
        await message.answer("❌ Неверный пароль. Доступ запрещен. Отправьте /start для повтора.")
        await state.clear()

@admin_dp.message(F.text == "🚪 Выйти из системы")
@admin_dp.message(Command("logout"))
async def handle_admin_logout(message: types.Message, state: FSMContext):
    db.remove_admin_session(message.chat.id)
    await state.clear()
    await message.answer(
        "👋 Вы вышли из учетной записи администратора.\nДля повторного входа отправьте /start.",
        reply_markup=ReplyKeyboardRemove()
    )

# --- ORDER MANAGEMENT ---

@admin_dp.message(F.text == "📦 Активные заказы")
async def show_active_orders(message: types.Message):
    if not db.is_admin_session(message.chat.id):
        await message.answer("🔒 Требуется вход. Отправьте /start.")
        return

    orders = db.get_orders(limit=30)
    active = [o for o in orders if o.get('status') in ['new', 'cooking', 'delivering']]

    if not active:
        await message.answer("✅ <b>Нет активных заказов.</b> Все заказы приготовлены и доставлены!", parse_mode="HTML")
        return

    await message.answer(f"📦 <b>Заказы в работе ({len(active)}):</b>", parse_mode="HTML")

    status_labels = {
        "new": "🟡 Новый",
        "cooking": "👨‍🍳 Готовится",
        "delivering": "🚴 В пути"
    }

    for o in active[:10]:
        order_num = o['order_number']
        st = status_labels.get(o['status'], o['status'])
        eta_line = f"\n⏱ <b>Расчетное время:</b> {html.escape(o.get('estimated_time') or 'не указано')}"
        note_line = f"\n💬 <b>Примечание:</b> {html.escape(o.get('status_note') or 'нет')}"

        items_str = ""
        for it in o.get('items', []):
            items_str += f"  • {html.escape(it.get('name', ''))} × {it.get('quantity', 1)} = {it.get('price', 0) * it.get('quantity', 1)} ₽\n"

        phone = html.escape(str(o.get('phone') or ''))
        uname = f"@{html.escape(o['username'])}" if o.get('username') else "нет username"

        msg = (
            f"📋 <b>Заказ #{order_num}</b> ({st})\n"
            f"👤 <b>Клиент:</b> {html.escape(str(o.get('user_name') or ''))} ({uname})\n"
            f"📞 <b>Телефон:</b> <code>{phone}</code>\n"
            f"📍 <b>Адрес:</b> {html.escape(str(o.get('address') or ''))}\n"
            f"{eta_line}{note_line}\n\n"
            f"📦 <b>Состав:</b>\n{items_str}\n"
            f"💵 <b>Сумма:</b> <b>{o['total_price']} ₽</b> (Оплата при получении)"
        )

        kb = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(text="👨‍🍳 Кухня (~15м)", callback_data=f"adm_st_{order_num}_cooking_15m"),
                    InlineKeyboardButton(text="👨‍🍳 Кухня (~30м)", callback_data=f"adm_st_{order_num}_cooking_30m")
                ],
                [
                    InlineKeyboardButton(text="🚴 Доставка (~20м)", callback_data=f"adm_st_{order_num}_delivering_20m"),
                    InlineKeyboardButton(text="🚴 Доставка (~35м)", callback_data=f"adm_st_{order_num}_delivering_35m")
                ],
                [
                    InlineKeyboardButton(text="✅ Доставлен", callback_data=f"adm_st_{order_num}_completed_0"),
                    InlineKeyboardButton(text="❌ Отменить", callback_data=f"adm_st_{order_num}_cancelled_0")
                ]
            ]
        )
        await message.answer(msg, reply_markup=kb, parse_mode="HTML")

@admin_dp.message(F.text == "📋 История заказов")
async def show_history_orders(message: types.Message):
    if not db.is_admin_session(message.chat.id):
        await message.answer("🔒 Требуется вход. Отправьте /start.")
        return

    orders = db.get_orders(limit=20)
    history = [o for o in orders if o.get('status') in ['completed', 'cancelled']]

    if not history:
        await message.answer("📋 История завершенных заказов пока пуста.", parse_mode="HTML")
        return

    text = "📋 <b>Последние завершенные заказы:</b>\n\n"
    for o in history[:10]:
        st_icon = "✅ Выполнен" if o.get('status') == 'completed' else "❌ Отменен"
        text += f"• <b>#{o['order_number']}</b> ({st_icon}) — {o['total_price']} ₽ | {html.escape(str(o.get('user_name') or ''))} ({o.get('created_at')})\n"

    await message.answer(text, parse_mode="HTML")

# Callback for updating status from admin bot
@admin_dp.callback_query(F.data.startswith("adm_st_"))
async def cb_admin_status_change(callback: types.CallbackQuery):
    if not db.is_admin_session(callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return

    parts = callback.data.split("_")
    order_num = parts[2]
    new_status = parts[3]
    eta_param = parts[4] if len(parts) > 4 else "0"
    
    eta_text = None
    if eta_param and eta_param != "0":
        eta_text = f"~{eta_param.replace('m', ' мин')}"

    db.update_order_status(order_num, new_status, estimated_time=eta_text)
    await callback.answer(f"Статус #{order_num}: {new_status} {eta_text or ''}")

    # Notify customer via the customer bot
    order = db.get_order_by_number(order_num)
    if order and order.get('user_id'):
        eta_line = f"\n⏱ <b>Примерное время:</b> {eta_text}" if eta_text else ""
        status_client_msgs = {
            "cooking": f"👨‍🍳 <b>Ваш заказ #{order_num} передан на кухню и уже готовится!</b>{eta_line}\n\nШеф-повар собирает ингредиенты. Вы можете следить за стадиями прямо в приложении.",
            "delivering": f"🚴 <b>Курьер забрал заказ #{order_num} и выехал!</b>{eta_line}\n\nАдрес доставки: {html.escape(order.get('address', ''))}. Курьер скоро будет у вас.",
            "completed": f"🎉 <b>Заказ #{order_num} успешно доставлен!</b>\n\nПриятного аппетита! Будем рады вашему отзыву.",
            "cancelled": f"❌ <b>Заказ #{order_num} был отменен рестораном.</b>"
        }
        client_text = status_client_msgs.get(new_status)
        if client_text:
            try:
                await customer_bot.send_message(chat_id=order['user_id'], text=client_text, parse_mode="HTML")
            except Exception as e:
                logging.warning(f"Could not notify customer {order['user_id']}: {e}")

    # Update message text with badge
    status_icons = {
        "cooking": "👨‍🍳 Готовится",
        "delivering": "🚴 В пути",
        "completed": "✅ Выполнен",
        "cancelled": "❌ Отменен"
    }
    if callback.message:
        await callback.message.reply(f"⚡ <b>Заказ #{order_num} переведен в статус:</b> {status_icons.get(new_status, new_status)} ({eta_text or ''})", parse_mode="HTML")

# --- CATALOG & STOP-LIST MANAGEMENT ---

@admin_dp.message(F.text == "🏷 Стоп-лист и Цены")
async def show_catalog_management(message: types.Message):
    if not db.is_admin_session(message.chat.id):
        await message.answer("🔒 Требуется вход. Отправьте /start.")
        return

    products = db.get_products()
    await message.answer("🏷 <b>Управление меню и ценами:</b>\nНажмите кнопку под товаром, чтобы изменить цену или отправить в стоп-лист:", parse_mode="HTML")

    for p in products:
        is_avail = bool(p.get('is_available', 1))
        st_text = "🟢 В наличии" if is_avail else "🔴 В стоп-листе"
        toggle_btn_text = "Снять с продажи (Стоп)" if is_avail else "Вернуть в меню (Вкл)"

        kb = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(text=toggle_btn_text, callback_data=f"adm_toggle_{p['id']}"),
                    InlineKeyboardButton(text="✏️ Изменить цену", callback_data=f"adm_price_{p['id']}")
                ]
            ]
        )
        await message.answer(
            f"<b>{html.escape(p['name'])}</b>\n"
            f"💰 Цена: <b>{p['price']} ₽</b> | Вес: {p.get('weight') or '—'}\n"
            f"Статус: {st_text}",
            reply_markup=kb,
            parse_mode="HTML"
        )

@admin_dp.callback_query(F.data.startswith("adm_toggle_"))
async def cb_toggle_product(callback: types.CallbackQuery):
    if not db.is_admin_session(callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return

    prod_id = callback.data.replace("adm_toggle_", "")
    new_val = db.toggle_product_availability(prod_id)
    status_str = "в наличии" if new_val == 1 else "в стоп-листе"
    await callback.answer(f"Товар теперь {status_str}!")

    # Refresh message
    products = db.get_products()
    prod = next((p for p in products if p['id'] == prod_id), None)
    if prod and callback.message:
        is_avail = bool(prod.get('is_available', 1))
        st_text = "🟢 В наличии" if is_avail else "🔴 В стоп-листе"
        toggle_btn_text = "Снять с продажи (Стоп)" if is_avail else "Вернуть в меню (Вкл)"
        kb = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(text=toggle_btn_text, callback_data=f"adm_toggle_{prod['id']}"),
                    InlineKeyboardButton(text="✏️ Изменить цену", callback_data=f"adm_price_{prod['id']}")
                ]
            ]
        )
        await callback.message.edit_text(
            f"<b>{html.escape(prod['name'])}</b>\n"
            f"💰 Цена: <b>{prod['price']} ₽</b> | Вес: {prod.get('weight') or '—'}\n"
            f"Статус: {st_text}",
            reply_markup=kb,
            parse_mode="HTML"
        )

@admin_dp.callback_query(F.data.startswith("adm_price_"))
async def cb_start_edit_price(callback: types.CallbackQuery, state: FSMContext):
    if not db.is_admin_session(callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return

    prod_id = callback.data.replace("adm_price_", "")
    await state.update_data(editing_product_id=prod_id)
    await state.set_state(AdminPriceEditState.waiting_for_price)
    await callback.answer()
    await callback.message.reply(f"💰 Введите новую цену в рублях для товара (только число):")

@admin_dp.message(AdminPriceEditState.waiting_for_price)
async def process_new_price(message: types.Message, state: FSMContext):
    text = (message.text or "").strip()
    if not text.isdigit() or int(text) <= 0:
        await message.answer("❌ Пожалуйста, введите корректное число (например, 550):")
        return

    new_price = int(text)
    data = await state.get_data()
    prod_id = data.get("editing_product_id")
    if prod_id:
        db.update_product_price(prod_id, new_price)
        await state.clear()
        await message.answer(f"✅ Цена успешно обновлена на <b>{new_price} ₽</b>!", parse_mode="HTML")

# --- ANALYTICS & DATABASE PURGE ---

@admin_dp.message(F.text == "📊 Аналитика")
async def show_analytics(message: types.Message):
    if not db.is_admin_session(message.chat.id):
        await message.answer("🔒 Требуется вход. Отправьте /start.")
        return

    a = db.get_analytics()
    avg_check = round(a['total_revenue'] / a['total_orders']) if a['total_orders'] > 0 else 0

    text = (
        "📊 <b>Финансовая сводка ресторана:</b>\n\n"
        f"💰 <b>Общая выручка:</b> {a['total_revenue']} ₽\n"
        f"🧾 <b>Средний чек:</b> {avg_check} ₽\n"
        f"📦 <b>Всего заказов:</b> {a['total_orders']}\n\n"
        f"• Новых в очереди: {a['new_orders']}\n"
        f"• На кухне: {a['cooking_orders']}\n"
        f"• В доставке: {a['delivering_orders']}\n"
        f"• Выполнено: {a['completed_orders']}\n"
    )
    await message.answer(text, parse_mode="HTML")

@admin_dp.message(F.text == "🗑 Очистить базу")
async def confirm_clear_db_prompt(message: types.Message):
    if not db.is_admin_session(message.chat.id):
        await message.answer("🔒 Требуется вход. Отправьте /start.")
        return

    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="⚠️ Да, удалить все заказы", callback_data="adm_clear_db_confirm")
            ],
            [
                InlineKeyboardButton(text="Отмена", callback_data="adm_clear_db_cancel")
            ]
        ]
    )
    await message.answer(
        "⚠️ <b>Внимание!</b> Вы собираетесь удалить абсолютно все заказы из базы данных навсегда.\nПодтвердите действие:",
        reply_markup=kb,
        parse_mode="HTML"
    )

@admin_dp.callback_query(F.data == "adm_clear_db_confirm")
async def cb_clear_db_confirmed(callback: types.CallbackQuery):
    if not db.is_admin_session(callback.from_user.id):
        await callback.answer("⛔ Доступ запрещен", show_alert=True)
        return

    count = db.clear_all_orders()
    await callback.answer("База очищена!", show_alert=True)
    if callback.message:
        await callback.message.edit_text(f"🗑 <b>История заказов полностью очищена!</b> Удалено записей: {count}", parse_mode="HTML")

@admin_dp.callback_query(F.data == "adm_clear_db_cancel")
async def cb_clear_db_cancelled(callback: types.CallbackQuery):
    await callback.answer("Отменено")
    if callback.message:
        await callback.message.delete()

# --- INSTANT PUSH NOTIFICATION DISPATCHER TO ALL AUTHENTICATED ADMINS ---

async def broadcast_order_to_admins(order_data: dict):
    """Called whenever a new order is submitted in customer bot or Mini App."""
    admin_sessions = db.get_all_admin_sessions()
    if not admin_sessions:
        logging.warning("⚠️ No active admin sessions logged into Admin Bot! Admin alerts cannot be delivered.")
        return

    order_num = str(order_data.get("orderNumber") or "")
    total_price = order_data.get("totalPrice", 0)
    customer_name = order_data.get("customerName", "Клиент")
    phone = order_data.get("phone", "")
    address = order_data.get("address", "")
    comment = order_data.get("comment", "")
    username = order_data.get("username", "")
    uname_str = f"@{html.escape(username)}" if username else "нет username"

    items_html = ""
    for it in order_data.get("items", []):
        name = html.escape(str(it.get("name", "Товар")))
        qty = it.get("quantity", 1)
        pr = it.get("price", 0) * qty
        items_html += f"  • {name} × {qty} = <b>{pr} ₽</b>\n"

    alert_html = (
        f"🚨 <b>НОВЫЙ ЗАКАЗ #{html.escape(order_num)}!</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"👤 <b>Клиент:</b> {html.escape(customer_name)} ({uname_str})\n"
        f"📞 <b>Телефон:</b> <code>{html.escape(phone)}</code>\n"
        f"📍 <b>Адрес:</b> {html.escape(address)}\n"
        f"💵 <b>Сумма:</b> <b>{total_price} ₽</b> (Оплата при получении)\n"
    )
    if comment:
        alert_html += f"💬 <b>Комментарий:</b> {html.escape(comment)}\n"
    alert_html += f"\n📦 <b>Состав:</b>\n{items_html}"

    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="👨‍🍳 Кухня (~15м)", callback_data=f"adm_st_{order_num}_cooking_15m"),
                InlineKeyboardButton(text="👨‍🍳 Кухня (~30м)", callback_data=f"adm_st_{order_num}_cooking_30m")
            ],
            [
                InlineKeyboardButton(text="🚴 Доставка (~20м)", callback_data=f"adm_st_{order_num}_delivering_20m"),
                InlineKeyboardButton(text="🚴 Доставка (~35м)", callback_data=f"adm_st_{order_num}_delivering_35m")
            ],
            [
                InlineKeyboardButton(text="✅ Выполнен", callback_data=f"adm_st_{order_num}_completed_0"),
                InlineKeyboardButton(text="❌ Отменить", callback_data=f"adm_st_{order_num}_cancelled_0")
            ]
        ]
    )

    for chat_id in admin_sessions:
        try:
            await admin_bot.send_message(chat_id=chat_id, text=alert_html, reply_markup=kb, parse_mode="HTML")
            logging.info(f"✅ Alert for order #{order_num} delivered to Admin chat {chat_id}")
        except Exception as e:
            logging.error(f"Failed sending order alert to admin chat {chat_id}: {e}")
