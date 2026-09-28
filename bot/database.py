import sqlite3
import json
from datetime import datetime

DB_PATH = "store.db"

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
        created_at TEXT
    )
    """)

    # Ensure optional columns exist if table was already created
    for col in ["email", "estimated_time", "status_note", "user_id"]:
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
        image TEXT
    )
    """)

    # Seed products if empty
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        initial_products = [
            ('b1', 'Блэк Ангус Бургер', 'burgers', 490, 590, 1, 'Хит', 'Мраморная говядина, сыр чеддер, хрустящий бекон, лук BBQ.', '360 г', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80'),
            ('b2', 'Трюфельный Чизбургер', 'burgers', 590, None, 1, 'Шеф-выбор', 'Двойная котлета из говядины, соус с белым трюфелем, руккола.', '380 г', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80'),
            ('b3', 'Криспи Чикен Бургер', 'burgers', 420, None, 1, '', 'Нежное филе цыпленка в хрустящей панировке, айсберг, ранч.', '320 г', 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600&auto=format&fit=crop&q=80'),
            ('p1', 'Пицца Пепперони Премиум', 'pizza', 680, 750, 1, 'Топ', 'Пряная чоризо, моцарелла фьор ди латте, Сан Марцано.', '550 г (30 см)', 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&auto=format&fit=crop&q=80'),
            ('p2', 'Пицца Четыре Сыра', 'pizza', 740, None, 1, '', 'Сливочная основа, моцарелла, горгонзола, таледжо, пармезан.', '520 г (30 см)', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80'),
            ('d1', 'Лимонад Малина-Маракуйя', 'drinks', 260, None, 1, '', 'Крафтовый освежающий лимонад из натурального пюре.', '450 мл', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80'),
            ('d2', 'Матча Латте на кокосовом', 'drinks', 310, None, 1, '', 'Японский чай матча на нежном кокосовом молоке.', '350 мл', 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80'),
            ('des1', 'Баскский Чизкейк', 'desserts', 390, None, 1, 'Новинка', 'Карамелизованная корочка и нежная сливочная середина.', '180 г', 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&auto=format&fit=crop&q=80')
        ]
        cursor.executemany("""
        INSERT INTO products (id, name, category, price, old_price, is_available, badge, description, weight, image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, initial_products)

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
    order['createdAt'] = order.get('created_at')
    conn.close()
    return order

def update_order_status(order_number, new_status, estimated_time=None, status_note=None):
    conn = _connect()
    cursor = conn.cursor()
    if estimated_time is not None and status_note is not None:
        cursor.execute("UPDATE orders SET status = ?, estimated_time = ?, status_note = ? WHERE order_number = ?", 
                       (new_status, estimated_time, status_note, order_number))
    elif estimated_time is not None:
        cursor.execute("UPDATE orders SET status = ?, estimated_time = ? WHERE order_number = ?", 
                       (new_status, estimated_time, order_number))
    elif status_note is not None:
        cursor.execute("UPDATE orders SET status = ?, status_note = ? WHERE order_number = ?", 
                       (new_status, status_note, order_number))
    else:
        cursor.execute("UPDATE orders SET status = ? WHERE order_number = ?", (new_status, order_number))
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
