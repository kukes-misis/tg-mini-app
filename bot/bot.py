import asyncio
import html
import json
import logging
import os
import random
import time
from aiohttp import web
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    InlineKeyboardMarkup, 
    InlineKeyboardButton, 
    WebAppInfo,
    ReplyKeyboardMarkup,
    KeyboardButton
)
from config import BOT_TOKEN, WEBAPP_URL, ADMIN_BOT_TOKEN
import database as db
from admin_bot import admin_bot, admin_dp, broadcast_order_to_admins

logging.basicConfig(level=logging.INFO)

# Client Customer Bot
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

def get_customer_keyboard():
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
    user_name = user.first_name if user else "друг"

    welcome_text = (
        f"👋 <b>Здравствуйте, {html.escape(user_name)}!</b>\n\n"
        "Добро пожаловать в ресторан авторской кухни <b>Vibe Kitchen</b>!\n\n"
        "Всё меню с подробным составом блюд, КБЖУ, оформление заказа и отслеживание стадий приготовления доступны в нашем приложении 👇"
    )
    await message.answer(
        welcome_text, 
        reply_markup=get_customer_keyboard(),
        parse_mode="HTML"
    )

@dp.message(F.text == "💬 Поддержка")
@dp.message(Command("support"))
async def handle_support(message: types.Message):
    text = (
        "💬 <b>Служба заботы и поддержки Vibe Kitchen</b>\n\n"
        "Мы на связи 24/7 и готовы помочь:\n"
        "• Уточнить детали или статус вашего заказа\n"
        "• Вопросы по меню и аллергенам\n"
        "• Заказ разработки Telegram Mini App для вашего бизнеса\n\n"
        "Нажмите кнопку ниже, чтобы связаться с оператором 👇"
    )
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="💬 Написать в поддержку (@qqeaux)", url="https://t.me/qqeaux")
            ],
            [
                InlineKeyboardButton(text="🛍️ Перейти в меню", web_app=WebAppInfo(url=WEBAPP_URL))
            ]
        ]
    )
    await message.answer(text, reply_markup=kb, parse_mode="HTML")

@dp.message(Command("admin"))
async def handle_client_admin(message: types.Message):
    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="⚡ Открыть панель управления (Mini App)", 
                    web_app=WebAppInfo(url=f"{WEBAPP_URL}?admin=1")
                )
            ]
        ]
    )
    await message.answer(
        "👑 <b>Панель управления Vibe Kitchen</b>\n\n"
        "Нажмите кнопку ниже, чтобы открыть диспетчерскую в Mini App в стиле MPSTATS.\n"
        "При первом входе введите логин и пароль.",
        reply_markup=kb,
        parse_mode="HTML"
    )

# --- ORDER PROCESSING & CLIENT CONFIRMATION ---

PROCESSED_ORDERS: dict[str, float] = {}

async def process_order_data(data: dict, user=None, message: types.Message | None = None, source: str = "webapp"):
    order_num = str(data.get("orderNumber") or random.randint(100000, 999999))
    now = time.time()

    # Clean up stale entries older than 5 minutes
    stale_keys = [k for k, v in PROCESSED_ORDERS.items() if now - v > 300]
    for k in stale_keys:
        del PROCESSED_ORDERS[k]

    # Deduplicate alerts within 60s
    is_duplicate = False
    if order_num in PROCESSED_ORDERS and (now - PROCESSED_ORDERS[order_num]) < 60:
        is_duplicate = True
    PROCESSED_ORDERS[order_num] = now

    user_id = str(user.id) if user else str(data.get("userId") or data.get("user_id") or "").strip()
    username = (user.username if user else str(data.get("username") or "")).lstrip("@").strip()
    first_name = user.first_name if user else "Клиент"

    # If username is missing but user_id is a Telegram numeric ID, try resolving it via Telegram API
    if user_id and user_id.isdigit() and not username:
        try:
            tg_chat = await bot.get_chat(int(user_id))
            if tg_chat:
                if tg_chat.username:
                    username = tg_chat.username.lstrip("@").strip()
                    logging.info(f"Resolved Telegram @{username} for user_id {user_id}")
                if not data.get("customerName") or data.get("customerName") == "Клиент":
                    resolved_name = f"{tg_chat.first_name or ''} {tg_chat.last_name or ''}".strip()
                    if resolved_name:
                        data["customerName"] = resolved_name
        except Exception as e:
            logging.debug(f"Could not resolve Telegram chat for user {user_id}: {e}")

    # Synchronize resolved fields back into order payload
    data["userId"] = user_id
    data["username"] = username

    items = data.get("items", [])
    total_price = data.get("totalPrice", 0)
    customer_name = data.get("customerName", first_name)
    phone = data.get("phone", "")
    email = data.get("email", "")
    address = data.get("address", "")
    comment = data.get("comment", "")
    payment_method = data.get("paymentMethod", "cash")
    payment_str = "При получении (наличные или карта)"

    # Save order in SQLite DB
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
        logging.info(f"Order #{order_num} successfully saved to DB (source: {source}, user: @{username or 'none'})")
    except Exception as e:
        logging.error(f"Order #{order_num} DB ERROR: {e}", exc_info=True)
        raise e

    # Build customer receipt
    items_text = ""
    for i, item in enumerate(items, 1):
        items_text += f"{i}. {item.get('name', 'Товар')} × {item.get('quantity', 1)} шт. — {item.get('price', 0) * item.get('quantity', 1)} ₽\n"

    if message:
        receipt_text = (
            f"🎉 <b>Ваш заказ #{order_num} успешно принят рестораном!</b>\n\n"
            f"📋 <b>Состав заказа:</b>\n{items_text}\n"
            f"💵 <b>Итого к оплате:</b> {total_price} ₽\n"
            f"💳 <b>Способ оплаты:</b> {payment_str}\n\n"
            f"👤 <b>Получатель:</b> {html.escape(customer_name)}\n"
            f"📞 <b>Телефон:</b> {html.escape(phone)}\n"
            f"📍 <b>Адрес доставки:</b> {html.escape(address)}\n"
        )
        if comment:
            receipt_text += f"💬 <b>Комментарий:</b> {html.escape(comment)}\n"
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
            await message.answer(receipt_text, reply_markup=receipt_kb, parse_mode="HTML")
        except Exception:
            await message.answer(receipt_text, reply_markup=receipt_kb)

    # Broadcast instant push notification to the dedicated Admin Bot
    if not is_duplicate:
        try:
            await broadcast_order_to_admins(data)
        except Exception as e:
            logging.error(f"Error broadcasting order #{order_num} to Admin Bot: {e}")

