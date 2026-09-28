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
  CheckCircle2, 
  Banknote, 
  Package, 
  Check, 
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
  MessageCircle, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { CATEGORIES, PRODUCTS as INITIAL_PRODUCTS } from './data/products';
import { Product, CartItem, OrderData, OrderStatus } from './types';

// Backend REST API
const API_BASE_URL = 'https://tg-mini-app-se10.onrender.com';

// Web Audio API Synthesizer for gentle, native audio feedback
function playSound(type: 'add' | 'remove' | 'success' | 'status' | 'error') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'add') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'remove') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.05);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'success') {
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.06;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.22);
      });
    } else if (type === 'status') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.setValueAtTime(120, now + 0.06);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch {
    // fallback
  }
}

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
  if (rest === '123456789' || rest === '987654321' || rest === '012345678' || rest === '111222333') return false;
  return true;
}

function isValidName(name: string): boolean {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return false;
  const nameRegex = /^[A-Za-zА-Яа-яЁё\-]+$/;
  return words.every(w => w.length >= 2 && nameRegex.test(w));
}

function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
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
    return { hour, timeStr: `${String(hour).padStart(2, '0')}:${minutes}`, isDaytime: hour >= 7 && hour < 20 };
  } catch {
    const utcHours = new Date().getUTCHours();
    const hour = (utcHours + 3) % 24;
    return { hour, timeStr: `${String(hour).padStart(2, '0')}:00`, isDaytime: hour >= 7 && hour < 20 };
  }
}

