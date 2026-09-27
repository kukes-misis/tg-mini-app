import React, { useState, useEffect, useMemo } from 'react';
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
  ShieldAlert, 
  Sun, 
  Moon,
  Heart,
  Trash2,
  RotateCcw,
  HelpCircle,
  ChefHat,
  Bike,
  Flame,
  Tag,
  Utensils,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { CATEGORIES, PRODUCTS as INITIAL_PRODUCTS } from './data/products';
import { Product, CartItem, OrderData, OrderStatus } from './types';

// --- HELPERS ---

const API_BASE_URL = 'https://tg-mini-app-se10.onrender.com';

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

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 11 || !digits.startsWith('79')) return false;

  const rest = digits.slice(2);
  const uniqueDigits = new Set(rest);
  if (uniqueDigits.size <= 2) return false;

  if (rest === '123456789' || rest === '987654321' || rest === '012345678' || rest === '111222333') {
    return false;
  }
  return true;
}

function isValidName(name: string): boolean {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return false;
  const nameRegex = /^[A-Za-zА-Яа-яЁё\-]+$/;
  return words.every(w => w.length >= 2 && nameRegex.test(w));
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

function isValidAddress(address: string): boolean {
  const trimmed = address.trim();
  return trimmed.length >= 8 && /\d/.test(trimmed);
}

function getMoscowTimeInfo(): { hour: number; timeStr: string; isDaytime: boolean } {
  try {
    const now = new Date();
    const msk = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
    const hour = msk.getHours();
    const minutes = String(msk.getMinutes()).padStart(2, '0');
    const isDaytime = hour >= 7 && hour < 20;
    return { hour, timeStr: `${String(hour).padStart(2, '0')}:${minutes}`, isDaytime };
  } catch {
    const utcHours = new Date().getUTCHours();
    const hour = (utcHours + 3) % 24;
    return { hour, timeStr: `${String(hour).padStart(2, '0')}:00`, isDaytime: hour >= 7 && hour < 20 };
  }
}

// Initial demo orders
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
    comment: 'Позвонить за 5 минут',
    totalPrice: 900,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    status: 'delivering',
    createdAt: '35 минут назад',
    items: [
      { id: 'b2', name: 'Трюфельный Чизбургер', quantity: 1, price: 590 },
      { id: 'd2', name: 'Матча Латте на кокосовом', quantity: 1, price: 310 }
    ]
  }
];

