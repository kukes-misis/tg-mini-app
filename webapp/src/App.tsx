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
  Sparkles,
  Banknote, 
  Package, 
  Edit2, 
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
  ExternalLink, 
  MessageCircle, 
  ChevronRight 
} from 'lucide-react';
import { CATEGORIES, PRODUCTS as INITIAL_PRODUCTS } from './data/products';
import { Product, CartItem, OrderData, OrderStatus } from './types';

// --- CONFIG & HELPERS ---

const API_BASE_URL = 'https://tg-mini-app-se10.onrender.com';

// Web Audio API Synthesizer for rich, native audio feedback
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
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.07);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === 'remove') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'success') {
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.06;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.16, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.24);
      });
    } else if (type === 'status') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1318.51, now);
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.2);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.setValueAtTime(130, now + 0.06);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch {
    // AudioContext blocked or unsupported; fallback silently
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

  // Orders — Clean state without demo orders
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

  // Order Deletion Modal
  const [orderToDelete, setOrderToDelete] = useState<OrderData | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [isClearingOrders, setIsClearingOrders] = useState(false);

  // Active highlighted order for tracking
  const [activeTrackOrderNum, setActiveTrackOrderNum] = useState<string | null>(null);

  // Form inputs
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

  // Promocodes, Cutlery, Tips
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

  // Fetch updated orders from server periodically with status change sound detection
  const prevStatusesRef = useRef<{ [orderNum: string]: OrderStatus }>({});

  useEffect(() => {
    let isMounted = true;
    const fetchOrders = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/orders?_t=${Date.now()}`, {
          cache: 'no-store'
        });
        if (res.ok && isMounted) {
          const serverOrders = await res.json();
          if (Array.isArray(serverOrders)) {
            // Check for status changes to trigger sound & haptic
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
              triggerHaptic('success');
            }

            setOrders(serverOrders);
            localStorage.setItem('tg_store_orders', JSON.stringify(serverOrders));
          }
        }
      } catch {
        // silent fail on network
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
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
                const sp = serverProducts.find((s: { id: string; price?: number; isAvailable?: boolean; is_available?: number; oldPrice?: number }) => s.id === p.id);
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
    const interval = setInterval(fetchLiveProducts, 10000);
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
    playSound('add');
    setWishlist(prev => 
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  // Cart operations
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

  // Auto-cancel WELCOME promo code if subtotal drops below 800
  useEffect(() => {
    if (appliedPromo?.code === 'WELCOME' && subtotalPrice < 800) {
      setAppliedPromo(null);
      setPromoError('Промокод WELCOME отменен: сумма заказа меньше 800 ₽');
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
      playSound('success');
    } else if (code === 'WELCOME') {
      if (subtotalPrice < 800) {
        setPromoError('Промокод WELCOME действует от 800 ₽');
        playSound('error');
        return;
      }
      setAppliedPromo({ code, amount: 300 });
      setPromoError('');
      playSound('success');
    } else {
      setPromoError('Неверный промокод. Попробуйте VIBE20');
      triggerHaptic('error');
      playSound('error');
    }
  };

  // Re-order in 1 click (with stop-list protection)
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
      alert(`Некоторые блюда (${skippedItems.join(', ')}) сейчас в стоп-листе и были пропущены.`);
      playSound('error');
    } else {
      playSound('add');
    }
    setIsCartOpen(true);
  };

  // Delete Single Order
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
    } catch {
      // server sync
    }

    setOrderToDelete(null);
  };

  // Clear ALL Orders (Admin @qqeaux only)
  const handleClearAllOrders = async () => {
    triggerHaptic('heavy');
    setIsClearingOrders(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/clear-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUsername: 'qqeaux' })
      });
      if (res.ok) {
        setOrders([]);
        localStorage.removeItem('tg_store_orders');
        playSound('success');
      } else {
        alert('Ошибка при очистке заказов');
        playSound('error');
      }
    } catch {
      alert('Ошибка подключения к серверу');
      playSound('error');
    } finally {
      setIsClearingOrders(false);
      setShowClearConfirmModal(false);
    }
  };

  // Update Status from Admin panel
  const handleAdminStatusChange = async (orderNum: string, newStatus: OrderStatus) => {
    triggerHaptic('medium');
    playSound('status');
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
      playSound('error');
      return;
    }

    const unavailableItem = cartItems.find(item => item.product.isAvailable === false);
    if (unavailableItem) {
      alert(`Блюдо "${unavailableItem.product.name}" временно в стоп-листе и недоступно для заказа. Пожалуйста, удалите его из корзины.`);
      triggerHaptic('error');
      playSound('error');
      return;
    }

    setFormErrors({});
    triggerHaptic('success');
    playSound('success');

    // Save recent address
    if (!savedAddresses.includes(address.trim())) {
      const updated = [address.trim(), ...savedAddresses.slice(0, 2)];
      setSavedAddresses(updated);
      localStorage.setItem('tg_store_addresses', JSON.stringify(updated));
    }

    // 6-digit collision-resistant order number
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

    // 1. Dual Delivery: Backend API
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

    // 2. Dual Delivery: Telegram Bot WebApp SDK
    if (window.Telegram?.WebApp?.sendData) {
      try {
        window.Telegram.WebApp.sendData(JSON.stringify(newOrder));
      } catch (err) {
        console.warn('sendData error:', err);
      }
    }

    setOrders(prev => [newOrder, ...prev]);
    setIsCartOpen(false);
    setCart({});
    setOrderSuccess(newOrder);
    setActiveTrackOrderNum(orderNum);
  };

  // Toggle availability in admin
  const toggleProductAvailability = async (productId: string) => {
    triggerHaptic('medium');
    playSound('add');
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
    playSound('success');

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
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-150 select-none pb-24 ${
      isDarkTheme ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>

      {/* REFINED HEADER */}
      <header className={`sticky top-0 z-30 px-4 py-2.5 backdrop-blur-lg border-b transition-colors ${
        isDarkTheme ? 'bg-slate-950/90 border-slate-800/80' : 'bg-white/90 border-slate-200/80 shadow-xs'
      }`}>
        <div className="flex items-center justify-between gap-3">
          
          {/* Clean Brand Title */}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Vibe Kitchen
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Гастрономическое бистро
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2">
            
            {/* Moscow Time & Theme Pill */}
            <button
              onClick={() => {
                triggerHaptic('light');
                setIsDarkTheme(!isDarkTheme);
              }}
              title="Переключить тему"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                isDarkTheme 
                  ? 'bg-slate-900 border-slate-700/70 text-slate-300 hover:bg-slate-800' 
                  : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isDarkTheme ? <Moon className="w-3.5 h-3.5 text-amber-400" /> : <Sun className="w-3.5 h-3.5 text-amber-600" />}
              <span>{moscowTimeStr}</span>
            </button>

            {/* Cart Button */}
            <button
              onClick={() => {
                triggerHaptic('medium');
                setIsCartOpen(true);
              }}
              className="relative p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white dark:border-slate-950">
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
            className={`mt-2 p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer ${
              isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-medium">Заказ готовится</span>
            </div>
            <div className="flex items-center gap-1 font-semibold text-blue-500">
              <span>Статус</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTENT AREA BY TAB */}
      <main className="flex-1 max-w-xl mx-auto w-full px-3.5 pt-3">

        {/* ================= TAB 1: MENU ================= */}
        {activeTab === 'menu' && (
          <div className="space-y-3.5">
            
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск блюд..."
                className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs border transition-colors focus:outline-none focus:border-blue-500 ${
                  isDarkTheme 
                    ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-500' 
                    : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : isDarkTheme ? 'bg-slate-900 text-slate-400 border border-slate-800' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Все
              </button>

              <button
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedCategory('favorites');
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === 'favorites'
                    ? 'bg-rose-600 text-white'
                    : isDarkTheme ? 'bg-slate-900 text-slate-400 border border-slate-800' : 'bg-white text-slate-600 border border-slate-200'
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : isDarkTheme ? 'bg-slate-900 text-slate-400 border border-slate-800' : 'bg-white text-slate-600 border border-slate-200'
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
                      isDarkTheme 
                        ? 'bg-slate-900 border-slate-800/80 hover:border-slate-700' 
                        : 'bg-white border-slate-200/90 shadow-xs'
                    } ${!isAvail ? 'opacity-55 grayscale-[35%]' : ''}`}
                  >
                    {/* Image Container with Badges */}
                    <div className="relative aspect-4/3 overflow-hidden bg-slate-800">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {product.badge && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-900/85 text-white backdrop-blur-xs">
                            {product.badge}
                          </span>
                        )}
                        {product.spicy && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-red-600/90 text-white backdrop-blur-xs flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" /> Острое
                          </span>
                        )}
                      </div>

                      {/* Favorite Button */}
                      <button
                        onClick={(e) => toggleWishlist(product.id, e)}
                        className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-xs transition-transform active:scale-90 ${
                          isFav ? 'bg-rose-500 text-white' : 'bg-black/40 text-white hover:bg-black/60'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                      </button>

                      {/* Weight pill */}
                      {product.weight && (
                        <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-medium text-white/90">
                          {product.weight}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs font-bold tracking-tight line-clamp-1 mb-0.5">
                          {product.name}
                        </h3>
                        <p className={`text-[11px] line-clamp-2 leading-relaxed mb-2.5 ${
                          isDarkTheme ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {product.description}
                        </p>
                      </div>

                      {/* Price & Add to Cart button */}
                      <div className={`flex items-center justify-between pt-1 border-t ${isDarkTheme ? 'border-slate-800/60' : 'border-slate-100'}`}>
                        <div>
                          <div className={`text-sm font-bold ${isDarkTheme ? 'text-amber-400' : 'text-slate-900'}`}>
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
                              className="flex items-center gap-1.5 bg-blue-600 rounded-lg p-0.5 text-white"
                            >
                              <button 
                                onClick={e => removeFromCart(product.id, e)}
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-blue-700 active:scale-95 cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-bold px-1 min-w-[14px] text-center">{qty}</span>
                              <button 
                                onClick={e => addToCart(product.id, e)}
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-blue-700 active:scale-95 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={e => addToCart(product.id, e)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>В корзину</span>
                            </button>
                          )
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-400 uppercase px-2 py-0.5 rounded bg-slate-800/40">
                            Стоп
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12 space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <Search className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold">Ничего не найдено</div>
                <p className="text-[11px] text-slate-400">Попробуйте изменить запрос</p>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: MY ORDERS ================= */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-sm font-bold tracking-tight">Мои заказы</h2>
                <p className="text-[11px] text-slate-400">История и статус доставки</p>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-slate-800/50 text-slate-300">
                {orders.length} заказов
              </span>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-16 space-y-2.5">
                <div className="w-12 h-12 rounded-full bg-slate-800/60 text-slate-400 flex items-center justify-center mx-auto">
                  <Package className="w-6 h-6" />
                </div>
                <h3 className="text-xs font-semibold">У вас пока нет заказов</h3>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Выберите блюда в меню и оформите заказ в несколько кликов
                </p>
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveTab('menu');
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium cursor-pointer"
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
                    className={`rounded-2xl border p-3 space-y-3 transition-colors ${
                      isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    {/* Header */}
                    <div className={`flex items-center justify-between pb-2 border-b ${isDarkTheme ? 'border-slate-800/60' : 'border-slate-100'}`}>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">Заказ #{order.orderNumber}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            order.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                            order.status === 'delivering' ? 'bg-blue-500/15 text-blue-400' :
                            order.status === 'cooking' ? 'bg-amber-500/15 text-amber-400' :
                            order.status === 'cancelled' ? 'bg-red-500/15 text-red-400' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {order.status === 'completed' ? 'Доставлен' :
                             order.status === 'delivering' ? 'Курьер в пути' :
                             order.status === 'cooking' ? 'На кухне' :
                             order.status === 'cancelled' ? 'Отменен' : 'Принят'}
                          </span>
                        </div>
                        <div className={`text-[10px] mt-0.5 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>{order.createdAt}</div>
                      </div>

                      <div className="text-right">
                        <div className={`text-sm font-bold ${isDarkTheme ? 'text-amber-400' : 'text-slate-900'}`}>
                          {order.totalPrice} ₽
                        </div>
                        <div className={`text-[10px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                          При получении
                        </div>
                      </div>
                    </div>

                    {/* Progress Stepper */}
                    {!isCancelled && (
                      <div className={`p-2.5 rounded-xl border ${
                        isDarkTheme ? 'bg-slate-950/60 border-slate-800/60' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="relative flex items-center justify-between px-2 pt-1 pb-1">
                          <div className={`absolute left-5 right-5 top-3.5 h-0.5 -translate-y-1/2 z-0 ${
                            isDarkTheme ? 'bg-slate-800' : 'bg-slate-200'
                          }`} />
                          
                          <div 
                            className="absolute left-5 top-3.5 h-0.5 -translate-y-1/2 bg-blue-500 transition-all duration-300 z-0" 
                            style={{ width: `${((stageIndex - 1) / 3) * 100}%` }}
                          />

                          {/* Node 1 */}
                          <div className="relative z-10 flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              stageIndex >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              <Check className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">Принят</span>
                          </div>

                          {/* Node 2 */}
                          <div className="relative z-10 flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              stageIndex >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              <ChefHat className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">Кухня</span>
                          </div>

                          {/* Node 3 */}
                          <div className="relative z-10 flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              stageIndex >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              <Bike className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">В пути</span>
                          </div>

                          {/* Node 4 */}
                          <div className="relative z-10 flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              stageIndex >= 4 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">Доставлен</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Order Items */}
                    <div className="space-y-1 text-xs">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px]">
                          <span className={`truncate max-w-[220px] ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>
                            {item.quantity} × {item.name}
                          </span>
                          <span className="font-medium text-slate-400">{item.price * item.quantity} ₽</span>
                        </div>
                      ))}
                    </div>

                    {/* Delivery Address */}
                    {order.address && (
                      <div className={`text-[11px] flex items-center gap-1.5 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{order.address}</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className={`flex items-center gap-2 pt-2 border-t ${isDarkTheme ? 'border-slate-800/60' : 'border-slate-100'}`}>
                      <button
                        onClick={() => handleRepeatOrder(order)}
                        className="flex-1 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Повторить заказ</span>
                      </button>

                      <button
                        onClick={() => setOrderToDelete(order)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          isDarkTheme ? 'border-slate-800 text-slate-400 hover:text-red-400' : 'border-slate-200 text-slate-400 hover:text-red-500'
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

        {/* ================= TAB 3: SUPPORT & INFO ================= */}
        {activeTab === 'support' && (
          <div className="space-y-3.5">
            <div>
              <h2 className="text-sm font-bold tracking-tight">Служба заботы & Контакты</h2>
              <p className={`text-[11px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Помощь с заказами и связь с разработчиком</p>
            </div>

            {/* Dev Offer */}
            <div className={`p-3.5 rounded-2xl border ${
              isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className="flex items-center gap-1.5 text-blue-500 font-semibold text-xs mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Разработка Telegram Mini App</span>
              </div>
              <h3 className={`text-xs font-bold mb-1 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                Нужен магазин или бот для вашего бизнеса?
              </h3>
              <p className={`text-[11px] leading-relaxed mb-3 ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                Создаем удобные интернет-магазины в Telegram с каталогом, онлайн-трекингом и закрытой панелью управления.
              </p>

              <a
                href="https://t.me/qqeaux"
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Написать разработчику (@qqeaux)</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </div>

            {/* FAQ Accordion */}
            <div className={`rounded-2xl border p-3.5 space-y-2.5 ${
              isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
            }`}>
              <div className={`flex items-center gap-1.5 text-xs font-bold ${
                isDarkTheme ? 'text-slate-300' : 'text-slate-700'
              }`}>
                <HelpCircle className="w-4 h-4 text-blue-500" />
                <span>Частые вопросы</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className={`p-2.5 rounded-xl border ${
                  isDarkTheme ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="font-semibold mb-0.5">Как отслеживать статус?</div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    Во вкладке «Заказы» отображаются все активные стадии приготовления и перемещения курьера в реальном времени.
                  </div>
                </div>

                <div className={`p-2.5 rounded-xl border ${
                  isDarkTheme ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="font-semibold mb-0.5">Как оплатить заказ?</div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    Оплата происходит при получении курьеру наличными или картой.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: ADMIN PANEL (@qqeaux only) ================= */}
        {activeTab === 'admin' && isActualAdmin && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold tracking-tight">Панель управления</h2>
                <div className="text-[11px] text-amber-500 font-medium">Администратор: @qqeaux</div>
              </div>

              {/* Clear ALL Orders Button */}
              <button
                onClick={() => setShowClearConfirmModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-xs font-medium cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Очистить историю</span>
              </button>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className={`p-2.5 rounded-xl border ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="text-[10px] text-slate-400 font-medium">Выручка</div>
                <div className="text-sm font-bold text-amber-500 mt-0.5">
                  {orders.reduce((acc, o) => acc + (o.paymentStatus === 'paid' ? o.totalPrice : 0), 0)} ₽
                </div>
              </div>

              <div className={`p-2.5 rounded-xl border ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="text-[10px] text-slate-400 font-medium">Заказов в базе</div>
                <div className="text-sm font-bold text-blue-500 mt-0.5">
                  {orders.length}
                </div>
              </div>
            </div>

            {/* Manage Orders */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400">
                Заказы ({orders.length})
              </h3>

              {orders.map(order => (
                <div 
                  key={order.orderNumber || order.id}
                  className={`p-3 rounded-xl border space-y-2 text-xs ${
                    isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs text-slate-900'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>#{order.orderNumber}</span>
                        <span className="font-normal text-slate-400">{order.customerName}</span>
                      </div>
                      <div className="text-blue-500 text-[11px]">{order.phone}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{order.address}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-amber-500">{order.totalPrice} ₽</div>
                      <span className="text-[10px] text-slate-400 uppercase">{order.status}</span>
                    </div>
                  </div>

                  {/* Status Change Buttons */}
                  <div className={`flex flex-wrap gap-1 pt-1.5 border-t ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                    <button
                      onClick={() => handleAdminStatusChange(order.orderNumber || '', 'cooking')}
                      className={`px-2 py-1 rounded text-[10px] font-medium border cursor-pointer ${
                        order.status === 'cooking' 
                          ? 'bg-amber-500 text-slate-950 border-amber-500' 
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      👨‍🍳 Кухня
                    </button>
                    <button
                      onClick={() => handleAdminStatusChange(order.orderNumber || '', 'delivering')}
                      className={`px-2 py-1 rounded text-[10px] font-medium border cursor-pointer ${
                        order.status === 'delivering' 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      🚴 Доставка
                    </button>
                    <button
                      onClick={() => handleAdminStatusChange(order.orderNumber || '', 'completed')}
                      className={`px-2 py-1 rounded text-[10px] font-medium border cursor-pointer ${
                        order.status === 'completed' 
                          ? 'bg-emerald-600 text-white border-emerald-600' 
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      ✅ Выполнен
                    </button>
                    <button
                      onClick={() => setOrderToDelete(order)}
                      className="px-2 py-1 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 cursor-pointer ml-auto"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Products Price & Availability Controls */}
            <div className="space-y-2 pt-1">
              <h3 className="text-xs font-semibold text-slate-400">
                Каталог блюд и цены
              </h3>
              <div className="space-y-1.5">
                {products.map(p => (
                  <div 
                    key={p.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate max-w-[180px]">
                      <img src={p.image} alt={p.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                      <div className="truncate">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.weight}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {editingPriceId === p.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editPriceVal}
                            onChange={e => setEditPriceVal(e.target.value)}
                            className="w-16 px-1.5 py-0.5 rounded text-xs bg-slate-950 border border-slate-700 text-white"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSavePrice(p.id)}
                            className="p-1 rounded bg-emerald-600 text-white"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingPriceId(p.id);
                            setEditPriceVal(String(p.price));
                          }}
                          className="font-bold text-amber-500 flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <span>{p.price} ₽</span>
                          <Edit2 className="w-3 h-3 opacity-60" />
                        </button>
                      )}

                      <button
                        onClick={() => toggleProductAvailability(p.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                          p.isAvailable !== false ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {p.isAvailable !== false ? 'В наличии' : 'Стоп'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= FIXED BOTTOM NAVIGATION ================= */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-lg transition-colors ${
        isDarkTheme ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-sm'
      }`}>
        <div className="max-w-md mx-auto grid grid-cols-4 px-2 py-1.5">
          
          {/* Tab 1: Menu */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('menu');
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'menu'
                ? 'text-blue-500 font-bold'
                : 'text-slate-400 hover:text-slate-300 font-medium'
            }`}
          >
            <Utensils className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Меню</span>
          </button>

          {/* Tab 2: Orders */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('orders');
            }}
            className={`relative flex flex-col items-center justify-center py-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'orders'
                ? 'text-blue-500 font-bold'
                : 'text-slate-400 hover:text-slate-300 font-medium'
            }`}
          >
            <Package className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Заказы</span>
            {activeOrdersCount > 0 && (
              <span className="absolute top-1 right-5 w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>

          {/* Tab 3: Support */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('support');
            }}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'support'
                ? 'text-blue-500 font-bold'
                : 'text-slate-400 hover:text-slate-300 font-medium'
            }`}
          >
            <HelpCircle className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Инфо</span>
          </button>

          {/* Tab 4: Admin (only if @qqeaux) or Cart button */}
          {isActualAdmin ? (
            <button
              onClick={() => {
                triggerHaptic('medium');
                setActiveTab('admin');
              }}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'admin'
                  ? 'text-amber-500 font-bold'
                  : 'text-slate-400 hover:text-slate-300 font-medium'
              }`}
            >
              <span className="text-sm mb-0.5 leading-none">👑</span>
              <span className="text-[10px]">Админ</span>
            </button>
          ) : (
            <button
              onClick={() => {
                triggerHaptic('light');
                setIsCartOpen(true);
              }}
              className="flex flex-col items-center justify-center py-1 rounded-xl text-slate-400 hover:text-slate-300 font-medium cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 mb-0.5" />
              <span className="text-[10px]">Корзина</span>
            </button>
          )}
        </div>
      </nav>

      {/* ================= PRODUCT DETAIL MODAL (KBJU & INGREDIENTS) ================= */}
      {selectedProduct && (() => {
        const currentProduct = products.find(p => p.id === selectedProduct.id) || selectedProduct;
        const isAvail = currentProduct.isAvailable !== false;

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className={`w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[88vh] flex flex-col overflow-hidden border shadow-xl ${
              isDarkTheme ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              
              {/* Modal Image */}
              <div className="relative aspect-16/9 w-full bg-slate-950 overflow-hidden shrink-0">
                <img 
                  src={currentProduct.image} 
                  alt={currentProduct.name} 
                  className={`w-full h-full object-cover ${!isAvail ? 'opacity-60 grayscale-[35%]' : ''}`}
                />
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-transform active:scale-95 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Badges */}
                <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                  {!isAvail ? (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                      Стоп-лист
                    </span>
                  ) : currentProduct.badge ? (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-900/90 text-white">
                      {currentProduct.badge}
                    </span>
                  ) : null}
                  {currentProduct.weight && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-black/60 text-white">
                      {currentProduct.weight}
                    </span>
                  )}
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="p-3.5 overflow-y-auto space-y-3.5">
                <div>
                  <h2 className="text-base font-bold tracking-tight">{currentProduct.name}</h2>
                  <p className={`text-xs mt-1 leading-relaxed ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                    {currentProduct.description}
                  </p>
                </div>

                {/* KBJU Grid */}
                <div className={`p-3 rounded-xl border ${
                  isDarkTheme ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex justify-between">
                    <span>Энергетическая ценность</span>
                    <span>на 100 г</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-1.5 rounded-lg bg-slate-800/40">
                      <div className="font-bold text-amber-500">{currentProduct.calories || 240}</div>
                      <div className="text-[10px] text-slate-400">ккал</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-800/40">
                      <div className="font-bold text-blue-400">{currentProduct.proteins || 14} г</div>
                      <div className="text-[10px] text-slate-400">белки</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-800/40">
                      <div className="font-bold text-rose-400">{currentProduct.fats || 16} г</div>
                      <div className="text-[10px] text-slate-400">жиры</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-800/40">
                      <div className="font-bold text-emerald-400">{currentProduct.carbs || 22} г</div>
                      <div className="text-[10px] text-slate-400">углеводы</div>
                    </div>
                  </div>
                </div>

                {/* Ingredients */}
                {currentProduct.ingredients && currentProduct.ingredients.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-400">Состав</div>
                    <ul className={`text-xs space-y-0.5 p-2.5 rounded-xl border ${
                      isDarkTheme ? 'text-slate-300 bg-slate-950/40 border-slate-800/60' : 'text-slate-700 bg-slate-50 border-slate-200'
                    }`}>
                      {currentProduct.ingredients.map((ing, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-[11px]">
                          <span className="w-1 h-1 rounded-full bg-blue-500" />
                          <span>{ing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Allergens */}
                {currentProduct.allergens && currentProduct.allergens.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-slate-400">Аллергены:</span>
                    {currentProduct.allergens.map((alg, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">
                        {alg}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className={`p-3 border-t flex items-center justify-between gap-3 ${
                isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div>
                  <div className="text-[10px] text-slate-400">Цена:</div>
                  <div className={`text-lg font-bold ${isDarkTheme ? 'text-amber-400' : 'text-slate-900'}`}>
                    {currentProduct.price} ₽
                  </div>
                </div>

                <div>
                  {!isAvail ? (
                    <span className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 text-xs font-medium">
                      Недоступно
                    </span>
                  ) : (cart[currentProduct.id] || 0) > 0 ? (
                    <div className="flex items-center gap-1.5 bg-blue-600 rounded-xl p-1 text-white">
                      <button 
                        onClick={() => removeFromCart(currentProduct.id)}
                        className="w-7 h-7 rounded-lg bg-blue-700 flex items-center justify-center hover:bg-blue-800 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold px-2 text-center">
                        {cart[currentProduct.id]}
                      </span>
                      <button 
                        onClick={() => addToCart(currentProduct.id)}
                        className="w-7 h-7 rounded-lg bg-blue-700 flex items-center justify-center hover:bg-blue-800 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(currentProduct.id)}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
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

      {/* ================= CART & CHECKOUT DRAWER ================= */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className={`w-full max-w-md h-full flex flex-col justify-between border-l ${
            isDarkTheme ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            
            {/* Header */}
            <div className={`p-3.5 border-b flex items-center justify-between ${isDarkTheme ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2 font-bold text-xs">
                <ShoppingBag className="w-4 h-4 text-blue-500" />
                <span>Корзина ({totalItemsCount})</span>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form & Items */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
              
              {cartItems.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto text-slate-400">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-semibold">Корзина пуста</div>
                  <p className="text-[11px] text-slate-400">Выберите блюда в меню</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase">Блюда в заказе:</div>
                  {cartItems.map(item => (
                    <div 
                      key={item.product.id}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs ${
                        isDarkTheme ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate max-w-[190px]">
                        <img src={item.product.image} alt={item.product.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                        <div className="truncate">
                          <div className="font-semibold truncate">{item.product.name}</div>
                          <div className="flex items-center gap-1">
                            <span className="text-amber-500 font-bold">{item.product.price} ₽</span>
                            {item.product.isAvailable === false && (
                              <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1 py-0.5 rounded">
                                Стоп
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-blue-600 rounded-lg p-0.5 text-white">
                        <button 
                          onClick={() => removeFromCart(item.product.id)}
                          className="w-5 h-5 rounded flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold px-1 text-center">{item.quantity}</span>
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
                  <div className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
                    <Tag className="w-3 h-3 text-blue-500" />
                    <span>Промокод</span>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={promoCodeInput}
                      onChange={e => setPromoCodeInput(e.target.value)}
                      placeholder="Код (например VIBE20)"
                      className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs uppercase border focus:outline-none focus:border-blue-500 ${
                        isDarkTheme ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs cursor-pointer"
                    >
                      Применить
                    </button>
                  </div>
                  {appliedPromo && (
                    <div className="text-[11px] text-emerald-400 font-medium">
                      Промокод {appliedPromo.code} применен!
                    </div>
                  )}
                  {promoError && (
                    <div className="text-[11px] text-red-400 font-medium">
                      {promoError}
                    </div>
                  )}
                </div>
              )}

              {/* Cutlery & Tips */}
              {cartItems.length > 0 && (
                <div className="space-y-3 pt-1">
                  {/* Cutlery */}
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                    isDarkTheme ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="text-xs font-medium">Приборы:</div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCutleryCount(prev => Math.max(0, prev - 1))}
                        className="w-6 h-6 rounded bg-slate-800 text-white flex items-center justify-center cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold px-1.5">{cutleryCount}</span>
                      <button
                        type="button"
                        onClick={() => setCutleryCount(prev => Math.min(6, prev + 1))}
                        className="w-6 h-6 rounded bg-slate-800 text-white flex items-center justify-center cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">Чаевые курьеру:</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0, 50, 100, 150].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setTipsAmount(amt);
                            playSound('add');
                          }}
                          className={`py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                            tipsAmount === amt
                              ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                              : 'bg-slate-800/40 border-slate-700/50 text-slate-300'
                          }`}
                        >
                          {amt === 0 ? '0 ₽' : `+${amt} ₽`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Order Form */}
              {cartItems.length > 0 && (
                <form id="order-form" onSubmit={handleSubmitOrder} className="space-y-2.5 pt-2">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase">Данные доставки:</div>
                  
                  <div>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Имя и Фамилия"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:border-blue-500 ${
                        isDarkTheme ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                    {formErrors.customerName && <div className="text-[10px] text-red-400 mt-0.5">{formErrors.customerName}</div>}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(formatRussianPhone(e.target.value))}
                      placeholder="+7 (9XX) XXX-XX-XX"
                      className={`w-full px-3 py-2 rounded-xl text-xs font-mono border focus:outline-none focus:border-blue-500 ${
                        isDarkTheme ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                    {formErrors.phone && <div className="text-[10px] text-red-400 mt-0.5">{formErrors.phone}</div>}
                  </div>

                  <div>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Email для чека"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:border-blue-500 ${
                        isDarkTheme ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                    {formErrors.email && <div className="text-[10px] text-red-400 mt-0.5">{formErrors.email}</div>}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Адрес (город, улица, дом, кв)"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:border-blue-500 ${
                        isDarkTheme ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                    {formErrors.address && <div className="text-[10px] text-red-400 mt-0.5">{formErrors.address}</div>}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Комментарий для курьера (код домофона, этаж)"
                      className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:border-blue-500 ${
                        isDarkTheme ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>

                  {/* Payment Method Notice */}
                  <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                    isDarkTheme ? 'bg-slate-950/40 border-slate-800/60 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <Banknote className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Оплата при получении (наличными или картой)</span>
                  </div>
                </form>
              )}
            </div>

            {/* Bottom Checkout Actions */}
            {cartItems.length > 0 && (
              <div className={`p-3.5 border-t space-y-2.5 ${isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Сумма блюд:</span>
                    <span>{subtotalPrice} ₽</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Скидка:</span>
                      <span>-{discountAmount} ₽</span>
                    </div>
                  )}
                  {tipsAmount > 0 && (
                    <div className="flex justify-between text-amber-500">
                      <span>Чаевые:</span>
                      <span>+{tipsAmount} ₽</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm font-bold pt-1 border-t border-slate-800">
                    <span>Итого:</span>
                    <span className="text-amber-500 text-base">{totalPrice} ₽</span>
                  </div>
                </div>

                {cartItems.some(i => i.product.isAvailable === false) && (
                  <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs text-center">
                    В заказе есть блюда из стоп-листа.
                  </div>
                )}

                <button
                  type="submit"
                  form="order-form"
                  disabled={cartItems.some(i => i.product.isAvailable === false)}
                  className={`w-full py-3 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                    cartItems.some(i => i.product.isAvailable === false)
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                  }`}
                >
                  <span>Оформить заказ ({totalPrice} ₽)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= ORDER DELETE MODAL ================= */}
      {orderToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-xs rounded-2xl p-4 border text-center space-y-3 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="text-xs font-bold">Удалить заказ #{orderToDelete.orderNumber}?</h3>
            <p className="text-[11px] text-slate-400">Заказ будет удален из истории.</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-1.5 rounded-lg border border-slate-700 text-xs font-medium cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={confirmDeleteOrder}
                className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium cursor-pointer"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CLEAR ALL ORDERS MODAL (Admin only) ================= */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-xs rounded-2xl p-4 border text-center space-y-3 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold">Очистить ВСЮ историю заказов?</h3>
            <p className="text-[11px] text-slate-400">
              Это действие удалит абсолютно все заказы из базы данных навсегда.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                disabled={isClearingOrders}
                onClick={() => setShowClearConfirmModal(false)}
                className="flex-1 py-1.5 rounded-lg border border-slate-700 text-xs font-medium cursor-pointer"
              >
                Отмена
              </button>
              <button
                disabled={isClearingOrders}
                onClick={handleClearAllOrders}
                className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium cursor-pointer"
              >
                {isClearingOrders ? 'Очистка...' : 'Да, очистить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ORDER SUCCESS MODAL ================= */}
      {orderSuccess && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className={`w-full max-w-xs rounded-2xl p-4 border text-center space-y-3 ${
            isDarkTheme ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Заказ #{orderSuccess.orderNumber} принят!</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Вы можете следить за стадией во вкладке «Заказы»
              </p>
            </div>

            <div className={`p-2.5 rounded-xl border text-left text-[11px] space-y-1 ${
              isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex justify-between">
                <span className="text-slate-400">Сумма:</span>
                <span className="font-bold text-amber-500">{orderSuccess.totalPrice} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Оплата:</span>
                <span>При получении</span>
              </div>
            </div>

            <button
              onClick={() => {
                triggerHaptic('light');
                setOrderSuccess(null);
                setActiveTab('orders');
              }}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs cursor-pointer"
            >
              Перейти к заказам
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