export function App() {
  // Theme state: Soft, organic palette
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => !getMoscowTimeInfo().isDaytime);
  const [moscowTimeStr, setMoscowTimeStr] = useState<string>(() => getMoscowTimeInfo().timeStr);

  // Customer Navigation: 'menu' | 'orders' | 'support'
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'support'>('menu');

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
  
  // Favorites
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tg_store_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modal Detail
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Cart
  const [cart, setCart] = useState<{ [productId: string]: number }>({});
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Orders
  const [orders, setOrders] = useState<OrderData[]>(() => {
    const saved = localStorage.getItem('tg_store_orders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch { /* ignore */ }
    }
    return [];
  });

  const [orderToDelete, setOrderToDelete] = useState<OrderData | null>(null);

  // Customer Checkout Form
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tg_store_addresses');
      return saved ? JSON.parse(saved) : ['г. Москва, ул. Тверская, д. 12'];
    } catch {
      return [];
    }
  });

  // Promocode, Cutlery, Tips
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent?: number; amount?: number } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [cutleryCount, setCutleryCount] = useState<number>(1);
  const [tipsAmount, setTipsAmount] = useState<number>(0);

  const [formErrors, setFormErrors] = useState<{
    customerName?: string;
    phone?: string;
    email?: string;
    address?: string;
  }>({});

  const [orderSuccess, setOrderSuccess] = useState<OrderData | null>(null);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setMoscowTimeStr(getMoscowTimeInfo().timeStr);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Storage
  useEffect(() => {
    localStorage.setItem('tg_store_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('tg_store_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('tg_store_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // Deep Link ?tab=orders
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('tab') === 'orders') {
        setActiveTab('orders');
      }
    } catch {
      // ignore
    }
  }, []);

  // Telegram WebApp Init
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

  // Order status poll with gentle chime notification
  const prevStatusesRef = useRef<{ [orderNum: string]: OrderStatus }>({});

  useEffect(() => {
    let isMounted = true;
    const fetchOrders = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/orders?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok && isMounted) {
          const serverOrders = await res.json();
          if (Array.isArray(serverOrders)) {
            let statusChanged = false;
            serverOrders.forEach((o: OrderData) => {
              if (o.orderNumber && o.status) {
                const oldSt = prevStatusesRef.current[o.orderNumber];
                if (oldSt && oldSt !== o.status) {
                  statusChanged = true;
                }
                prevStatusesRef.current[o.orderNumber] = o.status;
              }
            });

            if (statusChanged) {
              playSound('status');
              try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'); } catch {}
            }

            setOrders(serverOrders);
            localStorage.setItem('tg_store_orders', JSON.stringify(serverOrders));
          }
        }
      } catch {
        // silent
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Live products sync
  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok && isMounted) {
          const serverProducts = await res.json();
          if (Array.isArray(serverProducts) && serverProducts.length > 0) {
            setProducts(prev => {
              const updated = prev.map(p => {
                const sp = serverProducts.find((s: { id: string; price?: number; isAvailable?: boolean; is_available?: number; oldPrice?: number }) => s.id === p.id);
                if (sp) {
                  return {
                    ...p,
                    price: typeof sp.price === 'number' ? sp.price : p.price,
                    isAvailable: sp.isAvailable !== undefined ? Boolean(sp.isAvailable) : (sp.is_available !== undefined ? Boolean(sp.is_available) : p.isAvailable),
                    oldPrice: sp.oldPrice !== undefined ? sp.oldPrice : p.oldPrice
                  };
                }
                return p;
              });
              localStorage.setItem('tg_store_products', JSON.stringify(updated));
              return updated;
            });
          }
        }
      } catch {}
    };

    fetchProducts();
    const interval = setInterval(fetchProducts, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const triggerHaptic = (type: 'light' | 'medium' | 'success' | 'error') => {
    try {
      if (type === 'success' || type === 'error') {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);
      } else {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(type);
      }
    } catch {}
  };

  const toggleWishlist = (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic('light');
    playSound('add');
    setWishlist(prev => 
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const addToCart = (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic('light');
    playSound('add');
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }));
  };

  const removeFromCart = (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic('light');
    playSound('remove');
    setCart(prev => {
      const cur = prev[productId] || 0;
      if (cur <= 1) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: cur - 1 };
    });
  };

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

  useEffect(() => {
    if (appliedPromo?.code === 'WELCOME' && subtotalPrice < 800) {
      setAppliedPromo(null);
      setPromoError('Промокод отменен: сумма заказа меньше 800 ₽');
      playSound('error');
    }
  }, [subtotalPrice, appliedPromo]);

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

  const handleApplyPromo = () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;
    triggerHaptic('medium');

    if (code === 'VIBE20') {
      setAppliedPromo({ code, percent: 20 });
      setPromoError('');
      playSound('success');
    } else if (code === 'WELCOME') {
      if (subtotalPrice < 800) {
        setPromoError('Действует при заказе от 800 ₽');
        playSound('error');
        return;
      }
      setAppliedPromo({ code, amount: 300 });
      setPromoError('');
      playSound('success');
    } else {
      setPromoError('Неверный промокод');
      triggerHaptic('error');
      playSound('error');
    }
  };

  const handleRepeatOrder = (order: OrderData) => {
    triggerHaptic('medium');
    const newCart: { [id: string]: number } = {};
    const skippedItems: string[] = [];

    for (const item of order.items) {
      const prod = products.find(p => p.id === item.id);
      if (prod && prod.isAvailable !== false) {
        newCart[item.id] = item.quantity;
      } else {
        skippedItems.push(item.name);
      }
    }

    setCart(newCart);
    if (order.address) setAddress(order.address);
    if (order.customerName) setCustomerName(order.customerName);
    if (order.phone) setPhone(order.phone);
    if (order.email) setEmail(order.email);

    if (skippedItems.length > 0) {
      alert(`Позиции (${skippedItems.join(', ')}) временно в стоп-листе и пропущены.`);
      playSound('error');
    } else {
      playSound('add');
    }
    setIsCartOpen(true);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    triggerHaptic('medium');
    playSound('remove');
    const orderNum = orderToDelete.orderNumber;

    setOrders(prev => prev.filter(o => o.orderNumber !== orderNum));

    try {
      await fetch(`${API_BASE_URL}/api/orders/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderNum })
      });
    } catch {}

    setOrderToDelete(null);
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();

    const errors: typeof formErrors = {};
    if (!isValidName(customerName)) errors.customerName = 'Имя и фамилия (только буквы)';
    if (!isValidPhone(phone)) errors.phone = 'Укажите номер РФ (+7 9XX XXX-XX-XX)';
    if (!isValidEmail(email)) errors.email = 'Укажите корректный email';
    if (!isValidAddress(address)) errors.address = 'Улица и дом (мин. 8 символов)';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      triggerHaptic('error');
      playSound('error');
      return;
    }

    const unavailableItem = cartItems.find(item => item.product.isAvailable === false);
    if (unavailableItem) {
      alert(`Блюдо "${unavailableItem.product.name}" в стоп-листе. Удалите его из корзины.`);
      triggerHaptic('error');
      playSound('error');
      return;
    }

    setFormErrors({});
    triggerHaptic('success');
    playSound('success');

    if (!savedAddresses.includes(address.trim())) {
      const updated = [address.trim(), ...savedAddresses.slice(0, 2)];
      setSavedAddresses(updated);
      localStorage.setItem('tg_store_addresses', JSON.stringify(updated));
    }

    const orderNum = String(Math.floor(100000 + Math.random() * 900000));
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
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      status: 'new',
      createdAt: 'Только что'
    };

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
    } catch {}

    if (window.Telegram?.WebApp?.sendData) {
      try {
        window.Telegram.WebApp.sendData(JSON.stringify(newOrder));
      } catch {}
    }

    setOrders(prev => [newOrder, ...prev]);
    setIsCartOpen(false);
    setCart({});
    setOrderSuccess(newOrder);
  };

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
  }, [orders]);

  // Organic soft colors
  const theme = {
    bg: isDarkTheme ? 'bg-[#121316]' : 'bg-[#faf9f6]',
    cardBg: isDarkTheme ? 'bg-[#1b1c20]' : 'bg-[#ffffff]',
    cardBorder: isDarkTheme ? 'border-[#26282e]' : 'border-[#eeece7]',
    subtleBg: isDarkTheme ? 'bg-[#16171b]' : 'bg-[#f4f2ed]',
    textPrimary: isDarkTheme ? 'text-[#f2f1ec]' : 'text-[#1c1b18]',
    textMuted: isDarkTheme ? 'text-[#8e9098]' : 'text-[#7e7b75]',
    accentColor: isDarkTheme ? 'text-[#e58d4a]' : 'text-[#c86428]',
    accentBg: isDarkTheme ? 'bg-[#e58d4a] text-black' : 'bg-[#1c1b18] text-white',
    pillActive: isDarkTheme ? 'bg-[#f2f1ec] text-[#121316]' : 'bg-[#1c1b18] text-[#ffffff]',
    pillInactive: isDarkTheme ? 'bg-[#1b1c20] text-[#8e9098] border border-[#26282e]' : 'bg-[#ffffff] text-[#6d6a64] border border-[#eeece7]'
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-150 select-none pb-24 ${theme.bg} ${theme.textPrimary}`}>

      {/* MINIMALIST HEADER */}
      <header className={`sticky top-0 z-30 px-4 py-3 border-b transition-colors ${
        isDarkTheme ? 'bg-[#121316]/95 border-[#22242a]' : 'bg-[#faf9f6]/95 border-[#edebe5]'
      }`}>
        <div className="flex items-center justify-between gap-3">
          
          {/* Refined Brand typography */}
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[15px] font-semibold tracking-tight ${theme.textPrimary}`}>
                Vibe Kitchen
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#c86428]" />
            </div>
            <div className={`text-[11px] font-medium ${theme.textMuted}`}>
              Гастрономическое бистро
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2">
            
            {/* Soft Moscow Time Pill */}
            <button
              onClick={() => {
                triggerHaptic('light');
                setIsDarkTheme(!isDarkTheme);
              }}
              title="Переключить тему"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                isDarkTheme 
                  ? 'bg-[#1b1c20] border-[#292c33] text-[#c7c6bf]' 
                  : 'bg-[#ffffff] border-[#e7e5de] text-[#55524c]'
              }`}
            >
              {isDarkTheme ? <Moon className="w-3.5 h-3.5 text-[#e58d4a]" /> : <Sun className="w-3.5 h-3.5 text-[#c86428]" />}
              <span>{moscowTimeStr}</span>
            </button>

            {/* Cart Button */}
            <button
              onClick={() => {
                triggerHaptic('medium');
                setIsCartOpen(true);
              }}
              className={`relative p-2 rounded-xl transition-transform active:scale-95 cursor-pointer ${theme.accentBg}`}
            >
              <ShoppingBag className="w-4 h-4" />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#c86428] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white">
                  {totalItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Live Active Order Banner in Header */}
        {activeOrders.length > 0 && activeTab === 'menu' && (
          <div 
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('orders');
            }}
            className={`mt-2 p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer ${
              isDarkTheme ? 'bg-[#1b1c20] border-[#292c33]' : 'bg-[#ffffff] border-[#e7e5de]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#c86428]" />
              <span className="font-medium">Заказ в процессе</span>
            </div>
            <div className={`flex items-center gap-1 font-semibold ${theme.accentColor}`}>
              <span>Статус</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-xl mx-auto w-full px-3.5 pt-3">

        {/* ================= TAB 1: MENU ================= */}
        {activeTab === 'menu' && (
          <div className="space-y-3.5">
            
            {/* Search Bar */}
            <div className="relative">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${theme.textMuted}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по меню..."
                className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs border transition-colors focus:outline-none ${
                  isDarkTheme 
                    ? 'bg-[#1b1c20] border-[#26282e] text-[#f2f1ec] placeholder:text-[#6c6e75] focus:border-[#4f525c]' 
                    : 'bg-[#ffffff] border-[#eeece7] text-[#1c1b18] placeholder:text-[#a09d96] focus:border-[#b8b5ac]'
                }`}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${theme.textMuted}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Chips Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedCategory('all');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === 'all' ? theme.pillActive : theme.pillInactive
                }`}
              >
                Все блюда
              </button>

              <button
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedCategory('favorites');
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === 'favorites' 
                    ? (isDarkTheme ? 'bg-[#e54a4a] text-white' : 'bg-[#d03a3a] text-white')
                    : theme.pillInactive
                }`}
              >
                <Heart className={`w-3 h-3 ${wishlist.length > 0 ? 'fill-current' : ''}`} />
                <span>Избранное ({wishlist.length})</span>
              </button>

              {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat.id ? theme.pillActive : theme.pillInactive
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {filteredProducts.map(product => {
                const qty = cart[product.id] || 0;
                const isFav = wishlist.includes(product.id);
                const isAvail = product.isAvailable !== false;

                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`rounded-2xl border flex flex-col justify-between overflow-hidden transition-all cursor-pointer ${
                      theme.cardBg
                    } ${theme.cardBorder} ${!isAvail ? 'opacity-50 grayscale-[35%]' : ''}`}
                  >
                    {/* Natural Image Container */}
                    <div className="relative aspect-4/3 overflow-hidden bg-[#202125]">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />

                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {product.badge && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#141518]/80 text-white backdrop-blur-xs">
                            {product.badge}
                          </span>
                        )}
                        {product.spicy && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#bd3a2e]/90 text-white backdrop-blur-xs flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" /> Острое
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => toggleWishlist(product.id, e)}
                        className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-xs transition-transform active:scale-90 ${
                          isFav ? 'bg-[#d03a3a] text-white' : 'bg-black/35 text-white'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                      </button>

                      {product.weight && (
                        <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/55 backdrop-blur-xs text-[10px] text-white/90">
                          {product.weight}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className={`text-xs font-semibold tracking-tight line-clamp-1 mb-0.5 ${theme.textPrimary}`}>
                          {product.name}
                        </h3>
                        <p className={`text-[11px] line-clamp-2 leading-relaxed mb-2.5 ${theme.textMuted}`}>
                          {product.description}
                        </p>
                      </div>

                      {/* Price & Add Action */}
                      <div className={`flex items-center justify-between pt-1 border-t ${
                        isDarkTheme ? 'border-[#26282e]' : 'border-[#f0eee9]'
                      }`}>
                        <div>
                          <div className={`text-sm font-semibold ${theme.textPrimary}`}>
                            {product.price} ₽
                          </div>
                          {product.oldPrice && product.oldPrice > product.price && (
                            <div className={`text-[10px] line-through ${theme.textMuted}`}>
                              {product.oldPrice} ₽
                            </div>
                          )}
                        </div>

                        {isAvail ? (
                          qty > 0 ? (
                            <div 
                              onClick={e => e.stopPropagation()} 
                              className={`flex items-center gap-1.5 rounded-lg p-0.5 ${theme.accentBg}`}
                            >
                              <button 
                                onClick={e => removeFromCart(product.id, e)}
                                className="w-5 h-5 rounded flex items-center justify-center cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-semibold px-1 min-w-[14px] text-center">{qty}</span>
                              <button 
                                onClick={e => addToCart(product.id, e)}
                                className="w-5 h-5 rounded flex items-center justify-center cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={e => addToCart(product.id, e)}
                              className={`px-2.5 py-1 rounded-lg font-medium text-xs transition-colors flex items-center gap-1 cursor-pointer ${theme.accentBg}`}
                            >
                              <Plus className="w-3 h-3" />
                              <span>Добавить</span>
                            </button>
                          )
                        ) : (
                          <span className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded ${theme.subtleBg} ${theme.textMuted}`}>
                            Стоп
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 2: MY ORDERS ================= */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className={`text-sm font-semibold tracking-tight ${theme.textPrimary}`}>
                  Мои заказы
                </h2>
                <p className={`text-[11px] ${theme.textMuted}`}>
                  Отслеживание статуса и времени доставки
                </p>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-lg border ${theme.cardBorder} ${theme.textMuted}`}>
                {orders.length} заказов
              </span>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-16 space-y-2.5">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${theme.subtleBg} ${theme.textMuted}`}>
                  <Package className="w-6 h-6" />
                </div>
                <h3 className={`text-xs font-semibold ${theme.textPrimary}`}>
                  Заказов пока нет
                </h3>
                <p className={`text-[11px] max-w-xs mx-auto ${theme.textMuted}`}>
                  Выберите понравившиеся блюда в меню
                </p>
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveTab('menu');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-medium cursor-pointer ${theme.accentBg}`}
                >
                  Перейти в меню
                </button>
              </div>
            ) : (
              orders.map(order => {
                const stageIndex = order.status === 'cooking' ? 2 : order.status === 'delivering' ? 3 : order.status === 'completed' ? 4 : 1;
                const isCancelled = order.status === 'cancelled';

                return (
                  <div
                    key={order.orderNumber || order.id}
                    className={`rounded-2xl border p-3.5 space-y-3 transition-colors ${theme.cardBg} ${theme.cardBorder}`}
                  >
                    {/* Header */}
                    <div className={`flex items-center justify-between pb-2 border-b ${
                      isDarkTheme ? 'border-[#26282e]' : 'border-[#f0eee9]'
                    }`}>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold text-xs ${theme.textPrimary}`}>
                            Заказ #{order.orderNumber}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            order.status === 'completed' ? 'bg-[#2b8a3e]/15 text-[#37b24d]' :
                            order.status === 'delivering' ? 'bg-[#1971c2]/15 text-[#339af0]' :
                            order.status === 'cooking' ? 'bg-[#e58d4a]/15 text-[#e58d4a]' :
                            order.status === 'cancelled' ? 'bg-[#e03131]/15 text-[#f03e3e]' :
                            theme.subtleBg
                          }`}>
                            {order.status === 'completed' ? 'Доставлен' :
                             order.status === 'delivering' ? 'Курьер в пути' :
                             order.status === 'cooking' ? 'На кухне' :
                             order.status === 'cancelled' ? 'Отменен' : 'Принят'}
                          </span>
                        </div>
                        <div className={`text-[10px] mt-0.5 ${theme.textMuted}`}>{order.createdAt}</div>
                      </div>

                      <div className="text-right">
                        <div className={`text-sm font-semibold ${theme.textPrimary}`}>
                          {order.totalPrice} ₽
                        </div>
                        <div className={`text-[10px] ${theme.textMuted}`}>
                          Оплата при получении
                        </div>
                      </div>
                    </div>

                    {/* ETA (TIME ESTIMATE) FROM ADMIN */}
                    {!isCancelled && (order.estimatedTime || order.statusNote) && (
                      <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        isDarkTheme ? 'bg-[#1f2026] border-[#2c2e35]' : 'bg-[#f7f5ee] border-[#eae6db]'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Clock className={`w-3.5 h-3.5 ${theme.accentColor} shrink-0`} />
                          <div>
                            {order.estimatedTime && (
                              <span className={`font-medium ${theme.textPrimary}`}>Примерное время: {order.estimatedTime}</span>
                            )}
                            {order.statusNote && (
                              <div className={`text-[11px] ${theme.textMuted}`}>{order.statusNote}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stepper */}
                    {!isCancelled && (
                      <div className={`p-2.5 rounded-xl border ${theme.subtleBg} ${theme.cardBorder}`}>
                        <div className="relative flex items-center justify-between px-2 pt-1 pb-1">
                          <div className={`absolute left-5 right-5 top-3.5 h-0.5 -translate-y-1/2 z-0 ${
                            isDarkTheme ? 'bg-[#2a2c33]' : 'bg-[#e2dfd7]'
                          }`} />
                          
                          <div 
                            className="absolute left-5 top-3.5 h-0.5 -translate-y-1/2 bg-[#c86428] transition-all duration-300 z-0" 
                            style={{ width: `${((stageIndex - 1) / 3) * 100}%` }}
                          />

                          <div className="relative z-10 flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                              stageIndex >= 1 ? 'bg-[#c86428] text-white' : (isDarkTheme ? 'bg-[#22242a] text-[#6c6e75]' : 'bg-[#e6e3da] text-[#797670]')
                            }`}>
                              <Check className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-[10px] ${theme.textMuted}`}>Принят</span>
                          </div>

                          <div className="relative z-10 flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                              stageIndex >= 2 ? 'bg-[#c86428] text-white' : (isDarkTheme ? 'bg-[#22242a] text-[#6c6e75]' : 'bg-[#e6e3da] text-[#797670]')
                            }`}>
                              <ChefHat className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-[10px] ${theme.textMuted}`}>Кухня</span>
                          </div>

                          <div className="relative z-10 flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                              stageIndex >= 3 ? 'bg-[#c86428] text-white' : (isDarkTheme ? 'bg-[#22242a] text-[#6c6e75]' : 'bg-[#e6e3da] text-[#797670]')
                            }`}>
                              <Bike className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-[10px] ${theme.textMuted}`}>В пути</span>
                          </div>

                          <div className="relative z-10 flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                              stageIndex >= 4 ? 'bg-[#2b8a3e] text-white' : (isDarkTheme ? 'bg-[#22242a] text-[#6c6e75]' : 'bg-[#e6e3da] text-[#797670]')
                            }`}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-[10px] ${theme.textMuted}`}>Доставлен</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Order Items */}
                    <div className="space-y-1 text-xs">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px]">
                          <span className={`truncate max-w-[220px] ${theme.textPrimary}`}>
                            {item.quantity} × {item.name}
                          </span>
                          <span className={`font-medium ${theme.textMuted}`}>{item.price * item.quantity} ₽</span>
                        </div>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className={`flex items-center gap-2 pt-2 border-t ${
                      isDarkTheme ? 'border-[#26282e]' : 'border-[#f0eee9]'
                    }`}>
                      <button
                        onClick={() => handleRepeatOrder(order)}
                        className={`flex-1 py-1.5 rounded-lg border font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          isDarkTheme ? 'border-[#2f323a] hover:bg-[#202227] text-[#c7c6bf]' : 'border-[#dfdbd1] hover:bg-[#f3f0ea] text-[#4f4c46]'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Повторить заказ</span>
                      </button>

                      <button
                        onClick={() => setOrderToDelete(order)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          isDarkTheme ? 'border-[#26282e] text-[#6c6e75] hover:text-[#e03131]' : 'border-[#eeece7] text-[#a09d96] hover:text-[#d03a3a]'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= TAB 3: SUPPORT ================= */}
        {activeTab === 'support' && (
          <div className="space-y-3.5">
            <div>
              <h2 className={`text-sm font-semibold tracking-tight ${theme.textPrimary}`}>
                Служба заботы
              </h2>
              <p className={`text-[11px] ${theme.textMuted}`}>
                Отвечаем на любые вопросы о заказах и доставке
              </p>
            </div>

            <div className={`p-4 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} space-y-2.5`}>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#c86428]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ресторан авторской кухни</span>
              </div>
              <h3 className={`text-xs font-medium leading-relaxed ${theme.textPrimary}`}>
                Готовим блюда из свежих отборных продуктов и доставляем в крафтовой эко-упаковке.
              </h3>

              <a
                href="https://t.me/qqeaux"
                target="_blank"
                rel="noreferrer"
                className={`w-full py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${theme.accentBg}`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Написать в поддержку (@qqeaux)</span>
              </a>
            </div>

            <div className={`rounded-2xl border p-3.5 space-y-2 ${theme.cardBg} ${theme.cardBorder}`}>
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${theme.textPrimary}`}>
                <HelpCircle className="w-4 h-4 text-[#c86428]" />
                <span>Частые вопросы</span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className={`p-2.5 rounded-xl border ${theme.subtleBg} ${theme.cardBorder}`}>
                  <div className={`font-medium mb-0.5 ${theme.textPrimary}`}>Как отслеживать статус?</div>
                  <div className={`text-[11px] ${theme.textMuted}`}>
                    Во вкладке «Заказы» отображаются стадии приготовления и расчетное время от шефа.
                  </div>
                </div>

                <div className={`p-2.5 rounded-xl border ${theme.subtleBg} ${theme.cardBorder}`}>
                  <div className={`font-medium mb-0.5 ${theme.textPrimary}`}>Способ оплаты</div>
                  <div className={`text-[11px] ${theme.textMuted}`}>
                    Оплата происходит при получении курьеру — наличными или банковской картой.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FIXED BOTTOM NAVIGATION */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-lg transition-colors ${
        isDarkTheme ? 'bg-[#121316]/95 border-[#22242a]' : 'bg-[#faf9f6]/95 border-[#edebe5]'
      }`}>
        <div className="max-w-md mx-auto grid grid-cols-4 px-2 py-1.5">
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('menu');
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'menu' ? (isDarkTheme ? 'text-[#f2f1ec] font-semibold' : 'text-[#1c1b18] font-semibold') : theme.textMuted
            }`}
          >
            <Utensils className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Меню</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('orders');
            }}
            className={`relative flex flex-col items-center justify-center py-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'orders' ? (isDarkTheme ? 'text-[#f2f1ec] font-semibold' : 'text-[#1c1b18] font-semibold') : theme.textMuted
            }`}
          >
            <Package className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Заказы</span>
            {activeOrders.length > 0 && (
              <span className="absolute top-1 right-5 w-2 h-2 rounded-full bg-[#c86428]" />
            )}
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('support');
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'support' ? (isDarkTheme ? 'text-[#f2f1ec] font-semibold' : 'text-[#1c1b18] font-semibold') : theme.textMuted
            }`}
          >
            <HelpCircle className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Инфо</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setIsCartOpen(true);
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors cursor-pointer ${theme.textMuted}`}
          >
            <ShoppingBag className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Корзина</span>
          </button>
        </div>
      </nav>

      {/* PRODUCT DETAIL MODAL */}
      {selectedProduct && (() => {
        const currentProduct = products.find(p => p.id === selectedProduct.id) || selectedProduct;
        const isAvail = currentProduct.isAvailable !== false;

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
            <div className={`w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88vh] flex flex-col overflow-hidden border shadow-xl ${
              theme.cardBg
            } ${theme.cardBorder}`}>
              
              <div className="relative aspect-16/9 w-full bg-[#1b1c20] overflow-hidden shrink-0">
                <img 
                  src={currentProduct.image} 
                  alt={currentProduct.name} 
                  className={`w-full h-full object-cover ${!isAvail ? 'opacity-50 grayscale-[35%]' : ''}`}
                />
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-transform active:scale-95 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                  {!isAvail ? (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#bd3a2e] text-white">
                      Стоп-лист
                    </span>
                  ) : currentProduct.badge ? (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#141518]/85 text-white">
                      {currentProduct.badge}
                    </span>
                  ) : null}
                  {currentProduct.weight && (
                    <span className="px-2 py-0.5 rounded text-xs text-white/90 bg-black/50">
                      {currentProduct.weight}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 overflow-y-auto space-y-3.5">
                <div>
                  <h2 className={`text-base font-semibold tracking-tight ${theme.textPrimary}`}>{currentProduct.name}</h2>
                  <p className={`text-xs mt-1 leading-relaxed ${theme.textMuted}`}>
                    {currentProduct.description}
                  </p>
                </div>

                {/* KBJU Grid */}
                <div className={`p-3 rounded-xl border ${theme.subtleBg} ${theme.cardBorder}`}>
                  <div className={`text-[10px] font-medium uppercase tracking-wider mb-2 flex justify-between ${theme.textMuted}`}>
                    <span>Энергетическая ценность</span>
                    <span>на всю порцию {currentProduct.weight ? `(${currentProduct.weight})` : ''}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className={`p-1.5 rounded-lg ${isDarkTheme ? 'bg-[#202126]' : 'bg-[#e9e6df]'}`}>
                      <div className="font-semibold text-[#c86428]">{currentProduct.calories || 240}</div>
                      <div className={`text-[10px] ${theme.textMuted}`}>ккал</div>
                    </div>
                    <div className={`p-1.5 rounded-lg ${isDarkTheme ? 'bg-[#202126]' : 'bg-[#e9e6df]'}`}>
                      <div className="font-semibold">{currentProduct.proteins || 14} г</div>
                      <div className={`text-[10px] ${theme.textMuted}`}>белки</div>
                    </div>
                    <div className={`p-1.5 rounded-lg ${isDarkTheme ? 'bg-[#202126]' : 'bg-[#e9e6df]'}`}>
                      <div className="font-semibold">{currentProduct.fats || 16} г</div>
                      <div className={`text-[10px] ${theme.textMuted}`}>жиры</div>
                    </div>
                    <div className={`p-1.5 rounded-lg ${isDarkTheme ? 'bg-[#202126]' : 'bg-[#e9e6df]'}`}>
                      <div className="font-semibold">{currentProduct.carbs || 22} г</div>
                      <div className={`text-[10px] ${theme.textMuted}`}>углеводы</div>
                    </div>
                  </div>
                </div>

                {/* Ingredients */}
                {currentProduct.ingredients && currentProduct.ingredients.length > 0 && (
                  <div className="space-y-1">
                    <div className={`text-xs font-semibold ${theme.textMuted}`}>Состав</div>
                    <ul className={`text-xs space-y-0.5 p-2.5 rounded-xl border ${theme.subtleBg} ${theme.cardBorder}`}>
                      {currentProduct.ingredients.map((ing, i) => (
                        <li key={i} className={`flex items-center gap-1.5 text-[11px] ${theme.textPrimary}`}>
                          <span className="w-1 h-1 rounded-full bg-[#c86428]" />
                          <span>{ing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className={`p-3.5 border-t flex items-center justify-between gap-3 ${
                isDarkTheme ? 'border-[#26282e] bg-[#17181c]' : 'border-[#eeece7] bg-[#f8f7f3]'
              }`}>
                <div>
                  <div className={`text-[10px] ${theme.textMuted}`}>Стоимость:</div>
                  <div className={`text-base font-semibold ${theme.textPrimary}`}>
                    {currentProduct.price} ₽
                  </div>
                </div>

                <div>
                  {!isAvail ? (
                    <span className={`px-4 py-2 rounded-xl text-xs font-medium ${theme.subtleBg} ${theme.textMuted}`}>
                      Недоступно
                    </span>
                  ) : (cart[currentProduct.id] || 0) > 0 ? (
                    <div className={`flex items-center gap-1.5 rounded-xl p-1 ${theme.accentBg}`}>
                      <button 
                        onClick={() => removeFromCart(currentProduct.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-semibold px-2 text-center">
                        {cart[currentProduct.id]}
                      </span>
                      <button 
                        onClick={() => addToCart(currentProduct.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(currentProduct.id)}
                      className={`px-5 py-2.5 rounded-xl font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${theme.accentBg}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>В корзину</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CART & CHECKOUT DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className={`w-full max-w-md h-full flex flex-col justify-between border-l ${theme.cardBg} ${theme.cardBorder}`}>
            <div className={`p-3.5 border-b flex items-center justify-between ${
              isDarkTheme ? 'border-[#26282e]' : 'border-[#eeece7]'
            }`}>
              <div className="flex items-center gap-2 font-semibold text-xs">
                <ShoppingBag className="w-4 h-4 text-[#c86428]" />
                <span>Корзина ({totalItemsCount})</span>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className={`p-1 rounded-lg ${theme.textMuted} cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
              {cartItems.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto ${theme.subtleBg} ${theme.textMuted}`}>
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className={`text-xs font-semibold ${theme.textPrimary}`}>Корзина пуста</div>
                  <p className={`text-[11px] ${theme.textMuted}`}>Выберите понравившиеся блюда</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cartItems.map(item => (
                    <div 
                      key={item.product.id}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs ${theme.subtleBg} ${theme.cardBorder}`}
                    >
                      <div className="flex items-center gap-2 truncate max-w-[190px]">
                        <img src={item.product.image} alt={item.product.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                        <div className="truncate">
                          <div className={`font-medium truncate ${theme.textPrimary}`}>{item.product.name}</div>
                          <div className="text-[#c86428] font-semibold">{item.product.price} ₽</div>
                        </div>
                      </div>

                      <div className={`flex items-center gap-1 rounded-lg p-0.5 ${theme.accentBg}`}>
                        <button 
                          onClick={() => removeFromCart(item.product.id)}
                          className="w-5 h-5 rounded flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-semibold px-1 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => addToCart(item.product.id)}
                          className="w-5 h-5 rounded flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Promocode */}
              {cartItems.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={promoCodeInput}
                      onChange={e => setPromoCodeInput(e.target.value)}
                      placeholder="Промокод (VIBE20)"
                      className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs uppercase border focus:outline-none ${
                        isDarkTheme 
                          ? 'bg-[#1b1c20] border-[#26282e] text-[#f2f1ec] placeholder:text-[#6c6e75]' 
                          : 'bg-[#ffffff] border-[#eeece7] text-[#1c1b18] placeholder:text-[#a09d96]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className={`px-3 py-1.5 rounded-lg font-medium text-xs cursor-pointer ${theme.accentBg}`}
                    >
                      Применить
                    </button>
                  </div>
                  {appliedPromo && <div className="text-[11px] text-[#2b8a3e] font-medium">Промокод {appliedPromo.code} применен!</div>}
                  {promoError && <div className="text-[11px] text-[#bd3a2e] font-medium">{promoError}</div>}
                </div>
              )}

              {/* Checkout Form */}
              {cartItems.length > 0 && (
                <form id="order-form" onSubmit={handleSubmitOrder} className="space-y-2.5 pt-2">
                  <div className={`text-[10px] font-medium uppercase ${theme.textMuted}`}>Куда и кому доставить:</div>
                  
                  <div>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Имя и Фамилия"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                        isDarkTheme ? 'bg-[#1b1c20] border-[#26282e] text-[#f2f1ec]' : 'bg-[#ffffff] border-[#eeece7] text-[#1c1b18]'
                      }`}
                    />
                    {formErrors.customerName && <div className="text-[10px] text-[#bd3a2e] mt-0.5">{formErrors.customerName}</div>}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(formatRussianPhone(e.target.value))}
                      placeholder="+7 (9XX) XXX-XX-XX"
                      className={`w-full px-3 py-2 rounded-xl text-xs font-mono border focus:outline-none ${
                        isDarkTheme ? 'bg-[#1b1c20] border-[#26282e] text-[#f2f1ec]' : 'bg-[#ffffff] border-[#eeece7] text-[#1c1b18]'
                      }`}
                    />
                    {formErrors.phone && <div className="text-[10px] text-[#bd3a2e] mt-0.5">{formErrors.phone}</div>}
                  </div>

                  <div>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Email для электронного чека"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                        isDarkTheme ? 'bg-[#1b1c20] border-[#26282e] text-[#f2f1ec]' : 'bg-[#ffffff] border-[#eeece7] text-[#1c1b18]'
                      }`}
                    />
                    {formErrors.email && <div className="text-[10px] text-[#bd3a2e] mt-0.5">{formErrors.email}</div>}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Адрес (город, улица, дом, кв)"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                        isDarkTheme ? 'bg-[#1b1c20] border-[#26282e] text-[#f2f1ec]' : 'bg-[#ffffff] border-[#eeece7] text-[#1c1b18]'
                      }`}
                    />
                    {formErrors.address && <div className="text-[10px] text-[#bd3a2e] mt-0.5">{formErrors.address}</div>}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Пожелание курьеру (этаж, домофон)"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none ${
                        isDarkTheme ? 'bg-[#1b1c20] border-[#26282e] text-[#f2f1ec]' : 'bg-[#ffffff] border-[#eeece7] text-[#1c1b18]'
                      }`}
                    />
                  </div>

                  <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${theme.subtleBg} ${theme.cardBorder}`}>
                    <Banknote className="w-4 h-4 text-[#2b8a3e] shrink-0" />
                    <span className={theme.textPrimary}>Оплата при получении курьеру (наличные или карта)</span>
                  </div>
                </form>
              )}
            </div>

            {cartItems.length > 0 && (
              <div className={`p-3.5 border-t space-y-2.5 ${
                isDarkTheme ? 'border-[#26282e] bg-[#141518]' : 'border-[#eeece7] bg-[#f8f7f4]'
              }`}>
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span>Итого к оплате:</span>
                  <span className="text-[#c86428] text-base">{totalPrice} ₽</span>
                </div>

                <button
                  type="submit"
                  form="order-form"
                  className={`w-full py-3 rounded-xl font-medium text-xs transition-colors cursor-pointer ${theme.accentBg}`}
                >
                  Оформить заказ ({totalPrice} ₽)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ORDER SUCCESS MODAL */}
      {orderSuccess && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className={`w-full max-w-xs rounded-2xl p-5 border text-center space-y-3 ${theme.cardBg} ${theme.cardBorder}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto ${theme.subtleBg} text-[#2b8a3e]`}>
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className={`text-sm font-semibold ${theme.textPrimary}`}>Заказ #{orderSuccess.orderNumber} принят!</h2>
              <p className={`text-[11px] mt-0.5 ${theme.textMuted}`}>
                Шеф-повар уже готовит блюда. Вы можете следить за статусом во вкладке «Заказы».
              </p>
            </div>

            <button
              onClick={() => {
                triggerHaptic('light');
                setOrderSuccess(null);
                setActiveTab('orders');
              }}
              className={`w-full py-2.5 rounded-xl font-medium text-xs cursor-pointer ${theme.accentBg}`}
            >
              Перейти к заказам
            </button>
          </div>
        </div>
      )}

      {/* SINGLE ORDER DELETE MODAL */}
      {orderToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className={`w-full max-w-xs rounded-2xl p-4 border text-center space-y-3 ${theme.cardBg} ${theme.cardBorder}`}>
            <h3 className={`text-xs font-semibold ${theme.textPrimary}`}>Удалить заказ #{orderToDelete.orderNumber}?</h3>
            <p className={`text-[11px] ${theme.textMuted}`}>Заказ исчезнет из списка ваших заказов.</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOrderToDelete(null)}
                className={`flex-1 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${theme.cardBorder} ${theme.textMuted}`}
              >
                Отмена
              </button>
              <button
                onClick={confirmDeleteOrder}
                className="flex-1 py-1.5 rounded-lg bg-[#bd3a2e] text-white text-xs font-medium cursor-pointer"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
