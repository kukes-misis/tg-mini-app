import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  X, 
  Clock, 
  MapPin, 
  Phone, 
  Mail,
  User, 
  CheckCircle2, 
  Sparkles,
  CreditCard,
  Banknote,
  Package,
  Layers,
  Edit2,
  Check,
  TrendingUp,
  ArrowLeft,
  KeyRound,
  ShieldAlert,
  BellRing,
  RefreshCw
} from 'lucide-react';
import { CATEGORIES, PRODUCTS as INITIAL_PRODUCTS } from './data/products';
import { Product, CartItem, OrderData, OrderStatus } from './types';

// Helper: Format Russian Phone Number Mask
function formatRussianPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('8')) {
    digits = '7' + digits.slice(1);
  } else if (!digits.startsWith('7') && digits.length > 0) {
    digits = '7' + digits;
  }
  digits = digits.slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 1) return '+7';
  if (digits.length <= 4) return `+7 (${digits.slice(1)}`;
  if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
  if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
}

// Validation helpers
function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  // Must be 11 digits and start with 79... (Russian mobile numbers)
  return digits.length === 11 && digits.startsWith('79');
}

function isValidName(name: string): boolean {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  if (words.length < 2) return false;
  // Only letters and hyphens
  const nameRegex = /^[A-Za-zА-Яа-яЁё\-]+$/;
  return words.every(w => w.length >= 2 && nameRegex.test(w));
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

function isValidAddress(address: string): boolean {
  const trimmed = address.trim();
  // At least 8 chars and contains at least one digit (house number)
  return trimmed.length >= 8 && /\d/.test(trimmed);
}

// Initial demo orders for admin
const INITIAL_DEMO_ORDERS: OrderData[] = [
  {
    id: 'ord-1024',
    orderNumber: '1024',
    customerName: 'Алексей Смирнов',
    phone: '+7 (926) 450-12-88',
    email: 'alex.smirnov@yandex.ru',
    address: 'г. Москва, ул. Тверская, д. 14, кв. 32',
    comment: 'Код домофона 32К',
    totalPrice: 1760,
    paymentMethod: 'online',
    paymentStatus: 'paid',
    status: 'cooking',
    createdAt: '15 минут назад',
    items: [
      { id: 'b1', name: 'Блэк Ангус Бургер', quantity: 2, price: 490 },
      { id: 'p1', name: 'Пицца Пепперони Премиум', quantity: 1, price: 680 },
      { id: 'd1', name: 'Лимонад Малина-Маракуйя', quantity: 1, price: 260 }
    ]
  },
  {
    id: 'ord-1023',
    orderNumber: '1023',
    customerName: 'Мария Васильева',
    phone: '+7 (916) 880-99-11',
    email: 'mariya.v@mail.ru',
    address: 'г. Москва, Ленинский проспект, 45, корп. 2, кв. 10',
    comment: 'Позвонить за 5 минут до приезда',
    totalPrice: 900,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    status: 'new',
    createdAt: '32 минуты назад',
    items: [
      { id: 'b2', name: 'Трюфельный Чизбургер', quantity: 1, price: 590 },
      { id: 'd2', name: 'Матча Латте на кокосовом', quantity: 1, price: 310 }
    ]
  }
];

export function App() {
  // Products state (persisted in localStorage)
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('tg_store_products');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_PRODUCTS.map(p => ({ ...p, isAvailable: true }));
  });

  // Orders state (persisted in localStorage)
  const [orders, setOrders] = useState<OrderData[]>(() => {
    const saved = localStorage.getItem('tg_store_orders');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_DEMO_ORDERS;
  });

  // Admin access state
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminTab, setAdminTab] = useState<'orders' | 'products' | 'analytics'>('orders');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);

  // Client view state
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<OrderData | null>(null);

  // Checkout form state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('online');

  // Form errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Secret tap counter for developer browser testing
  const [secretTaps, setSecretTaps] = useState(0);

  // Save products
  useEffect(() => {
    localStorage.setItem('tg_store_products', JSON.stringify(products));
  }, [products]);

  // Save orders
  useEffect(() => {
    localStorage.setItem('tg_store_orders', JSON.stringify(orders));
  }, [orders]);

  // Check admin: @qqeaux or @eccdk or ID 5847598677
  const isActualAdmin = useMemo(() => {
    const tgUsername = window.Telegram?.WebApp?.initDataUnsafe?.user?.username?.toLowerCase() || '';
    const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (tgUsername === 'qqeaux' || tgUsername === 'eccdk' || tgId === 5847598677) return true;
    if (secretTaps >= 5) return true;
    return false;
  }, [secretTaps]);

  // Telegram WebApp initialization
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
      if (tgUser?.first_name) {
        setCustomerName(tgUser.first_name + (tgUser.last_name ? ` ${tgUser.last_name}` : ''));
      }
    }
  }, []);


  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      if (type === 'success' || type === 'error') {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred(type);
      } else {
        window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
      }
    }
  };

  // Cart operations
  const addToCart = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product && product.isAvailable === false) {
      alert('Этот товар временно в стоп-листе');
      return;
    }
    triggerHaptic('light');
    setCart(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  };

  const removeFromCart = (productId: string) => {
    triggerHaptic('light');
    setCart(prev => {
      const current = prev[productId] || 0;
      if (current <= 1) {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      }
      return { ...prev, [productId]: current - 1 };
    });
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const prod = products.find(p => p.id === id);
        return prod ? { product: prod, quantity: qty } : null;
      })
      .filter((item): item is CartItem => item !== null);
  }, [cart, products]);

  const totalQuantity = useMemo(() => {
    return Object.values(cart).reduce((sum, q) => sum + q, 0);
  }, [cart]);

  const totalPrice = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cartItems]);

  // Phone input mask handler
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRussianPhone(e.target.value);
    setPhone(formatted);
    if (errors.phone) {
      setErrors(prev => ({ ...prev, phone: '' }));
    }
  };

  // Direct order submit (without verification code)
  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!isValidName(customerName)) {
      newErrors.name = 'Укажите реальные Имя и Фамилию через пробел (например: Иван Иванов)';
    }

    if (!isValidPhone(phone)) {
      newErrors.phone = 'Укажите реальный мобильный номер РФ (+7 9XX XXX-XX-XX)';
    }

    if (!isValidEmail(email)) {
      newErrors.email = 'Укажите корректный email (например: ivan@yandex.ru)';
    }

    if (!isValidAddress(address)) {
      newErrors.address = 'Укажите полный адрес (город, улица, номер дома и кв)';
    }

    if (Object.keys(newErrors).length > 0) {
      triggerHaptic('error');
      setErrors(newErrors);
      return;
    }

    setErrors({});
    triggerHaptic('success');

    const orderNum = String(Math.floor(1000 + Math.random() * 9000));
    const newOrder: OrderData = {
      id: `ord-${orderNum}`,
      orderNumber: orderNum,
      items: cartItems.map(item => ({
        id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price
      })),
      totalPrice,
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      comment: comment.trim(),
      paymentMethod,
      paymentStatus: paymentMethod === 'online' ? 'paid' : 'pending',
      status: 'new',
      createdAt: 'Только что'
    };

    // Send payload to Telegram Bot
    if (window.Telegram?.WebApp?.sendData) {
      window.Telegram.WebApp.sendData(JSON.stringify(newOrder));
    }

    // Save to local admin orders list
    setOrders(prev => [newOrder, ...prev]);

    setIsCartOpen(false);
    setCart({});
    setOrderSuccess(newOrder);
  };

  // Admin actions
  const toggleProductAvailability = (productId: string) => {
    triggerHaptic('medium');
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return { ...p, isAvailable: p.isAvailable === false ? true : false };
      }
      return p;
    }));
  };

  const handleStartPriceEdit = (product: Product) => {
    setEditingPriceId(product.id);
    setTempPrice(product.price);
  };

  const handleSavePrice = (productId: string) => {
    triggerHaptic('success');
    if (tempPrice > 0) {
      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
          return { ...p, price: tempPrice };
        }
        return p;
      }));
    }
    setEditingPriceId(null);
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    triggerHaptic('medium');
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { ...o, status: newStatus };
      }
      return o;
    }));
  };

  const handleTogglePaymentStatus = (orderId: string) => {
    triggerHaptic('light');
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { ...o, paymentStatus: o.paymentStatus === 'paid' ? 'pending' : 'paid' };
      }
      return o;
    }));
  };

  // Metrics
  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, o) => sum + o.totalPrice, 0);
  }, [orders]);

  const activeOrdersCount = useMemo(() => {
    return orders.filter(o => o.status === 'new' || o.status === 'cooking' || o.status === 'delivering').length;
  }, [orders]);

  // ================= ADMIN DASHBOARD VIEW =================
  if (isAdminMode && isActualAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 pb-20">
        <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                👑
              </div>
              <div>
                <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">Панель управления</div>
                <div className="text-sm font-extrabold text-white">Администратор @qqeaux</div>
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                setIsAdminMode(false);
              }}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>В магазин</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
              <div className="text-[10px] text-slate-400">Выручка</div>
              <div className="text-sm font-black text-amber-400">{totalRevenue} ₽</div>
            </div>
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
              <div className="text-[10px] text-slate-400">В работе</div>
              <div className="text-sm font-black text-blue-400">{activeOrdersCount} зак.</div>
            </div>
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
              <div className="text-[10px] text-slate-400">Позиций</div>
              <div className="text-sm font-black text-emerald-400">{products.length} шт.</div>
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-slate-800/80 mt-3">
            <button
              onClick={() => { triggerHaptic('light'); setAdminTab('orders'); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                adminTab === 'orders' 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Заказы ({orders.length})</span>
            </button>
            <button
              onClick={() => { triggerHaptic('light'); setAdminTab('products'); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                adminTab === 'products' 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Товары и Цены</span>
            </button>
            <button
              onClick={() => { triggerHaptic('light'); setAdminTab('analytics'); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                adminTab === 'analytics' 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Метрики</span>
            </button>
          </div>
        </header>

        {/* Tab 1: Orders Management */}
        {adminTab === 'orders' && (
          <main className="max-w-md mx-auto p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Все заказы</h2>
              <span className="text-[11px] text-slate-500">Автообновление</span>
            </div>

            {orders.map(order => {
              const statusColors = {
                new: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                cooking: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                delivering: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                cancelled: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              };

              const statusLabels = {
                new: '🟡 Новый',
                cooking: '👨‍🍳 Готовится',
                delivering: '🚴 В пути',
                completed: '✅ Выполнен',
                cancelled: '❌ Отменен'
              };

              return (
                <div 
                  key={order.id}
                  className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700/80 space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-base">#{order.orderNumber}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[order.status || 'new']}`}>
                          {statusLabels[order.status || 'new']}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{order.createdAt}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-amber-400">{order.totalPrice} ₽</div>
                      <button
                        onClick={() => handleTogglePaymentStatus(order.id!)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md mt-1 cursor-pointer transition-all ${
                          order.paymentStatus === 'paid' 
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' 
                            : 'bg-rose-950 text-rose-300 border border-rose-700'
                        }`}
                      >
                        {order.paymentStatus === 'paid' ? '💳 Оплачен онлайн' : '⏳ Ждет оплаты'}
                      </button>
                    </div>
                  </div>

                  {/* Verified Customer info with email and phone */}
                  <div className="bg-slate-900/80 rounded-xl p-2.5 text-xs space-y-1.5 border border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">ФИО клиента:</span>
                      <span className="font-semibold text-slate-200">{order.customerName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Телефон (проверен):</span>
                      <a href={`tel:${order.phone}`} className="font-bold text-blue-400">{order.phone}</a>
                    </div>
                    {order.email && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Email:</span>
                        <span className="font-medium text-slate-300">{order.email}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Адрес:</span>
                      <span className="font-medium text-slate-300 truncate max-w-[200px]">{order.address}</span>
                    </div>
                    {order.comment && (
                      <div className="pt-1 text-[11px] text-amber-200/90 italic">
                        💬 «{order.comment}»
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div className="text-xs space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Позиции заказа:</div>
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-slate-300">
                        <span>• {it.name} × {it.quantity}</span>
                        <span className="text-slate-400">{it.price * it.quantity} ₽</span>
                      </div>
                    ))}
                  </div>

                  {/* Status Change Buttons */}
                  <div className="pt-2 border-t border-slate-700/60 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => handleUpdateOrderStatus(order.id!, 'cooking')}
                      className="flex-1 py-1.5 px-2 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 rounded-lg text-xs font-semibold border border-blue-500/30"
                    >
                      👨‍🍳 В готовку
                    </button>
                    <button
                      onClick={() => handleUpdateOrderStatus(order.id!, 'delivering')}
                      className="flex-1 py-1.5 px-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded-lg text-xs font-semibold border border-purple-500/30"
                    >
                      🚴 В доставку
                    </button>
                    <button
                      onClick={() => handleUpdateOrderStatus(order.id!, 'completed')}
                      className="flex-1 py-1.5 px-2 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 rounded-lg text-xs font-semibold border border-emerald-500/30"
                    >
                      ✅ Доставлен
                    </button>
                    <button
                      onClick={() => handleUpdateOrderStatus(order.id!, 'cancelled')}
                      className="py-1.5 px-2.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 rounded-lg text-xs font-semibold border border-rose-500/30"
                    >
                      ❌
                    </button>
                  </div>
                </div>
              );
            })}
          </main>
        )}

        {/* Tab 2: Products & Prices Management */}
        {adminTab === 'products' && (
          <main className="max-w-md mx-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Каталог товаров и цены</h2>
              <span className="text-[11px] text-amber-400 font-medium">Мгновенное применение</span>
            </div>

            {products.map(product => {
              const isEditing = editingPriceId === product.id;
              const isAvailable = product.isAvailable !== false;

              return (
                <div 
                  key={product.id}
                  className={`rounded-2xl p-3.5 border transition-all ${
                    isAvailable 
                      ? 'bg-slate-800 border-slate-700' 
                      : 'bg-slate-900 border-rose-900/50 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-14 h-14 object-cover rounded-xl bg-slate-700"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-white line-clamp-1">{product.name}</h3>
                        {product.badge && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-sm font-semibold">
                            {product.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{product.weight}</div>

                      <div className="mt-2 flex items-center justify-between">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={tempPrice}
                              onChange={(e) => setTempPrice(Number(e.target.value))}
                              className="w-20 px-2 py-1 bg-slate-950 border border-amber-500 rounded-lg text-sm text-white font-bold"
                            />
                            <span className="text-xs text-slate-400">₽</span>
                            <button
                              onClick={() => handleSavePrice(product.id)}
                              className="w-7 h-7 bg-amber-500 text-slate-950 rounded-lg flex items-center justify-center font-bold"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-black text-amber-400 text-base">{product.price} ₽</span>
                            <button
                              onClick={() => handleStartPriceEdit(product)}
                              className="text-slate-400 hover:text-amber-400 p-1 rounded-md"
                              title="Изменить цену"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => toggleProductAvailability(product.id)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                            isAvailable
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {isAvailable ? '🟢 В наличии' : '🔴 Стоп-лист'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </main>
        )}

        {/* Tab 3: Analytics */}
        {adminTab === 'analytics' && (
          <main className="max-w-md mx-auto p-4 space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Финансовая аналитика</h2>

            <div className="bg-gradient-to-br from-amber-500/20 to-slate-800 p-4 rounded-2xl border border-amber-500/30 space-y-1">
              <div className="text-xs text-amber-300/80 font-medium">Общий оборот магазина</div>
              <div className="text-2xl font-black text-white">{totalRevenue} ₽</div>
              <div className="text-[11px] text-slate-400">Принято через ЮKassa и наличными</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 p-3.5 rounded-2xl border border-slate-700">
                <div className="text-xs text-slate-400">Средний чек</div>
                <div className="text-lg font-black text-amber-400 mt-1">
                  {orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0} ₽
                </div>
              </div>
              <div className="bg-slate-800 p-3.5 rounded-2xl border border-slate-700">
                <div className="text-xs text-slate-400">Успешных заказов</div>
                <div className="text-lg font-black text-emerald-400 mt-1">
                  {orders.filter(o => o.status === 'completed').length} / {orders.length}
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    );
  }

  // ================= CLIENT STORE VIEW =================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 pt-3 pb-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div 
              onClick={() => setSecretTaps(prev => prev + 1)} 
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 uppercase tracking-wider cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gourmet & Craft</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name 
                ? `Привет, ${window.Telegram.WebApp.initDataUnsafe.user.first_name}!` 
                : 'Вкусная Доставка'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {isActualAdmin && (
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  setIsAdminMode(true);
                }}
                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1.5 rounded-full text-xs font-extrabold shadow-sm transition-transform active:scale-95 animate-pulse"
                title="Панель администратора @qqeaux"
              >
                <span>👑 Админка</span>
              </button>
            )}

            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>30–45 мин</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по меню..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Categories Bar */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-3 -mx-4 px-4">
          {CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedCategory(cat.id);
                }}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </header>

      {/* Product List */}
      <main className="max-w-md mx-auto px-4 pt-4">
        <div className="grid grid-cols-2 gap-3.5">
          {filteredProducts.map(product => {
            const qty = cart[product.id] || 0;
            const isAvailable = product.isAvailable !== false;

            return (
              <div 
                key={product.id}
                className={`bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-xs flex flex-col justify-between transition-transform ${
                  !isAvailable ? 'opacity-60 grayscale-[40%]' : 'active:scale-[0.99]'
                }`}
              >
                <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                  <img 
                    src={product.image} 
                    alt={product.name} 
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  {product.badge && (
                    <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                      {product.badge}
                    </span>
                  )}
                  {product.weight && (
                    <span className="absolute bottom-1.5 right-2 bg-black/60 backdrop-blur-xs text-white text-[10px] px-1.5 py-0.5 rounded-sm">
                      {product.weight}
                    </span>
                  )}
                  {!isAvailable && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-2 text-center">
                      <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-1 rounded-md">
                        В стоп-листе
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-3 flex flex-col flex-1 justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-slate-500 text-[11px] line-clamp-2 mt-1 leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-50">
                    <div>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {product.price} ₽
                      </span>
                      {product.oldPrice && (
                        <span className="block text-[10px] text-slate-400 line-through">
                          {product.oldPrice} ₽
                        </span>
                      )}
                    </div>

                    {!isAvailable ? (
                      <span className="text-[10px] text-rose-500 font-bold">Закончился</span>
                    ) : qty === 0 ? (
                      <button
                        onClick={() => addToCart(product.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl transition-all shadow-xs flex items-center justify-center active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-xl p-0.5">
                        <button
                          onClick={() => removeFromCart(product.id)}
                          className="w-6 h-6 flex items-center justify-center text-blue-700 hover:bg-blue-100 rounded-lg transition-colors active:scale-95"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold text-blue-900 w-4 text-center">
                          {qty}
                        </span>
                        <button
                          onClick={() => addToCart(product.id)}
                          className="w-6 h-6 flex items-center justify-center text-blue-700 hover:bg-blue-100 rounded-lg transition-colors active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm">Ничего не найдено</p>
          </div>
        )}
      </main>

      {/* Sticky Bottom Cart Bar */}
      {totalQuantity > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-30 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <button
            onClick={() => {
              triggerHaptic('medium');
              setIsCartOpen(true);
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white py-3.5 px-5 rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-between font-bold text-sm transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-2 bg-white text-blue-600 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {totalQuantity}
                </span>
              </div>
              <span>Корзина</span>
            </div>
            <span>{totalPrice} ₽ →</span>
          </button>
        </div>
      )}

      {/* Cart & Checkout Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-t-3xl max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-250">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Оформление заказа</h2>
                <p className="text-xs text-slate-500">{totalQuantity} поз. на сумму {totalPrice} ₽</p>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Order Items List */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ваш заказ</h3>
                {cartItems.map(item => (
                  <div key={item.product.id} className="flex items-center justify-between py-2 border-b border-slate-50">
                    <div className="flex items-center gap-3">
                      <img 
                        src={item.product.image} 
                        alt={item.product.name} 
                        className="w-12 h-12 object-cover rounded-xl"
                      />
                      <div>
                        <div className="font-bold text-sm text-slate-900 line-clamp-1">{item.product.name}</div>
                        <div className="text-xs text-blue-600 font-semibold">{item.product.price} ₽ × {item.quantity} = {item.product.price * item.quantity} ₽</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5">
                      <button 
                        onClick={() => removeFromCart(item.product.id)}
                        className="w-6 h-6 flex items-center justify-center text-slate-700"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => addToCart(item.product.id)}
                        className="w-6 h-6 flex items-center justify-center text-slate-700"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Details Form with Anti-Fool Validation */}
              <form id="order-form" onSubmit={handleSubmitOrder} className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Данные получателя</h3>
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                    🛡️ Проверка данных
                  </span>
                </div>
                
                {/* Full Name */}
                <div>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Фамилия и Имя (например: Иван Иванов)"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                      }}
                      className={`w-full pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-hidden transition-all ${
                        errors.name ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 focus:border-blue-500'
                      }`}
                    />
                  </div>
                  {errors.name && (
                    <p className="text-[11px] text-rose-600 mt-1 pl-1 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 shrink-0" />
                      <span>{errors.name}</span>
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      placeholder="+7 (9XX) XXX-XX-XX"
                      value={phone}
                      onChange={handlePhoneChange}
                      className={`w-full pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-hidden transition-all ${
                        errors.phone ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 focus:border-blue-500'
                      }`}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-[11px] text-rose-600 mt-1 pl-1 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 shrink-0" />
                      <span>{errors.phone}</span>
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      placeholder="Электронная почта (для чека ЮKassa)"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                      }}
                      className={`w-full pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-hidden transition-all ${
                        errors.email ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 focus:border-blue-500'
                      }`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-[11px] text-rose-600 mt-1 pl-1 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 shrink-0" />
                      <span>{errors.email}</span>
                    </p>
                  )}
                </div>

                {/* Address */}
                <div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Город, улица, номер дома, квартира"
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        if (errors.address) setErrors(prev => ({ ...prev, address: '' }));
                      }}
                      className={`w-full pl-9 pr-3 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-hidden transition-all ${
                        errors.address ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 focus:border-blue-500'
                      }`}
                    />
                  </div>
                  {errors.address && (
                    <p className="text-[11px] text-rose-600 mt-1 pl-1 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 shrink-0" />
                      <span>{errors.address}</span>
                    </p>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Комментарий к заказу (код домофона, этаж)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-blue-500"
                />

                {/* Payment Selection */}
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2">Способ оплаты</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('online')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                      paymentMethod === 'online'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span className="text-xs">Онлайн (ЮKassa / СБП)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                      paymentMethod === 'cash'
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-semibold'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs">При получении</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-slate-500">Итого к оплате:</span>
                <span className="text-lg font-black text-slate-900">{totalPrice} ₽</span>
              </div>
              <button
                type="submit"
                form="order-form"
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white py-3.5 rounded-2xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Подтвердить заказ ({totalPrice} ₽)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {orderSuccess && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center shadow-xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-1">Заказ #{orderSuccess.orderNumber} подтверждён!</h2>
            <p className="text-xs text-slate-500 mb-4">
              Номер телефона верифицирован. Детали заказа и электронный чек отправлены в бот.
            </p>

            <div className="bg-slate-50 rounded-2xl p-3.5 text-left text-xs space-y-1.5 mb-5 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-400">Получатель:</span>
                <span className="font-semibold text-slate-800">{orderSuccess.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Телефон:</span>
                <span className="font-medium text-slate-800">{orderSuccess.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email:</span>
                <span className="font-medium text-slate-800">{orderSuccess.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Сумма:</span>
                <span className="font-bold text-blue-600">{orderSuccess.totalPrice} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Адрес:</span>
                <span className="font-medium text-slate-800 truncate max-w-[180px]">{orderSuccess.address}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setOrderSuccess(null);
                if (window.Telegram?.WebApp?.close) {
                  window.Telegram.WebApp.close();
                }
              }}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs hover:bg-slate-800 transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
