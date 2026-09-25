import sqlite3
import json
from datetime import datetime

DB_PATH = "store.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Orders table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE,
        user_id INTEGER,
        user_name TEXT,
        username TEXT,
        phone TEXT,
        address TEXT,
        items_json TEXT,
        total_price INTEGER,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending',
        status TEXT DEFAULT 'new',
        comment TEXT,
        created_at TEXT
    )
    """)

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
            ('b2', 'Трюфельный Чизбургер', 'burgers', 590, 0, 1, 'Шеф-выбор', 'Двойная котлета из говядины, соус с белым трюфелем, руккола.', '380 г', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80'),
            ('b3', 'Криспи Чикен Бургер', 'burgers', 420, 0, 1, '', 'Нежное филе цыпленка в хрустящей панировке, айсберг, ранч.', '320 г', 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600&auto=format&fit=crop&q=80'),
            ('p1', 'Пицца Пепперони Премиум', 'pizza', 680, 750, 1, 'Топ', 'Пряная чоризо, моцарелла фьор ди латте, Сан Марцано.', '550 г (30 см)', 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&auto=format&fit=crop&q=80'),
            ('p2', 'Пицца Четыре Сыра', 'pizza', 740, 0, 1, '', 'Сливочная основа, моцарелла, горгонзола, таледжо, пармезан.', '520 г (30 см)', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80'),
            ('d1', 'Лимонад Малина-Маракуйя', 'drinks', 260, 0, 1, '', 'Крафтовый освежающий лимонад из натурального пюре.', '450 мл', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80'),
            ('d2', 'Матча Латте на кокосовом', 'drinks', 310, 0, 1, '', 'Японский чай матча на нежном кокосовом молоке.', '350 мл', 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80'),
            ('des1', 'Баскский Чизкейк', 'desserts', 390, 0, 1, 'Новинка', 'Карамелизованная корочка и нежная сливочная середина.', '180 г', 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&auto=format&fit=crop&q=80')
        ]
        cursor.executemany("""
        INSERT INTO products (id, name, category, price, old_price, is_available, badge, description, weight, image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, initial_products)

    conn.commit()
    conn.close()

def create_order(order_number, user_id, user_name, username, phone, address, items, total_price, payment_method, comment=""):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
    INSERT INTO orders (order_number, user_id, user_name, username, phone, address, items_json, total_price, payment_method, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        order_number, 
        user_id, 
        user_name, 
        username, 
        phone, 
        address, 
        json.dumps(items, ensure_ascii=False), 
        total_price, 
        payment_method, 
        comment, 
        created_at
    ))
    conn.commit()
    conn.close()

def get_orders(limit=20, status=None):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    if status:
        cursor.execute("SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT ?", (status, limit))
    else:
        cursor.execute("SELECT * FROM orders ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    orders = [dict(row) for row in rows]
    for o in orders:
        try:
            o['items'] = json.loads(o['items_json'])
        except:
            o['items'] = []
    conn.close()
    return orders

def get_order_by_number(order_number):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE order_number = ?", (order_number,))
    row = cursor.fetchone()
    order = dict(row) if row else None
    if order:
        try:
            order['items'] = json.loads(order['items_json'])
        except:
            order['items'] = []
    conn.close()
    return order

def update_order_status(order_number, new_status):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE orders SET status = ? WHERE order_number = ?", (new_status, order_number))
    conn.commit()
    conn.close()

def update_order_payment(order_number, payment_status):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE orders SET payment_status = ? WHERE order_number = ?", (payment_status, order_number))
    conn.commit()
    conn.close()

def get_products():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products ORDER BY category, id")
    rows = cursor.fetchall()
    prods = [dict(row) for row in rows]
    conn.close()
    return prods

def update_product_price(product_id, new_price):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET price = ? WHERE id = ?", (new_price, product_id))
    conn.commit()
    conn.close()

def toggle_product_availability(product_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE products SET is_available = CASE WHEN is_available = 1 THEN 0 ELSE 1 END WHERE id = ?", (product_id,))
    cursor.execute("SELECT is_available FROM products WHERE id = ?", (product_id,))
    new_val = cursor.fetchone()[0]
    conn.commit()
    conn.close()
    return new_val

def get_analytics():
    conn = sqlite3.connect(DB_PATH)
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
