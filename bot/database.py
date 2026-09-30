import sqlite3
import json
from datetime import datetime

import os

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "store.db"))

def init_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    cursor = conn.cursor()

    # Enable WAL mode for concurrent access
    cursor.execute("PRAGMA journal_mode=WAL;")

    # Settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)

    # Orders table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE,
        user_id TEXT,
        user_name TEXT,
        username TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        items_json TEXT,
        total_price INTEGER,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending',
        status TEXT DEFAULT 'new',
        comment TEXT,
        estimated_time TEXT,
        status_note TEXT,
        status_updated_at TEXT,
        completed_at TEXT,
        eta_timestamp INTEGER,
        eta_minutes INTEGER,
        created_at TEXT
    )
    """)

    # Ensure optional columns exist if table was already created
    for col in ["email", "estimated_time", "status_note", "user_id", "status_updated_at", "completed_at", "eta_timestamp", "eta_minutes"]:
        try:
            cursor.execute(f"ALTER TABLE orders ADD COLUMN {col} TEXT")
        except sqlite3.OperationalError:
            pass

    # Indices for speed and isolation
    try:
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)")
    except Exception:
        pass

    # Products table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT,
        category TEXT,
        price INTEGER,
        old_price INTEGER,
        is_available INTEGER DEFAULT 1,
        badge TEXT,
        description TEXT,
        weight TEXT,
        image TEXT,
        calories INTEGER,
        proteins INTEGER,
        fats INTEGER,
        carbs INTEGER
    )
    """)

    for col in ["calories", "proteins", "fats", "carbs"]:
        try:
            cursor.execute(f"ALTER TABLE products ADD COLUMN {col} INTEGER")
        except sqlite3.OperationalError:
            pass

    ALL_PRODUCTS = [
        # id, name, category, price, old_price, is_available, badge, description, weight, image, calories, proteins, fats, carbs
        ('b1', 'Блэк Ангус Бургер', 'burgers', 490, 590, 1, 'Хит', 'Мраморная говядина Black Angus 200 дней зернового откорма, нежный сыр чеддер, хрустящий бекон, лук BBQ.', '360 г', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80', 940, 55, 52, 64),
        ('b2', 'Трюфельный Чизбургер', 'burgers', 590, None, 1, 'Шеф-выбор', 'Двойная котлета из говядины, соус с белым трюфелем, руккола, пармезан.', '380 г', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80', 1020, 57, 66, 50),
        ('b3', 'Криспи Чикен Бургер', 'burgers', 420, None, 1, '', 'Нежное филе цыпленка в хрустящей панировке panko, айсберг, ранч.', '320 г', 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600&auto=format&fit=crop&q=80', 730, 36, 38, 60),
        ('b4', 'Смоки Двойной Бекон Бургер', 'burgers', 620, 690, 1, 'Топ', 'Две сочные котлеты Black Angus, двойной бекон, чеддер, халапеньо, чипотле.', '420 г', 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=600&auto=format&fit=crop&q=80', 1140, 68, 74, 48),
        ('b5', 'Камамбер & Вишня Бургер', 'burgers', 560, None, 1, 'Новинка', 'Говяжья котлета, запеченный камамбер, пряный вишневый конфитюр, бриошь.', '350 г', 'https://images.unsplash.com/photo-1521305916504-4a1121188589?w=600&auto=format&fit=crop&q=80', 860, 48, 46, 62),
        ('st1', 'Стейк Рибай Прайм', 'steaks', 1390, 1550, 1, 'Шеф-выбор', 'Премиальный толстый край зернового откорма 180 дней на углях с розмарином.', '350 г', 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80', 890, 72, 66, 2),
        ('st2', 'Томленые BBQ Ребрышки', 'steaks', 790, None, 1, 'Хит', 'Свиные ребрышки 8-часового томления в смокере, глазурь бурбон-барбекю, картофель фри.', '450 г', 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80', 1180, 54, 78, 65),
        ('st3', 'Филе Лосося с диким рисом', 'steaks', 940, None, 1, '', 'Стейк из атлантического лосося, молодая спаржа на пару, дикий рис, соус голландез.', '310 г', 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&auto=format&fit=crop&q=80', 620, 42, 34, 36),
        ('st4', 'Том Ям с тигровыми креветками', 'steaks', 650, None, 1, 'Топ', 'Пряный тайский суп на кокосовом молоке с лемонграссом, шиитаке и тигровыми креветками.', '400 г', 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=600&auto=format&fit=crop&q=80', 480, 28, 22, 42),
        ('p1', 'Пицца Пепперони Премиум', 'pizza', 680, 750, 1, 'Топ', 'Пряная чоризо и пепперони, моцарелла фьор ди латте, Сан Марцано, базилик.', '550 г (30 см)', 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&auto=format&fit=crop&q=80', 1480, 64, 71, 145),
        ('p2', 'Пицца Четыре Сыра', 'pizza', 740, None, 1, '', 'Сливочная основа, моцарелла, горгонзола D.O.P., таледжо, выдержанный пармезан.', '520 г (30 см)', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80', 1470, 66, 73, 136),
        ('p3', 'Пицца Прошутто & Страчателла', 'pizza', 780, None, 1, 'Шеф-выбор', 'Пышный неаполитанский бортик, сливочная страчателла, прошутто ди парма, руккола.', '540 г (30 см)', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80', 1390, 62, 64, 142),
        ('p4', 'Паста Карбонара с гуанчале', 'pizza', 540, None, 1, 'Хит', 'Спагетти бронзовой матрицы, хрустящий сыровяленый гуанчале, желтки, пекорино романо.', '320 г', 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&auto=format&fit=crop&q=80', 780, 32, 42, 68),
        ('p5', 'Трюфельная Паста с белыми грибами', 'pizza', 590, None, 1, '', 'Тальятелле в сливочно-трюфельном соусе с белыми лесными грибами и пармезаном.', '340 г', 'https://images.unsplash.com/photo-1621996346565-e3d5d6281729?w=600&auto=format&fit=crop&q=80', 690, 24, 36, 68),
        ('a1', 'Хрустящие Креветки темпура', 'starters', 580, None, 1, 'Хит', 'Королевские креветки в легком кляре темпура со сладким соусом васаби-майо и миндалем.', '220 г', 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&auto=format&fit=crop&q=80', 460, 26, 24, 35),
        ('a2', 'Тартар из мраморной говядины', 'starters', 560, None, 1, 'Шеф-выбор', 'Рубленая вырезка Black Angus, каперсы, шалот, перепелиный желток, тосты тартин.', '190 г', 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80', 390, 31, 26, 8),
        ('a3', 'Боул с тунцом и авокадо', 'starters', 620, None, 1, 'Топ', 'Опаленный тунец в кунжуте, авокадо хасс, эдамаме, чука, киноа, понзу-дрессинг.', '340 г', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80', 510, 38, 18, 48),
        ('a4', 'Хрустящие баклажаны страчателла', 'starters', 460, None, 1, '', 'Баклажаны в кисло-сладком соусе, спелые томаты, страчателла, кинза, жареный кешью.', '280 г', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80', 420, 12, 28, 31),
        ('a5', 'Картофель Фри с трюфелем', 'starters', 320, None, 1, '', 'Хрустящие брусочки картофеля с морской солью, тертым пармезаном и трюфельным маслом.', '200 г', 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80', 480, 8, 26, 53),
        ('des1', 'Баскский Чизкейк Сан-Себастьян', 'desserts', 390, None, 1, 'Новинка', 'Карамелизованный обожженный чизкейк со сливочной тающей текстурой и ягодами.', '180 г', 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&auto=format&fit=crop&q=80', 580, 10, 46, 32),
        ('des2', 'Классический Тирамису', 'desserts', 420, None, 1, 'Хит', 'Фермерский маскарпоне, эспрессо, амаретто, бисквит савоярди и темное какао.', '190 г', 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80', 510, 9, 32, 47),
        ('des3', 'Шоколадный Фондан с пломбиром', 'desserts', 440, None, 1, '', 'Горячий кекс из темного бельгийского шоколада с жидким центром и шариком пломбира.', '160 г', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80', 620, 11, 38, 58),
        ('d1', 'Лимонад Малина-Маракуйя', 'drinks', 260, None, 1, '', 'Крафтовый освежающий лимонад из пюре маракуйи, свежей малины, мяты и минеральной воды.', '450 мл', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80', 125, 2, 1, 28),
        ('d2', 'Матча Латте на кокосовом', 'drinks', 310, None, 1, '', 'Японский чай матча сорта Удзи на органическом кокосовом молоке.', '350 мл', 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80', 170, 3, 8, 21),
        ('d3', 'Цитрусовый Бамбл Кофе', 'drinks', 290, None, 1, 'Топ', 'Двойной эспрессо 100% арабика, свежевыжатый сок апельсина и карамель со льдом.', '350 мл', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80', 140, 2, 1, 31),
        ('d4', 'Милкшейк Соленая Карамель & Oreo', 'drinks', 360, None, 1, '', 'Густой сливочный пломбирный коктейль с печеньем Oreo, взбитыми сливками и карамелью.', '400 мл', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop&q=80', 590, 12, 28, 72),
        ('d5', 'Смузи Манго-Ананас-Имбирь', 'drinks', 330, None, 1, 'Новинка', 'Густой детокс-смузи из спелого манго, свежего ананаса, кокосовой воды и имбиря.', '380 мл', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80', 180, 3, 2, 38)
    ]

    for p in ALL_PRODUCTS:
        cursor.execute("""
        INSERT INTO products (id, name, category, price, old_price, is_available, badge, description, weight, image, calories, proteins, fats, carbs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            category = excluded.category,
            badge = excluded.badge,
            description = excluded.description,
            weight = excluded.weight,
            image = excluded.image,
            calories = excluded.calories,
            proteins = excluded.proteins,
            fats = excluded.fats,
            carbs = excluded.carbs
        """, p)

    conn.commit()
    conn.close()

def _connect():
    """Helper to get a connection with WAL mode and timeout."""
    return sqlite3.connect(DB_PATH, timeout=10)

def set_setting(key: str, value: str):
    conn = _connect()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(value)))
    conn.commit()
    conn.close()

def get_setting(key: str, default=None):
    conn = _connect()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else default

def get_all_admin_sessions() -> list[int]:
    raw = get_setting("admin_sessions", "[]")
    try:
        data = json.loads(raw)
        return [int(x) for x in data if str(x) != "5847598677"]
    except Exception:
        return []

def add_admin_session(chat_id: int):
    sessions = get_all_admin_sessions()
    if chat_id not in sessions:
        sessions.append(chat_id)
        set_setting("admin_sessions", json.dumps(sessions))

def remove_admin_session(chat_id: int):
    sessions = get_all_admin_sessions()
    if chat_id in sessions:
        sessions.remove(chat_id)
        set_setting("admin_sessions", json.dumps(sessions))

def is_admin_session(chat_id: int) -> bool:
    return chat_id in get_all_admin_sessions()

def create_order(order_number, user_id, user_name, username, phone, email, address, items, total_price, payment_method, comment=""):
    conn = _connect()
    cursor = conn.cursor()
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    clean_user_id = str(user_id).strip() if user_id is not None else ""
    cursor.execute("""
    INSERT INTO orders (order_number, user_id, user_name, username, phone, email, address, items_json, total_price, payment_method, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        str(order_number).strip(), 
        clean_user_id, 
        user_name, 
        username, 
        phone,
        email,
        address, 
        json.dumps(items, ensure_ascii=False), 
        total_price, 
        payment_method, 
        comment, 
        created_at
    ))
    conn.commit()
    conn.close()

def get_orders(limit=100, status=None, user_id=None):
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    query = "SELECT * FROM orders WHERE 1=1"
    params = []
    if user_id is not None and str(user_id).strip() != "":
        query += " AND CAST(user_id AS TEXT) = ?"
        params.append(str(user_id).strip())
    if status:
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    orders = []
    for row in rows:
        o = dict(row)
        try:
            o['items'] = json.loads(o.get('items_json') or '[]')
        except Exception:
            o['items'] = []
        o['orderNumber'] = o.get('order_number')
        o['totalPrice'] = o.get('total_price')
        o['customerName'] = o.get('user_name')
        o['paymentMethod'] = o.get('payment_method')
        o['paymentStatus'] = o.get('payment_status')
        o['estimatedTime'] = o.get('estimated_time')
        o['statusNote'] = o.get('status_note')
        o['statusUpdatedAt'] = o.get('status_updated_at')
        o['completedAt'] = o.get('completed_at')
        o['etaTimestamp'] = o.get('eta_timestamp')
        o['etaMinutes'] = o.get('eta_minutes')
        o['createdAt'] = o.get('created_at')
        orders.append(o)
    conn.close()
    return orders

def get_order_by_number(order_number):
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE order_number = ?", (order_number,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    order = dict(row)
    try:
        order['items'] = json.loads(order.get('items_json') or '[]')
    except Exception:
        order['items'] = []
    order['orderNumber'] = order.get('order_number')
    order['totalPrice'] = order.get('total_price')
    order['customerName'] = order.get('user_name')
    order['paymentMethod'] = order.get('payment_method')
    order['paymentStatus'] = order.get('payment_status')
    order['estimatedTime'] = order.get('estimated_time')
    order['statusNote'] = order.get('status_note')
    order['statusUpdatedAt'] = order.get('status_updated_at')
    order['completedAt'] = order.get('completed_at')
    order['etaTimestamp'] = order.get('eta_timestamp')
    order['etaMinutes'] = order.get('eta_minutes')
    order['createdAt'] = order.get('created_at')
    conn.close()
    return order

def update_order_status(order_number, new_status, estimated_time=None, status_note=None, eta_minutes=None):
    conn = _connect()
    cursor = conn.cursor()
    now_dt = datetime.now()
    now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
    now_ts = int(now_dt.timestamp())

    fields = ["status = ?", "status_updated_at = ?"]
    params = [new_status, now_str]

    if new_status == "completed":
        fields.append("completed_at = ?")
        params.append(now_str)

    if estimated_time is not None:
        fields.append("estimated_time = ?")
        params.append(estimated_time)

    if status_note is not None:
        fields.append("status_note = ?")
        params.append(status_note)

    # Parse minutes for countdown
    mins = None
    if eta_minutes is not None and int(eta_minutes) > 0:
        mins = int(eta_minutes)
    elif estimated_time:
        import re
        m = re.search(r'\d+', str(estimated_time))
        if m:
            mins = int(m.group(0))

    if mins is not None:
        fields.append("eta_minutes = ?")
        params.append(mins)
        fields.append("eta_timestamp = ?")
        params.append(now_ts + mins * 60)

    params.append(str(order_number).strip())
    query = f"UPDATE orders SET {', '.join(fields)} WHERE order_number = ?"
    cursor.execute(query, tuple(params))
    conn.commit()
    conn.close()

def update_order_payment(order_number, payment_status):
    conn = _connect()
    cursor = conn.cursor()
    cursor.execute("UPDATE orders SET payment_status = ? WHERE order_number = ?", (payment_status, order_number))
    conn.commit()
    conn.close()

def delete_order(order_number):
    conn = _connect()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM orders WHERE order_number = ?", (order_number,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def clear_all_orders():
    """Delete ALL orders from the database and reset sequence."""
    conn = _connect()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM orders")
    count = cursor.rowcount
    try:
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='orders'")
    except Exception:
        pass
    conn.commit()
    conn.close()
    return count

def recreate_orders_table():
    """Drop and recreate the orders table completely."""
    conn = _connect()
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS orders")
    cursor.execute("""
    CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE,
        user_id TEXT,
        user_name TEXT,
        username TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        items_json TEXT,
        total_price INTEGER,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending',
        status TEXT DEFAULT 'new',
        comment TEXT,
        estimated_time TEXT,
        status_note TEXT,
        created_at TEXT
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)")
    conn.commit()
    conn.close()

def get_products():
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products ORDER BY category, id")
    rows = cursor.fetchall()
    prods = [dict(row) for row in rows]
    conn.close()
    return prods

def update_product_price(product_id, new_price):
    conn = _connect()
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET price = ? WHERE id = ?", (new_price, product_id))
    if cursor.rowcount == 0:
        cursor.execute("INSERT INTO products (id, price, is_available) VALUES (?, ?, 1)", (product_id, new_price))
    conn.commit()
    conn.close()

def toggle_product_availability(product_id):
    conn = _connect()
    cursor = conn.cursor()
    cursor.execute("SELECT is_available FROM products WHERE id = ?", (product_id,))
    row = cursor.fetchone()
    if row is None:
        cursor.execute("INSERT INTO products (id, is_available) VALUES (?, 0)", (product_id,))
        new_val = 0
    else:
        new_val = 0 if row[0] == 1 else 1
        cursor.execute("UPDATE products SET is_available = ? WHERE id = ?", (new_val, product_id))
    conn.commit()
    conn.close()
    return new_val

def get_analytics():
    conn = _connect()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*), COALESCE(SUM(total_price), 0) FROM orders")
    total_orders, total_revenue = cursor.fetchone()
    
    cursor.execute("SELECT COUNT(*) FROM orders WHERE status = 'new'")
    new_orders = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM orders WHERE status = 'cooking'")
    cooking_orders = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM orders WHERE status = 'delivering'")
    delivering_orders = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM orders WHERE status = 'completed'")
    completed_orders = cursor.fetchone()[0]
    
    conn.close()
    return {
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "new_orders": new_orders,
        "cooking_orders": cooking_orders,
        "delivering_orders": delivering_orders,
        "completed_orders": completed_orders
    }

init_db()