@dp.message(F.content_type == types.ContentType.WEB_APP_DATA)
async def handle_webapp_data(message: types.Message):
    raw_data = message.web_app_data.data
    user = message.from_user
    try:
        data = json.loads(raw_data)
        await process_order_data(data, user=user, message=message, source="webapp")
    except Exception as e:
        logging.error(f"Error parsing web_app_data: {e}", exc_info=True)
        await message.answer(f"✅ Заказ принят!")

# --- HTTP REST API SERVER (FOR MINI APP) ---

async def health_check(request):
    return web.Response(text="Vibe Kitchen API & Dual Bots running 24/7!", content_type="text/plain")

async def handle_cors_options(request):
    return web.Response(
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Pragma, Cache-Control",
        }
    )

async def handle_api_orders(request):
    try:
        data = await request.json()
        await process_order_data(data, user=None, message=None, source="api")
        return web.json_response({"ok": True, "orderNumber": data.get("orderNumber")}, headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        logging.error(f"Error in handle_api_orders: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500, headers={"Access-Control-Allow-Origin": "*"})

async def handle_get_orders(request):
    try:
        user_id = request.query.get("userId") or request.query.get("user_id")
        is_admin_req = (request.headers.get("X-Admin-Token") == ADMIN_BOT_TOKEN) or (request.query.get("admin") == "1")

        # Security: unauthenticated client request without userId receives empty list
        if not user_id and not is_admin_req:
            return web.json_response([], headers={"Access-Control-Allow-Origin": "*"})

        orders = db.get_orders(limit=100, user_id=str(user_id).strip() if not is_admin_req else None)
        return web.json_response(orders, headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        logging.error(f"Error getting orders: {e}")
        return web.json_response([], headers={"Access-Control-Allow-Origin": "*"})

async def handle_delete_order(request):
    try:
        data = await request.json()
        order_num = data.get("orderNumber") or data.get("order_number")
        if order_num:
            deleted = db.delete_order(str(order_num).strip())
            return web.json_response({"ok": True, "deleted": deleted, "orderNumber": str(order_num).strip()}, headers={"Access-Control-Allow-Origin": "*"})
        return web.json_response({"ok": False, "error": "orderNumber required"}, status=400, headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        logging.error(f"Error deleting order: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500, headers={"Access-Control-Allow-Origin": "*"})

async def handle_clear_all_orders(request):
    try:
        count = db.clear_all_orders()
        logging.info(f"Orders cleared via API. Total deleted: {count}")
        return web.json_response({"ok": True, "deletedCount": count}, headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        logging.error(f"Error clearing all orders: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500, headers={"Access-Control-Allow-Origin": "*"})

async def handle_update_order_status(request):
    try:
        data = await request.json()
        order_num = data.get("orderNumber")
        new_status = data.get("status")
        estimated_time = data.get("estimatedTime")
        status_note = data.get("statusNote")
        eta_minutes = data.get("etaMinutes")
        if not order_num or not new_status:
            return web.json_response({"ok": False, "error": "Invalid params"}, status=400, headers={"Access-Control-Allow-Origin": "*"})

        db.update_order_status(order_num, new_status, estimated_time=estimated_time, status_note=status_note, eta_minutes=eta_minutes)
        order = db.get_order_by_number(order_num)
        if order and order.get('user_id'):
            eta_info = f"\n⏱ <b>Примерное время:</b> {html.escape(estimated_time)}" if estimated_time else ""
            note_info = f"\n💬 <b>Примечание от ресторана:</b> {html.escape(status_note)}" if status_note else ""

            status_client_msgs = {
                "cooking": f"👨‍🍳 <b>Ваш заказ #{order_num} передан на кухню и уже готовится!</b>{eta_info}{note_info}\n\nШеф-повар собирает ингредиенты. Вы можете следить за стадиями прямо в приложении.",
                "delivering": f"🚴 <b>Курьер забрал заказ #{order_num} и выехал!</b>{eta_info}{note_info}\n\nАдрес доставки: {html.escape(order.get('address', ''))}. Скоро будем у вас.",
                "completed": f"🎉 <b>Заказ #{order_num} успешно доставлен!</b>{note_info}\n\nПриятного аппетита! Будем рады вашему отзыву.",
                "cancelled": f"❌ <b>Заказ #{order_num} был отменен.</b>{note_info}\n\nЕсли у вас есть вопросы, служба заботы всегда на связи в приложении."
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
        formatted = []
        for p in products:
            is_avail = bool(p.get("is_available", 1))
            raw_old = p.get("old_price")
            cur_price = p.get("price")
            try:
                clean_old_price = int(raw_old) if raw_old and int(raw_old) > 0 else None
                if clean_old_price is not None and cur_price is not None and clean_old_price <= cur_price:
                    clean_old_price = None
            except Exception:
                clean_old_price = None
            formatted.append({
                "id": p["id"],
                "name": p.get("name"),
                "price": cur_price,
                "oldPrice": clean_old_price,
                "old_price": clean_old_price,
                "isAvailable": is_avail,
                "is_available": 1 if is_avail else 0,
                "category": p.get("category"),
                "badge": p.get("badge"),
                "description": p.get("description"),
                "weight": p.get("weight"),
                "image": p.get("image"),
                "calories": p.get("calories"),
                "proteins": p.get("proteins"),
                "fats": p.get("fats"),
                "carbs": p.get("carbs")
            })
        return web.json_response(formatted, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        })
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
async def handle_debug_status(request):
    try:
        conn = db._connect()
        cursor = conn.cursor()
        order_count = cursor.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
        recent_orders = cursor.execute("SELECT id, order_number, user_id, user_name, total_price, created_at FROM orders ORDER BY id DESC LIMIT 10").fetchall()
        schema = cursor.execute("PRAGMA table_info(orders)").fetchall()
        conn.close()
        return web.json_response({
            "db_path": db.DB_PATH,
            "cwd": os.getcwd(),
            "order_count": order_count,
            "recent_orders": [list(r) for r in recent_orders],
            "schema": [list(s) for s in schema]
        }, headers={"Access-Control-Allow-Origin": "*"})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500, headers={"Access-Control-Allow-Origin": "*"})

async def start_web_server():
    app = web.Application()
    app.router.add_get("/", health_check)
    app.router.add_get("/health", health_check)
    
    # Orders API
    app.router.add_get("/api/orders", handle_get_orders)
    app.router.add_post("/api/orders", handle_api_orders)
    app.router.add_post("/api/orders/delete", handle_delete_order)
    app.router.add_post("/api/orders/clear-all", handle_clear_all_orders)
    app.router.add_post("/api/orders/status", handle_update_order_status)

    # Products API
    app.router.add_get("/api/products", handle_get_products)
    app.router.add_post("/api/products/price", handle_update_price)
    app.router.add_post("/api/products/toggle", handle_toggle_product)

    # Diagnostic API
    app.router.add_get("/api/debug-status", handle_debug_status)

    # CORS Preflight
    app.router.add_route("OPTIONS", "/{tail:.*}", handle_cors_options)
    
    port = int(os.getenv("PORT", 8080))
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    logging.info(f"Web server started on port {port}")

async def main():
    logging.info("🤖 Starting Dual Bots: Customer Bot & Dedicated Admin Bot...")
    await start_web_server()
    await bot.delete_webhook(drop_pending_updates=True)
    await admin_bot.delete_webhook(drop_pending_updates=True)

    try:
        await bot.set_chat_menu_button(
            menu_button=types.MenuButtonWebApp(
                text="Ресторан & Меню",
                web_app=WebAppInfo(url=WEBAPP_URL)
            )
        )
    except Exception as e:
        logging.warning(f"Could not set chat menu button: {e}")

    # Concurrently run polling for both bots!
    await asyncio.gather(
        dp.start_polling(bot),
        admin_dp.start_polling(admin_bot)
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logging.info("Bots stopped.")