export function App() {
  // Navigation tabs: 'menu' | 'orders' | 'support' | 'admin'
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'support' | 'admin'>('menu');
  
  // Theme state
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    return !getMoscowTimeInfo().isDaytime;
  });
  const [moscowTimeStr, setMoscowTimeStr] = useState<string>(() => getMoscowTimeInfo().timeStr);

  // Products & Categories
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('tg_store_products');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_PRODUCTS;
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Wishlist / Favorites
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tg_store_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Selected Product for Detail Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Cart
  const [cart, setCart] = useState<{ [productId: string]: number }>({});
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Orders
  const [orders, setOrders] = useState<OrderData[]>(() => {
    const saved = localStorage.getItem('tg_store_orders');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_DEMO_ORDERS;
  });

  // Order Deletion Modal
  const [orderToDelete, setOrderToDelete] = useState<OrderData | null>(null);

  // Active highlighted order for tracking
  const [activeTrackOrderNum, setActiveTrackOrderNum] = useState<string | null>(null);

  // Form inputs
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('online');
  const [savedAddresses, setSavedAddresses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tg_store_addresses');
      return saved ? JSON.parse(saved) : ['г. Москва, ул. Тверская, д. 12'];
    } catch {
      return [];
    }
  });

  // Top features: Promocodes, Cutlery, Tips
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent?: number; amount?: number } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [cutleryCount, setCutleryCount] = useState<number>(1);
  const [tipsAmount, setTipsAmount] = useState<number>(0);

  // Validation errors
  const [formErrors, setFormErrors] = useState<{
    customerName?: string;
    phone?: string;
    email?: string;
    address?: string;
  }>({});

  // Success modal
  const [orderSuccess, setOrderSuccess] = useState<OrderData | null>(null);

  // Admin price edit state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState<string>('');

  // Check admin identity: strictly and ONLY @qqeaux
  const isActualAdmin = useMemo(() => {
    const tgUsername = window.Telegram?.WebApp?.initDataUnsafe?.user?.username?.toLowerCase() || '';
    return tgUsername === 'qqeaux';
  }, []);

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setMoscowTimeStr(getMoscowTimeInfo().timeStr);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Sync products and orders to localStorage
  useEffect(() => {
    localStorage.setItem('tg_store_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('tg_store_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('tg_store_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // Deep Link Handling from Telegram status notifications: ?tab=orders&order=1234
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      const orderParam = urlParams.get('order');

      if (tabParam === 'orders' || orderParam) {
        setActiveTab('orders');
        if (orderParam) {
          setActiveTrackOrderNum(orderParam);
        }
      }
    } catch {
      // ignore
    }
  }, []);

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

  // Fetch updated orders from server periodically
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/orders`);
        if (res.ok) {
          const serverOrders = await res.json();
          if (Array.isArray(serverOrders) && serverOrders.length > 0) {
            setOrders(prev => {
              const combined = [...serverOrders];
              for (const p of prev) {
                if (!combined.some(s => s.orderNumber === p.orderNumber)) {
                  combined.push(p);
                }
              }
              return combined;
            });
          }
        }
      } catch {
        // silent fail on network
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  // Live sync of products (prices and availability) from backend server for all users
  useEffect(() => {
    let isMounted = true;

    const fetchLiveProducts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
        });
        if (res.ok && isMounted) {
          const serverProducts = await res.json();
          if (Array.isArray(serverProducts) && serverProducts.length > 0) {
            setProducts(prev => {
              const updated = prev.map(p => {
                const sp = serverProducts.find((s: any) => s.id === p.id);
                if (sp) {
                  const newPrice = typeof sp.price === 'number' ? sp.price : p.price;
                  const newAvail = sp.isAvailable !== undefined ? Boolean(sp.isAvailable) : (sp.is_available !== undefined ? Boolean(sp.is_available) : p.isAvailable);
                  const newOldPrice = sp.oldPrice !== undefined ? sp.oldPrice : p.oldPrice;
                  return {
                    ...p,
                    price: newPrice,
                    isAvailable: newAvail,
                    oldPrice: newOldPrice
                  };
                }
                return p;
              });
              localStorage.setItem('tg_store_products', JSON.stringify(updated));
              return updated;
            });
          }
        }
      } catch (err) {
        console.warn('Could not sync products from server:', err);
      }
    };

    fetchLiveProducts();
    const interval = setInterval(fetchLiveProducts, 10000); // Live poll every 10 seconds
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
    try {
      if (type === 'success' || type === 'error') {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);
      } else {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(type);
      }
    } catch {
      // ignore
    }
  };

  // Toggle favorite
  const toggleWishlist = (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic('light');
    setWishlist(prev => 
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  // Cart operations
  const addToCart = (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic('light');
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }));
  };

  const removeFromCart = (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic('light');
    setCart(prev => {
      const current = prev[productId] || 0;
      if (current <= 1) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: current - 1 };
    });
  };

  // Calculate Cart Totals
  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .map(([id, quantity]) => {
        const product = products.find(p => p.id === id);
        return product ? { product, quantity } : null;
      })
      .filter((item): item is CartItem => item !== null && item.quantity > 0);
  }, [cart, products]);

  const totalItemsCount = useMemo(() => {
    return Object.values(cart).reduce((a, b) => a + b, 0);
  }, [cart]);

  const subtotalPrice = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  }, [cartItems]);

  const discountAmount = useMemo(() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.percent) {
      return Math.round((subtotalPrice * appliedPromo.percent) / 100);
    }
    if (appliedPromo.amount) {
      return Math.min(appliedPromo.amount, subtotalPrice);
    }
    return 0;
  }, [subtotalPrice, appliedPromo]);

  const totalPrice = useMemo(() => {
    return Math.max(0, subtotalPrice - discountAmount + tipsAmount);
  }, [subtotalPrice, discountAmount, tipsAmount]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategory === 'favorites') {
        if (!wishlist.includes(p.id)) return false;
      } else if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery, wishlist]);

  // Apply Promocode
  const handleApplyPromo = () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;
    triggerHaptic('medium');

    if (code === 'VIBE20') {
      setAppliedPromo({ code, percent: 20 });
      setPromoError('');
    } else if (code === 'WELCOME') {
      if (subtotalPrice < 800) {
        setPromoError('Промокод WELCOME действует от 800 ₽');
        return;
      }
      setAppliedPromo({ code, amount: 300 });
      setPromoError('');
    } else {
      setPromoError('Неверный промокод. Попробуйте VIBE20');
      triggerHaptic('error');
    }
  };

  // Re-order in 1 click
  const handleRepeatOrder = (order: OrderData) => {
    triggerHaptic('medium');
    const newCart: { [id: string]: number } = {};
    for (const item of order.items) {
      newCart[item.id] = item.quantity;
    }
    setCart(newCart);
    if (order.address) setAddress(order.address);
    if (order.customerName) setCustomerName(order.customerName);
    if (order.phone) setPhone(order.phone);
    if (order.email) setEmail(order.email);
    setIsCartOpen(true);
  };

  // Delete Order (User & Admin)
  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    triggerHaptic('medium');
    const orderNum = orderToDelete.orderNumber;

    // Remove from local state
    setOrders(prev => prev.filter(o => o.orderNumber !== orderNum));

    // Remove from server DB
    try {
      await fetch(`${API_BASE_URL}/api/orders/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderNum })
      });
    } catch {
      // server sync
    }

    setOrderToDelete(null);
  };

  // Update Status from Admin panel
  const handleAdminStatusChange = async (orderNum: string, newStatus: OrderStatus) => {
    triggerHaptic('medium');
    setOrders(prev => prev.map(o => o.orderNumber === orderNum ? { ...o, status: newStatus } : o));

    try {
      await fetch(`${API_BASE_URL}/api/orders/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderNum, status: newStatus })
      });
    } catch (e) {
      console.warn('Status update API error:', e);
    }
  };

  // Submit Order
  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();

    const errors: typeof formErrors = {};
    if (!isValidName(customerName)) {
      errors.customerName = 'Введите имя и фамилию (только буквы)';
    }
    if (!isValidPhone(phone)) {
      errors.phone = 'Укажите реальный номер РФ (+7 9XX XXX-XX-XX)';
    }
    if (!isValidEmail(email)) {
      errors.email = 'Введите корректный email адрес';
    }
    if (!isValidAddress(address)) {
      errors.address = 'Укажите улицу и номер дома (мин. 8 символов)';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      triggerHaptic('error');
      return;
    }

    const unavailableItem = cartItems.find(item => item.product.isAvailable === false);
    if (unavailableItem) {
      alert(`Блюдо "${unavailableItem.product.name}" временно в стоп-листе и недоступно для заказа. Пожалуйста, удалите его из корзины.`);
      triggerHaptic('error');
      return;
    }

    setFormErrors({});
    triggerHaptic('success');

    // Save recent address
    if (!savedAddresses.includes(address.trim())) {
      const updated = [address.trim(), ...savedAddresses.slice(0, 2)];
      setSavedAddresses(updated);
      localStorage.setItem('tg_store_addresses', JSON.stringify(updated));
    }

    const orderNum = String(Math.floor(1000 + Math.random() * 9000));
    const newOrder: OrderData = {
      id: `ord-${orderNum}`,
      orderNumber: orderNum,
      items: cartItems.map(item => ({
        id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        image: item.product.image
      })),
      subtotal: subtotalPrice,
      discount: discountAmount,
      promoCode: appliedPromo?.code,
      cutlery: cutleryCount,
      tips: tipsAmount,
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

    // 1. Dual Delivery: Send payload directly to Backend API
    try {
      fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newOrder,
          userId: window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 0,
          username: window.Telegram?.WebApp?.initDataUnsafe?.user?.username || ''
        })
      }).catch(err => console.warn('API sync warning:', err));
    } catch (e) {
      console.warn('API fetch error:', e);
    }

    // 2. Dual Delivery: Send payload to Telegram Bot via WebApp SDK
    if (window.Telegram?.WebApp?.sendData) {
      try {
        window.Telegram.WebApp.sendData(JSON.stringify(newOrder));
      } catch (err) {
        console.warn('sendData error:', err);
      }
    }

    // Save locally
    setOrders(prev => [newOrder, ...prev]);
    setIsCartOpen(false);
    setCart({});
    setOrderSuccess(newOrder);
    setActiveTrackOrderNum(orderNum);
  };

  // Toggle availability in admin
  const toggleProductAvailability = async (productId: string) => {
    triggerHaptic('medium');
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return { ...p, isAvailable: p.isAvailable === false ? true : false };
      }
      return p;
    }));

    try {
      await fetch(`${API_BASE_URL}/api/products/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });
    } catch {
      // server sync
    }
  };

  // Save product price in admin
  const handleSavePrice = async (productId: string) => {
    const val = parseInt(editPriceVal, 10);
    if (isNaN(val) || val <= 0) return;
    triggerHaptic('success');

    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return { ...p, price: val };
      }
      return p;
    }));
    setEditingPriceId(null);
    setEditPriceVal('');

    try {
      await fetch(`${API_BASE_URL}/api/products/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, price: val })
      });
    } catch {
      // server sync
    }
  };

  // Count active orders for badge
  const activeOrdersCount = useMemo(() => {
    return orders.filter(o => o.status === 'new' || o.status === 'cooking' || o.status === 'delivering').length;
  }, [orders]);

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 select-none pb-24 ${
      isDarkTheme ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>

      {/* TOP HEADER */}
      <header className={`sticky top-0 z-30 px-4 py-3 backdrop-blur-md border-b transition-colors ${
        isDarkTheme ? 'bg-slate-950/90 border-slate-800/80' : 'bg-white/90 border-slate-200/80 shadow-xs'
      }`}>
        <div className="flex items-center justify-between gap-3">
          
          {/* Logo / Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-amber-500/20">
              V
            </div>
            <div>
              <div className="text-sm font-black tracking-tight leading-tight flex items-center gap-1.5">
                <span>VIBE KITCHEN</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                  PREMIUM
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Ресторан & Авторская доставка</div>
            </div>
          </div>

          {/* Right Header Badges */}
          <div className="flex items-center gap-2">
            
            {/* Moscow Time Theme Pill */}
            <button
              onClick={() => {
                triggerHaptic('light');
                setIsDarkTheme(!isDarkTheme);
              }}
              title="Переключить тему"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                isDarkTheme 
                  ? 'bg-slate-900 border-slate-700 text-amber-400 hover:bg-slate-800' 
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isDarkTheme ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
              <span>{moscowTimeStr} МСК</span>
            </button>

            {/* Cart Button */}
            <button
              onClick={() => {
                triggerHaptic('medium');
                setIsCartOpen(true);
              }}
              className="relative p-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25 transition-transform active:scale-95 cursor-pointer"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[11px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-white dark:border-slate-950 animate-in zoom-in-75">
                  {totalItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Live Active Order Banner in Header (if order in progress) */}
        {activeOrdersCount > 0 && activeTab === 'menu' && (
          <div 
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('orders');
            }}
            className="mt-2.5 p-2 rounded-xl bg-gradient-to-r from-amber-500/15 via-blue-500/15 to-emerald-500/15 border border-amber-500/30 flex items-center justify-between text-xs cursor-pointer animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span className="font-semibold text-amber-400">Активный заказ готовится</span>
            </div>
            <div className="flex items-center gap-1 font-bold text-blue-400">
              <span>Смотреть статус</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTENT AREA BY TAB */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-3">

        {/* ================= TAB 1: MENU ================= */}
        {activeTab === 'menu' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по меню (бургер, пицца, напитки)..."
                className={`w-full pl-10 pr-9 py-2.5 rounded-2xl text-xs border transition-all focus:outline-none ${
                  isDarkTheme 
                    ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 focus:border-blue-500' 
                    : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 shadow-xs'
                }`}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Chips Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedCategory('all');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : isDarkTheme ? 'bg-slate-900 text-slate-400 border border-slate-800' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                🔥 Все блюда
              </button>

              <button
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedCategory('favorites');
                }}
                className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === 'favorites'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                    : isDarkTheme ? 'bg-slate-900 text-slate-400 border border-slate-800' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                <Heart className={`w-3 h-3 ${wishlist.length > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
                <span>Избранное ({wishlist.length})</span>
              </button>

              {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : isDarkTheme ? 'bg-slate-900 text-slate-400 border border-slate-800' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 pt-1">
              {filteredProducts.map(product => {
                const qty = cart[product.id] || 0;
                const isFav = wishlist.includes(product.id);
                const isAvail = product.isAvailable !== false;

                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`rounded-3xl border flex flex-col justify-between overflow-hidden transition-all hover:shadow-lg cursor-pointer ${
                      isDarkTheme 
                        ? 'bg-slate-900/90 border-slate-800/80 hover:border-slate-700' 
                        : 'bg-white border-slate-100 hover:border-slate-200 shadow-xs'
                    } ${!isAvail ? 'opacity-60 grayscale-[40%]' : ''}`}
                  >
                    {/* Image Container with Badges */}
                    <div className="relative aspect-4/3 overflow-hidden bg-slate-800">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        loading="lazy"
                      />

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {product.badge && (
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wide uppercase bg-amber-500 text-slate-950 shadow-sm">
                            {product.badge}
                          </span>
                        )}
                        {product.spicy && (
                          <span className="px-1.5 py-0.5 rounded-lg text-[10px] font-black bg-red-600 text-white shadow-sm flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" /> Острое
                          </span>
                        )}
                      </div>

                      {/* Favorite Button */}
                      <button
                        onClick={(e) => toggleWishlist(product.id, e)}
                        className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-transform active:scale-90 ${
                          isFav ? 'bg-rose-500 text-white shadow-md' : 'bg-black/40 text-white hover:bg-black/60'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                      </button>

                      {/* Weight pill */}
                      {product.weight && (
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white/90">
                          {product.weight}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs font-black tracking-tight line-clamp-1 mb-1">
                          {product.name}
                        </h3>
                        <p className={`text-[11px] line-clamp-2 leading-relaxed mb-3 ${
                          isDarkTheme ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {product.description}
                        </p>
                      </div>

                      {/* Price & Add to Cart button */}
                      <div className={`flex items-center justify-between pt-1 border-t ${isDarkTheme ? 'border-slate-800/40' : 'border-slate-100'}`}>
                        <div>
                          <div className={`text-sm font-black ${isDarkTheme ? 'text-amber-400' : 'text-slate-900'}`}>
                            {product.price} ₽
                          </div>
                          {product.oldPrice && product.oldPrice > product.price && (
                            <div className="text-[10px] text-slate-400 line-through">
                              {product.oldPrice} ₽
                            </div>
                          )}
                        </div>

                        {/* Add / Quantity Counter */}
                        {isAvail ? (
                          qty > 0 ? (
                            <div 
                              onClick={e => e.stopPropagation()} 
                              className="flex items-center gap-1.5 bg-blue-600 rounded-xl p-1 shadow-sm text-white"
                            >
                              <button 
                                onClick={e => removeFromCart(product.id, e)}
                                className="w-6 h-6 rounded-lg bg-blue-700 flex items-center justify-center hover:bg-blue-800 active:scale-95"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-black px-1 min-w-[14px] text-center">{qty}</span>
                              <button 
                                onClick={e => addToCart(product.id, e)}
                                className="w-6 h-6 rounded-lg bg-blue-700 flex items-center justify-center hover:bg-blue-800 active:scale-95"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={e => addToCart(product.id, e)}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm shadow-blue-500/20 active:scale-95 transition-transform flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Хочу</span>
                            </button>
                          )
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500 uppercase px-2 py-1 rounded-md bg-slate-800/40">
                            Стоп-лист
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-16 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <Search className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold">Ничего не найдено</div>
                <p className="text-xs text-slate-400">Попробуйте изменить запрос или выбрать другую категорию</p>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: MY ORDERS & STAGE TRACKER ================= */}
        {activeTab === 'orders' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-base font-black tracking-tight">Мои заказы</h2>
                <p className="text-xs text-slate-400">Отслеживание в реальном времени и история</p>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {orders.length} заказов
              </span>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <div className="w-14 h-14 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                  <Package className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold">У вас пока нет заказов</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Перейдите в меню, выберите любимые блюда и оформите первый заказ за пару кликов!
                </p>
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveTab('menu');
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Перейти в меню
                </button>
              </div>
            ) : (
              orders.map(order => {
                const isTrackExpanded = activeTrackOrderNum === order.orderNumber || order.status !== 'completed';
                
                // Stepper stages: 1: New, 2: Cooking, 3: Delivering, 4: Completed
                const stageIndex = order.status === 'cooking' ? 2 : order.status === 'delivering' ? 3 : order.status === 'completed' ? 4 : 1;
                const isCancelled = order.status === 'cancelled';

                return (
                  <div
                    key={order.orderNumber || order.id}
                    className={`rounded-3xl border p-4 space-y-3.5 transition-all ${
                      isDarkTheme ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    {/* Header */}
                    <div className={`flex items-center justify-between pb-2 border-b ${isDarkTheme ? 'border-slate-800/40' : 'border-slate-100'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm">Заказ #{order.orderNumber}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            order.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            order.status === 'delivering' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse' :
                            order.status === 'cooking' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse' :
                            order.status === 'cancelled' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                            isDarkTheme ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {order.status === 'completed' ? 'Доставлен' :
                             order.status === 'delivering' ? 'Курьер в пути' :
                             order.status === 'cooking' ? 'Готовится на кухне' :
                             order.status === 'cancelled' ? 'Отменен' : 'Принят'}
                          </span>
                        </div>
                        <div className={`text-[11px] mt-0.5 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>{order.createdAt}</div>
                      </div>

                      <div className="text-right">
                        <div className={`text-base font-black ${isDarkTheme ? 'text-amber-400' : 'text-slate-900'}`}>
                          {order.totalPrice} ₽
                        </div>
                        <div className={`text-[10px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                          {order.paymentMethod === 'online' ? 'Оплачен онлайн' : 'Оплата при получении'}
                        </div>
                      </div>
                    </div>

                    {/* VISUAL ORDER STAGES STEPPER (if not cancelled) */}
                    {!isCancelled && (
                      <div className={`p-3 rounded-2xl border ${
                        isDarkTheme ? 'bg-slate-950/70 border-slate-800/80' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className={`text-[11px] font-bold mb-2.5 flex items-center justify-between ${
                          isDarkTheme ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          <span>Стадия выполнения</span>
                          {order.status !== 'completed' && (
                            <span className="text-amber-500 flex items-center gap-1 font-semibold">
                              <Clock className="w-3 h-3" /> ~20–35 мин
                            </span>
                          )}
                        </div>

                        {/* Progress Bar with 4 nodes */}
                        <div className="relative flex items-center justify-between px-2 pt-1 pb-1">
                          <div className={`absolute left-6 right-6 top-4 h-1 -translate-y-1/2 z-0 ${
                            isDarkTheme ? 'bg-slate-800' : 'bg-slate-200'
                          }`}>
                            <div 
                              className="h-full bg-gradient-to-r from-amber-500 via-blue-500 to-emerald-500 transition-all duration-500" 
                              style={{ width: `${((stageIndex - 1) / 3) * 100}%` }}
                            />
                          </div>

                          {/* Stage 1: Created */}
                          <div className="relative z-10 flex flex-col items-center gap-1 text-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                              stageIndex >= 1 ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : (isDarkTheme ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-500')
                            }`}>
                              <Check className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-[10px] font-semibold ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>Принят</span>
                          </div>

                          {/* Stage 2: Cooking */}
                          <div className="relative z-10 flex flex-col items-center gap-1 text-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                              stageIndex >= 2 
                                ? (stageIndex === 2 ? 'bg-amber-500 text-slate-950 animate-bounce' : 'bg-blue-600 text-white')
                                : (isDarkTheme ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-500')
                            }`}>
                              <ChefHat className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-[10px] font-semibold ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>Кухня</span>
                          </div>

                          {/* Stage 3: Delivering */}
                          <div className="relative z-10 flex flex-col items-center gap-1 text-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                              stageIndex >= 3 
                                ? (stageIndex === 3 ? 'bg-blue-500 text-white animate-pulse' : 'bg-emerald-600 text-white')
                                : (isDarkTheme ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-500')
                            }`}>
                              <Bike className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-[10px] font-semibold ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>В пути</span>
                          </div>

                          {/* Stage 4: Delivered */}
                          <div className="relative z-10 flex flex-col items-center gap-1 text-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                              stageIndex >= 4 ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30' : (isDarkTheme ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-500')
                            }`}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-[10px] font-semibold ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>Доставлен</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Items List in Order */}
                    <div className="space-y-1.5 text-xs">
                      {order.items.map((item, idx) => (
                        <div key={idx} className={`flex justify-between items-center ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>
                          <span className="truncate max-w-[220px]">
                            {item.name} <span className={isDarkTheme ? 'text-slate-500' : 'text-slate-400'}>× {item.quantity}</span>
                          </span>
                          <span className={`font-semibold ${isDarkTheme ? 'text-slate-200' : 'text-slate-900'}`}>
                            {item.price * item.quantity} ₽
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Delivery Address */}
                    <div className={`flex items-start gap-1.5 text-[11px] pt-1 ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-blue-500 mt-0.5" />
                      <span className="truncate">{order.address}</span>
                    </div>

                    {/* Action Buttons: Repeat & Delete */}
                    <div className={`flex items-center gap-2 pt-2 border-t ${isDarkTheme ? 'border-slate-800/40' : 'border-slate-100'}`}>
                      
                      {/* Repeat Order Button */}
                      <button
                        onClick={() => handleRepeatOrder(order)}
                        className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer ${
                          isDarkTheme 
                            ? 'bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border-blue-500/20' 
                            : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Повторить заказ</span>
                      </button>

                      {/* Delete from History Button */}
                      <button
                        onClick={() => setOrderToDelete(order)}
                        title="Удалить из истории"
                        className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                          isDarkTheme 
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20' 
                            : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= TAB 3: SUPPORT & INFO ================= */}
        {activeTab === 'support' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h2 className="text-base font-black tracking-tight">Поддержка & О проекте</h2>
              <p className={`text-xs ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Служба заботы о клиентах и контакты разработчика</p>
            </div>

            {/* Turnkey Development Offer Banner */}
            <div className={`p-4 rounded-3xl border relative overflow-hidden ${
              isDarkTheme ? 'bg-gradient-to-br from-blue-950/60 to-slate-900 border-blue-800/40' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
            }`}>
              <div className="flex items-center gap-2 text-blue-500 font-extrabold text-xs mb-1">
                <Sparkles className="w-4 h-4" />
                <span>РАЗРАБОТКА ПОД КЛЮЧ</span>
              </div>
              <h3 className={`text-sm font-black mb-1.5 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Хотите такой же Telegram Mini App для бизнеса?</h3>
              <p className={`text-xs leading-relaxed mb-3 ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                Создаем полноценные цифровые рестораны, каталоги товаров и сервисы доставки с удобным приемом заказов, закрытой админкой и защитой от фрода.
              </p>
              
              <div className={`flex items-center gap-3 text-xs font-semibold mb-3.5 ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>
                <span className="flex items-center gap-1">⏱ Срок: 3–5 дней</span>
                <span className="flex items-center gap-1 text-amber-500 font-bold">💰 От 25 000 ₽</span>
              </div>

              <a
                href="https://t.me/qqeaux"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Написать разработчику (@qqeaux)</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            </div>

            {/* FAQ Accordion */}
            <div className={`rounded-3xl border p-4 space-y-3 ${
              isDarkTheme ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider ${
                isDarkTheme ? 'text-slate-400' : 'text-slate-500'
              }`}>
                <HelpCircle className="w-4 h-4 text-blue-500" />
                <span>Частые вопросы (FAQ)</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className={`p-3.5 rounded-2xl border ${
                  isDarkTheme ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`font-bold mb-1 ${isDarkTheme ? 'text-slate-200' : 'text-slate-900'}`}>Как работает отслеживание стадий?</div>
                  <div className={`text-[11px] leading-relaxed ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                    После оформления заказа во вкладке «Мои заказы» появляется интерактивный таймлайн. При переходе на кухню или выезде курьера статус мгновенно обновляется прямо на экране.
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border ${
                  isDarkTheme ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`font-bold mb-1 ${isDarkTheme ? 'text-slate-200' : 'text-slate-900'}`}>Какие способы оплаты доступны?</div>
                  <div className={`text-[11px] leading-relaxed ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                    Оплата производится при получении курьеру наличными или банковской картой.
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border ${
                  isDarkTheme ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`font-bold mb-1 ${isDarkTheme ? 'text-slate-200' : 'text-slate-900'}`}>Сколько занимает доставка?</div>
                  <div className={`text-[11px] leading-relaxed ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                    Среднее время приготовления и доставки курьером по городу составляет от 30 до 45 минут в зависимости от адреса.
                  </div>
                </div>
              </div>
            </div>

            {/* About Tech Stack */}
            <div className={`rounded-3xl border p-4 text-xs space-y-2 ${
              isDarkTheme ? 'bg-slate-900/90 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-xs'
            }`}>
              <div className={`font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-900'}`}>О технологическом стеке стенда:</div>
              <ul className={`space-y-1 list-disc list-inside text-[11px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                <li><b>Frontend:</b> React 19 + TypeScript + Tailwind CSS (Telegram WebApp SDK)</li>
                <li><b>Backend:</b> Python 3 (Aiogram 3 + aiohttp REST API)</li>
                <li><b>База данных:</b> SQLite (синхронизация заказов, КБЖУ, цены)</li>
                <li><b>Безопасность:</b> Anti-fraud валидация, закрытая админка для @qqeaux</li>
              </ul>
            </div>
          </div>
        )}

        {/* ================= TAB 4: ADMIN PANEL ================= */}
        {activeTab === 'admin' && isActualAdmin && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                  👑
                </span>
                <div>
                  <h2 className="text-base font-black tracking-tight">Панель администратора</h2>
                  <div className="text-xs text-amber-400 font-bold">Владелец: @qqeaux</div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                LIVE СЕРВЕР
              </span>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className={`p-3 rounded-2xl border ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className={`text-[10px] font-bold uppercase ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Выручка всего</div>
                <div className="text-base font-black text-amber-500 mt-0.5">
                  {orders.reduce((acc, o) => acc + (o.paymentStatus === 'paid' ? o.totalPrice : 0), 0)} ₽
                </div>
              </div>

              <div className={`p-3 rounded-2xl border ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className={`text-[10px] font-bold uppercase ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Всего заказов</div>
                <div className="text-base font-black text-blue-500 mt-0.5">
                  {orders.length}
                </div>
              </div>
            </div>

            {/* Manage Orders Section */}
            <div className="space-y-3">
              <h3 className={`text-xs font-black uppercase tracking-wider ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                Управление заказами клиентов ({orders.length})
              </h3>

              {orders.map(order => (
                <div 
                  key={order.orderNumber}
                  className={`p-3.5 rounded-2xl border space-y-2.5 text-xs ${
                    isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs text-slate-900'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-black text-sm flex items-center gap-2">
                        <span>#{order.orderNumber}</span>
                        <span className={`font-semibold ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>{order.customerName}</span>
                      </div>
                      <div className="text-blue-500 font-medium">{order.phone}</div>
                      <div className={`text-[11px] truncate max-w-[200px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>{order.address}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-amber-500">{order.totalPrice} ₽</div>
                      <span className={`text-[10px] uppercase ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>{order.status}</span>
                    </div>
                  </div>

                  {/* Status Change Buttons */}
                  <div className={`flex flex-wrap gap-1.5 pt-1 border-t ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                    <button
                      onClick={() => handleAdminStatusChange(order.orderNumber || '', 'cooking')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                        order.status === 'cooking' 
                          ? 'bg-amber-500 text-slate-950 border-amber-500' 
                          : isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      👨‍🍳 В готовку
                    </button>
                    <button
                      onClick={() => handleAdminStatusChange(order.orderNumber || '', 'delivering')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                        order.status === 'delivering' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      🚴 В доставку
                    </button>
                    <button
                      onClick={() => handleAdminStatusChange(order.orderNumber || '', 'completed')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                        order.status === 'completed' 
                          ? 'bg-emerald-600 text-white border-emerald-600' 
                          : isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      ✅ Выполнен
                    </button>
                    <button
                      onClick={() => setOrderToDelete(order)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                        isDarkTheme 
                          ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' 
                          : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                      }`}
                    >
                      🗑️ Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Products & Prices Management */}
            <div className="space-y-3 pt-3">
              <h3 className={`text-xs font-black uppercase tracking-wider ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                Цены и наличие товаров
              </h3>

              {products.map(p => (
                <div 
                  key={p.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                    isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <img src={p.image} alt={p.name} className="w-10 h-10 rounded-xl object-cover" />
                    <div>
                      <div className={`font-bold line-clamp-1 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{p.name}</div>
                      <div className="text-[11px] text-amber-500 font-black">{p.price} ₽</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {editingPriceId === p.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={editPriceVal}
                          onChange={e => setEditPriceVal(e.target.value)}
                          className={`w-16 px-2 py-1 rounded-lg border text-xs ${
                            isDarkTheme ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        />
                        <button
                          onClick={() => handleSavePrice(p.id)}
                          className="p-1 rounded-lg bg-emerald-600 text-white"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingPriceId(p.id);
                          setEditPriceVal(String(p.price));
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDarkTheme ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => toggleProductAvailability(p.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                        p.isAvailable !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {p.isAvailable !== false ? 'В наличии' : 'Стоп'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ================= FIXED BOTTOM NAVIGATION BAR ================= */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl transition-colors ${
        isDarkTheme ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-lg'
      }`}>
        <div className="max-w-md mx-auto grid grid-cols-4 px-2 py-1.5">
          
          {/* Tab 1: Menu */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('menu');
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'menu'
                ? 'text-blue-500 font-bold'
                : 'text-slate-400 hover:text-slate-300 font-medium'
            }`}
          >
            <Utensils className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Меню</span>
          </button>

          {/* Tab 2: Orders */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('orders');
            }}
            className={`relative flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'text-blue-500 font-bold'
                : 'text-slate-400 hover:text-slate-300 font-medium'
            }`}
          >
            <Package className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Заказы</span>
            {activeOrdersCount > 0 && (
              <span className="absolute top-1 right-5 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>

          {/* Tab 3: Support */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('support');
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'support'
                ? 'text-blue-500 font-bold'
                : 'text-slate-400 hover:text-slate-300 font-medium'
            }`}
          >
            <HelpCircle className="w-5 h-5 mb-0.5" />
            <span className="text-[10px]">Инфо</span>
          </button>

          {/* Tab 4: Admin (if admin) or Profile */}
          {isActualAdmin ? (
            <button
              onClick={() => {
                triggerHaptic('medium');
                setActiveTab('admin');
              }}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'text-amber-400 font-bold'
                  : 'text-slate-400 hover:text-slate-300 font-medium'
              }`}
            >
              <span className="text-base mb-0.5 leading-none">👑</span>
              <span className="text-[10px]">Админка</span>
            </button>
          ) : (
            <button
              onClick={() => {
                triggerHaptic('light');
                setIsCartOpen(true);
              }}
              className="flex flex-col items-center justify-center py-1 rounded-xl text-slate-400 hover:text-slate-300 font-medium cursor-pointer"
            >
              <ShoppingBag className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Корзина</span>
            </button>
          )}
        </div>
      </nav>

      {/* ================= PRODUCT DETAIL MODAL (WITH KBJU & INGREDIENTS) ================= */}
      {selectedProduct && (() => {
        const currentProduct = products.find(p => p.id === selectedProduct.id) || selectedProduct;
        const isAvail = currentProduct.isAvailable !== false;

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden border shadow-2xl ${
              isDarkTheme ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              
              {/* Modal Image with Close Button */}
              <div className="relative aspect-16/9 w-full bg-slate-950 overflow-hidden shrink-0">
                <img 
                  src={currentProduct.image} 
                  alt={currentProduct.name} 
                  className={`w-full h-full object-cover ${!isAvail ? 'opacity-60 grayscale-[40%]' : ''}`}
                />
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition-transform active:scale-95 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Badges */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                  {!isAvail ? (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase bg-red-600 text-white shadow-md">
                      Стоп-лист
                    </span>
                  ) : currentProduct.badge ? (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase bg-amber-500 text-slate-950 shadow-md">
                      {currentProduct.badge}
                    </span>
                  ) : null}
                  {currentProduct.weight && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-black/70 backdrop-blur-md text-white">
                      {currentProduct.weight}
                    </span>
                  )}
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="p-4 overflow-y-auto space-y-4">
                <div>
                  <h2 className="text-lg font-black tracking-tight">{currentProduct.name}</h2>
                  <p className={`text-xs mt-1 leading-relaxed ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                    {currentProduct.description}
                  </p>
                </div>

                {/* NUTRITION FACTS (КБЖУ) CARDS */}
                <div className={`p-3.5 rounded-2xl border ${
                  isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`text-[11px] font-black uppercase tracking-wider mb-2.5 flex items-center justify-between ${
                    isDarkTheme ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <span>Энергетическая ценность (КБЖУ)</span>
                    <span className={`font-semibold text-[10px] ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>на 100 г блюда</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="text-xs font-black text-amber-500">{currentProduct.calories || 240}</div>
                      <div className={`text-[10px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>ккал</div>
                    </div>
                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <div className="text-xs font-black text-blue-500">{currentProduct.proteins || 14} г</div>
                      <div className={`text-[10px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>белки</div>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <div className="text-xs font-black text-rose-500">{currentProduct.fats || 16} г</div>
                      <div className={`text-[10px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>жиры</div>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-xs font-black text-emerald-500">{currentProduct.carbs || 22} г</div>
                      <div className={`text-[10px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>углеводы</div>
                    </div>
                  </div>
                </div>

                {/* INGREDIENTS LIST (СОСТАВ БЛЮДА) */}
                {currentProduct.ingredients && currentProduct.ingredients.length > 0 && (
                  <div className="space-y-1.5">
                    <div className={`text-xs font-black uppercase tracking-wider ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                      Состав блюда
                    </div>
                    <ul className={`text-xs space-y-1 p-3 rounded-2xl border ${
                      isDarkTheme ? 'text-slate-300 bg-slate-950/40 border-slate-800/60' : 'text-slate-700 bg-slate-50 border-slate-200'
                    }`}>
                      {currentProduct.ingredients.map((ing, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                          <span>{ing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ALLERGENS */}
                {currentProduct.allergens && currentProduct.allergens.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[11px] font-bold ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Аллергены:</span>
                    {currentProduct.allergens.map((alg, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/15 text-red-500 border border-red-500/25">
                        {alg}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Bottom Footer / Add to Cart */}
              <div className={`p-4 border-t flex items-center justify-between gap-3 ${
                isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200 shadow-md'
              }`}>
                <div>
                  <div className={`text-[11px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Цена:</div>
                  <div className={`text-xl font-black ${isDarkTheme ? 'text-amber-400' : 'text-slate-900'}`}>
                    {currentProduct.price} ₽
                  </div>
                  {currentProduct.oldPrice && currentProduct.oldPrice > currentProduct.price && (
                    <div className="text-[10px] text-slate-400 line-through">
                      {currentProduct.oldPrice} ₽
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isAvail ? (
                    <div className="px-5 py-2.5 rounded-2xl bg-slate-800/80 text-slate-400 text-xs font-bold border border-slate-700/50">
                      Стоп-лист (недоступно)
                    </div>
                  ) : (cart[currentProduct.id] || 0) > 0 ? (
                    <div className="flex items-center gap-2 bg-blue-600 rounded-2xl p-1.5 text-white">
                      <button 
                        onClick={() => removeFromCart(currentProduct.id)}
                        className="w-8 h-8 rounded-xl bg-blue-700 flex items-center justify-center hover:bg-blue-800 active:scale-95 cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-black px-2 min-w-[20px] text-center">
                        {cart[currentProduct.id]}
                      </span>
                      <button 
                        onClick={() => addToCart(currentProduct.id)}
                        className="w-8 h-8 rounded-xl bg-blue-700 flex items-center justify-center hover:bg-blue-800 active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(currentProduct.id)}
                      className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 active:scale-95 transition-transform flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Добавить в заказ</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= CART & CHECKOUT DRAWER ================= */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className={`w-full max-w-md h-full flex flex-col justify-between border-l shadow-2xl ${
            isDarkTheme ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            
            {/* Drawer Header */}
            <div className={`p-4 border-b flex items-center justify-between ${isDarkTheme ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2 font-black text-sm">
                <ShoppingBag className="w-4 h-4 text-blue-500" />
                <span>Оформление заказа ({totalItemsCount})</span>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                  isDarkTheme ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form & Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* Cart Items list */}
              {cartItems.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
                    isDarkTheme ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold">Корзина пуста</div>
                  <p className={`text-xs ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Выберите блюда в меню, чтобы сделать заказ</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className={`text-xs font-black uppercase ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Ваш заказ:</div>
                  {cartItems.map(item => (
                    <div 
                      key={item.product.id}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border text-xs ${
                        isDarkTheme ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <img src={item.product.image} alt={item.product.name} className="w-10 h-10 rounded-xl object-cover" />
                        <div>
                          <div className={`font-bold line-clamp-1 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{item.product.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-amber-500 font-bold">{item.product.price} ₽</span>
                            {item.product.isAvailable === false && (
                              <span className="text-[10px] font-bold text-red-500 bg-red-500/15 px-1.5 py-0.5 rounded border border-red-500/20">
                                Стоп-лист
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-blue-600 rounded-xl p-1 text-white">
                        <button 
                          onClick={() => removeFromCart(item.product.id)}
                          className="w-5 h-5 rounded-lg bg-blue-700 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-black px-1 min-w-[14px] text-center">{item.quantity}</span>
                        <button 
                          onClick={() => addToCart(item.product.id)}
                          className="w-5 h-5 rounded-lg bg-blue-700 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* PROMOCODE SECTION */}
              {cartItems.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className={`text-xs font-black uppercase flex items-center gap-1 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Tag className="w-3.5 h-3.5 text-blue-500" />
                    <span>Промокод на скидку</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCodeInput}
                      onChange={e => setPromoCodeInput(e.target.value)}
                      placeholder="Введите код (например, VIBE20)"
                      className={`flex-1 px-3 py-2 rounded-xl text-xs uppercase border focus:outline-none focus:border-blue-500 ${
                        isDarkTheme ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer"
                    >
                      Применить
                    </button>
                  </div>
                  {appliedPromo && (
                    <div className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Промокод {appliedPromo.code} применен! (-{discountAmount} ₽)
                    </div>
                  )}
                  {promoError && (
                    <div className="text-[11px] text-red-500 font-medium">
                      {promoError}
                    </div>
                  )}
                </div>
              )}

              {/* CUTLERY (ПРИБОРЫ) */}
              {cartItems.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className={`text-xs font-black uppercase flex items-center gap-1 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Utensils className="w-3.5 h-3.5 text-blue-500" />
                    <span>Приборы и салфетки (бесплатно)</span>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCutleryCount(n)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          cutleryCount === n 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                            : isDarkTheme ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {n} перс.
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* COURIER TIPS (ЧАЕВЫЕ КУРЬЕРУ) */}
              {cartItems.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className={`text-xs font-black uppercase ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                    Благодарность курьеру (чаевые)
                  </div>
                  <div className="flex gap-2">
                    {[0, 50, 100, 150].map(tip => (
                      <button
                        key={tip}
                        type="button"
                        onClick={() => setTipsAmount(tip)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          tipsAmount === tip 
                            ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs' 
                            : isDarkTheme ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {tip === 0 ? 'Без чаевых' : `+${tip} ₽`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CUSTOMER CONTACT FORM */}
              {cartItems.length > 0 && (
                <form id="order-form" onSubmit={handleSubmitOrder} className="space-y-3 pt-3">
                  <div className={`text-xs font-black uppercase ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Контакты и доставка:</div>

                  {/* Name */}
                  <div>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Имя и Фамилия получателя *"
                      className={`w-full p-3 rounded-xl border text-xs focus:outline-none focus:border-blue-500 ${
                        isDarkTheme ? 'bg-slate-950 text-white placeholder:text-slate-600' : 'bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                      } ${formErrors.customerName ? 'border-red-500' : isDarkTheme ? 'border-slate-800' : 'border-slate-200'}`}
                    />
                    {formErrors.customerName && (
                      <span className="text-[10px] text-red-500 mt-1 block">{formErrors.customerName}</span>
                    )}
                  </div>

                  {/* Phone with Mask */}
                  <div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(formatRussianPhone(e.target.value))}
                      placeholder="+7 (9XX) XXX-XX-XX *"
                      className={`w-full p-3 rounded-xl border text-xs font-mono focus:outline-none focus:border-blue-500 ${
                        isDarkTheme ? 'bg-slate-950 text-white placeholder:text-slate-600' : 'bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                      } ${formErrors.phone ? 'border-red-500' : isDarkTheme ? 'border-slate-800' : 'border-slate-200'}`}
                    />
                    {formErrors.phone && (
                      <span className="text-[10px] text-red-500 mt-1 block">{formErrors.phone}</span>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Email для электронного чека *"
                      className={`w-full p-3 rounded-xl border text-xs focus:outline-none focus:border-blue-500 ${
                        isDarkTheme ? 'bg-slate-950 text-white placeholder:text-slate-600' : 'bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                      } ${formErrors.email ? 'border-red-500' : isDarkTheme ? 'border-slate-800' : 'border-slate-200'}`}
                    />
                    {formErrors.email && (
                      <span className="text-[10px] text-red-500 mt-1 block">{formErrors.email}</span>
                    )}
                  </div>

                  {/* Address */}
                  <div>
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Адрес доставки (город, улица, дом, кв.) *"
                      className={`w-full p-3 rounded-xl border text-xs focus:outline-none focus:border-blue-500 ${
                        isDarkTheme ? 'bg-slate-950 text-white placeholder:text-slate-600' : 'bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                      } ${formErrors.address ? 'border-red-500' : isDarkTheme ? 'border-slate-800' : 'border-slate-200'}`}
                    />
                    {formErrors.address && (
                      <span className="text-[10px] text-red-500 mt-1 block">{formErrors.address}</span>
                    )}

                    {/* Recent Addresses Chips */}
                    {savedAddresses.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={`text-[10px] ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>Недавние:</span>
                        {savedAddresses.map((addr, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setAddress(addr)}
                            className={`text-[10px] px-2 py-0.5 rounded-md truncate max-w-[140px] cursor-pointer transition-colors ${
                              isDarkTheme ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {addr}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Comment */}
                  <div>
                    <input
                      type="text"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Комментарий (код домофона, этаж)"
                      className={`w-full p-3 rounded-xl border text-xs focus:outline-none focus:border-blue-500 ${
                        isDarkTheme ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
                      }`}
                    />
                  </div>

                  {/* Payment Method Notice */}
                  <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                    isDarkTheme ? 'border-slate-800 bg-slate-950/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div>
                      <div className={`font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-900'}`}>Оплата при получении</div>
                      <div className={`text-[11px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Наличными или банковской картой курьеру</div>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Drawer Footer */}
            {cartItems.length > 0 && (
              <div className={`p-4 border-t space-y-2.5 ${
                isDarkTheme ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white shadow-lg'
              }`}>
                <div className="space-y-1 text-xs">
                  <div className={`flex justify-between ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span>Сумма блюд:</span>
                    <span>{subtotalPrice} ₽</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-500 font-semibold">
                      <span>Скидка по промокоду:</span>
                      <span>-{discountAmount} ₽</span>
                    </div>
                  )}
                  {tipsAmount > 0 && (
                    <div className="flex justify-between text-amber-500 font-semibold">
                      <span>Чаевые курьеру:</span>
                      <span>+{tipsAmount} ₽</span>
                    </div>
                  )}
                  <div className={`flex justify-between items-center text-sm font-black pt-1 border-t ${
                    isDarkTheme ? 'border-slate-800 text-white' : 'border-slate-100 text-slate-900'
                  }`}>
                    <span>Итого:</span>
                    <span className="text-amber-500 text-lg">{totalPrice} ₽</span>
                  </div>
                </div>

                {cartItems.some(i => i.product.isAvailable === false) && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold text-center">
                    В заказе есть блюда из стоп-листа. Удалите их для оформления.
                  </div>
                )}

                <button
                  type="submit"
                  form="order-form"
                  disabled={cartItems.some(i => i.product.isAvailable === false)}
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                    cartItems.some(i => i.product.isAvailable === false)
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-98 cursor-pointer'
                  }`}
                >
                  <span>Подтвердить заказ ({totalPrice} ₽)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= ORDER DELETE CONFIRMATION MODAL ================= */}
      {orderToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in zoom-in-95">
          <div className={`w-full max-w-sm rounded-3xl p-5 border text-center space-y-3 shadow-2xl ${
            isDarkTheme ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black">Удалить заказ #{orderToDelete.orderNumber}?</h3>
            <p className={`text-xs ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
              Заказ будет удален из истории. Это действие нельзя отменить.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setOrderToDelete(null)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-colors ${
                  isDarkTheme ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                Отмена
              </button>
              <button
                onClick={confirmDeleteOrder}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ORDER SUCCESS MODAL ================= */}
      {orderSuccess && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in zoom-in-95">
          <div className={`w-full max-w-sm rounded-3xl p-6 border text-center shadow-2xl space-y-4 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-lg font-black">Заказ #{orderSuccess.orderNumber} принят!</h2>
              <p className={`text-xs mt-1 ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                Шеф-повар уже получил ваш заказ. Вы можете следить за стадиями приготовления во вкладке «Мои заказы».
              </p>
            </div>

            <div className={`p-3.5 rounded-2xl border text-left text-xs space-y-1.5 ${
              isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex justify-between">
                <span className={isDarkTheme ? 'text-slate-400' : 'text-slate-500'}>Получатель:</span>
                <span className={`font-semibold ${isDarkTheme ? 'text-slate-200' : 'text-slate-900'}`}>{orderSuccess.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className={isDarkTheme ? 'text-slate-400' : 'text-slate-500'}>Телефон:</span>
                <span className="font-medium text-blue-500">{orderSuccess.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className={isDarkTheme ? 'text-slate-400' : 'text-slate-500'}>Сумма:</span>
                <span className="font-black text-amber-500">{orderSuccess.totalPrice} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className={isDarkTheme ? 'text-slate-400' : 'text-slate-500'}>Адрес:</span>
                <span className={`font-medium truncate max-w-[180px] ${isDarkTheme ? 'text-slate-300' : 'text-slate-800'}`}>{orderSuccess.address}</span>
              </div>
            </div>

            <button
              onClick={() => {
                triggerHaptic('light');
                setOrderSuccess(null);
                setActiveTab('orders');
              }}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-md shadow-blue-500/20"
            >
              Перейти к отслеживанию
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
