import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Sparkles,
  Archive,
  ArchiveRestore,
  Shield,
  Sliders,
  LogOut,
  RefreshCw,
  TrendingUp,
  ExternalLink
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

function parseOrderDateMs(s?: string): number | null {
  if (!s) return null;
  if (/^\d{10,}$/.test(s)) return Number(s) * (s.length === 10 ? 1000 : 1);
  const clean = s.replace(' ', 'T');
  const t = new Date(clean).getTime();
  return isNaN(t) ? null : t;
}

function formatMinutesRu(mins: number): string {
  const abs = Math.abs(mins);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${mins} минут`;
  if (mod10 === 1) return `${mins} минуту`;
  if (mod10 >= 2 && mod10 <= 4) return `${mins} минуты`;
  return `${mins} минут`;
}

function getDeliveredDurationText(order: OrderData): string {
  const createdMs = parseOrderDateMs(order.createdAt || (order as any).created_at);
  const completedMs = parseOrderDateMs(order.completedAt || (order as any).completed_at);
  
  if (createdMs && completedMs && completedMs >= createdMs) {
    const diffMins = Math.max(1, Math.round((completedMs - createdMs) / 60000));
    return formatMinutesRu(diffMins);
  }
  
  if (createdMs) {
    const diffMins = Math.max(1, Math.round((Date.now() - createdMs) / 60000));
    if (diffMins < 180) {
      return formatMinutesRu(diffMins);
    }
  }

  const mins = order.etaMinutes || 25;
  return formatMinutesRu(mins);
}

function getOrderCountdown(order: OrderData, currentEpochMs: number) {
  let targetMs: number | null = null;
  if (order.etaTimestamp) {
    targetMs = order.etaTimestamp * 1000;
  } else if (order.statusUpdatedAt && order.etaMinutes) {
    const updateMs = parseOrderDateMs(order.statusUpdatedAt);
    if (updateMs) targetMs = updateMs + order.etaMinutes * 60 * 1000;
  } else if (order.estimatedTime) {
    const match = order.estimatedTime.match(/\d+/);
    if (match) {
      const mins = parseInt(match[0], 10);
      const baseMs = parseOrderDateMs(order.statusUpdatedAt || order.createdAt) || currentEpochMs;
      targetMs = baseMs + mins * 60 * 1000;
    }
  }

  if (!targetMs) return null;

  const diffSec = Math.floor((targetMs - currentEpochMs) / 1000);
  if (diffSec <= 0) {
    return { isArriving: true, text: 'Курьер уже у вас', minutes: 0, seconds: 0, timeStr: '00:00' };
  }
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
  return { isArriving: false, seconds: diffSec, minutes: m, timeStr };
}

interface TelegramUser {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

function getTelegramUser(): TelegramUser | null {
  try {
    // 1. Direct WebApp initDataUnsafe
    const unsafe = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    if (unsafe && (unsafe.id || unsafe.username)) {
      try {
        localStorage.setItem('tg_store_user_cache', JSON.stringify(unsafe));
      } catch {}
      return unsafe;
    }

    // 2. Parse from WebApp initData (querystring format)
    const initData = (window as any).Telegram?.WebApp?.initData;
    if (initData) {
      const q = new URLSearchParams(initData);
      const userStr = q.get('user');
      if (userStr) {
        const parsed = JSON.parse(decodeURIComponent(userStr));
        if (parsed && (parsed.id || parsed.username)) {
          try {
            localStorage.setItem('tg_store_user_cache', JSON.stringify(parsed));
          } catch {}
          return parsed;
        }
      }
    }

    // 3. Parse from URL hash (#tgWebAppData=...)
    const hash = window.location.hash || '';
    if (hash.includes('tgWebAppData=')) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      const rawInitData = hashParams.get('tgWebAppData');
      if (rawInitData) {
        const innerParams = new URLSearchParams(rawInitData);
        const userStr = innerParams.get('user');
        if (userStr) {
          const parsed = JSON.parse(decodeURIComponent(userStr));
          if (parsed && (parsed.id || parsed.username)) {
            try {
              localStorage.setItem('tg_store_user_cache', JSON.stringify(parsed));
            } catch {}
            return parsed;
          }
        }
      }
    }

    // 4. Cached user from previous session
    const cached = localStorage.getItem('tg_store_user_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && (parsed.id || parsed.username)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('getTelegramUser parsing error:', err);
  }
  return null;
}

export function App() {
  // Real-time 1-second clock for active countdowns
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Theme state: Soft, organic palette
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => !getMoscowTimeInfo().isDaytime);
  const [moscowTimeStr, setMoscowTimeStr] = useState<string>(() => getMoscowTimeInfo().timeStr);

  // Customer Navigation: 'menu' | 'orders' | 'support' | 'admin'
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'support' | 'admin'>('menu');

  // Admin Dashboard State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vk_admin_auth') === '1';
    } catch {
      return false;
    }
  });
  const [adminLoginInput, setAdminLoginInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [adminOrders, setAdminOrders] = useState<OrderData[]>([]);
  const [adminFilterTab, setAdminFilterTab] = useState<'all' | 'new' | 'cooking' | 'delivering' | 'completed' | 'menu'>('all');
  const [editingPriceProductId, setEditingPriceProductId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>('');
  const [adminOrderSearch, setAdminOrderSearch] = useState<string>('');

  // Products & Categories
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('tg_store_products');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return INITIAL_PRODUCTS.map(ip => {
            const sp = parsed.find((p: any) => p.id === ip.id);
            if (sp) {
              const finalPrice = typeof sp.price === 'number' ? sp.price : ip.price;
              const cleanOld = sp.oldPrice && Number(sp.oldPrice) > Number(finalPrice) ? Number(sp.oldPrice) : ip.oldPrice;
              return {
                ...ip,
                price: finalPrice,
                oldPrice: cleanOld,
                isAvailable: sp.isAvailable !== undefined ? Boolean(sp.isAvailable) : ip.isAvailable,
                calories: sp.calories ?? ip.calories,
                proteins: sp.proteins ?? ip.proteins,
                fats: sp.fats ?? ip.fats,
                carbs: sp.carbs ?? ip.carbs,
                ingredients: sp.ingredients?.length ? sp.ingredients : ip.ingredients,
                description: sp.description || ip.description,
                weight: sp.weight || ip.weight
              };
            }
            return ip;
          });
        }
      } catch { /* ignore */ }
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

  // User Identification (Telegram ID or Persistent Client UUID)
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    try {
      const tgUser = getTelegramUser();
      if (tgUser?.id) {
        const uid = String(tgUser.id);
        localStorage.setItem('tg_store_user_id', uid);
        return uid;
      }
      let localId = localStorage.getItem('tg_store_user_id');
      if (!localId) {
        localId = 'u_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
        localStorage.setItem('tg_store_user_id', localId);
      }
      return localId;
    } catch {
      return 'u_guest';
    }
  });

  // Orders, Archive & Delete state (strictly scoped to currentUserId)
  const [orderFilterTab, setOrderFilterTab] = useState<'active' | 'archived'>('active');
  const [archivedOrderNums, setArchivedOrderNums] = useState<string[]>(() => {
    try {
      const tgUser = getTelegramUser();
      const uid = tgUser?.id ? String(tgUser.id) : (localStorage.getItem('tg_store_user_id') || '');
      const saved = localStorage.getItem(`tg_store_archived_orders_${uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [deletedOrderNums, setDeletedOrderNums] = useState<string[]>(() => {
    try {
      const tgUser = getTelegramUser();
      const uid = tgUser?.id ? String(tgUser.id) : (localStorage.getItem('tg_store_user_id') || '');
      const saved = localStorage.getItem(`tg_store_deleted_orders_${uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [orders, setOrders] = useState<OrderData[]>(() => {
    try {
      // Purge any legacy un-isolated storage so phantom orders are permanently cleared
      localStorage.removeItem('tg_store_orders');
      localStorage.removeItem('tg_store_archived_orders');
      localStorage.removeItem('tg_store_deleted_orders');

      const tgUser = getTelegramUser();
      const uid = tgUser?.id ? String(tgUser.id) : (localStorage.getItem('tg_store_user_id') || '');
      if (uid) {
        const saved = localStorage.getItem(`tg_store_orders_${uid}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed.map((o: any) => ({
              ...o,
              orderNumber: o.orderNumber || o.order_number,
              totalPrice: Number(o.totalPrice ?? o.total_price ?? 0),
              customerName: o.customerName || o.user_name || '',
              createdAt: o.createdAt || o.created_at || '',
              estimatedTime: o.estimatedTime || o.estimated_time,
              statusNote: o.statusNote || o.status_note,
              statusUpdatedAt: o.statusUpdatedAt || o.status_updated_at,
              completedAt: o.completedAt || o.completed_at,
              etaTimestamp: o.etaTimestamp || o.eta_timestamp,
              etaMinutes: o.etaMinutes || o.eta_minutes
            }));
          }
        }
      }
      return [];
    } catch {
      return [];
    }
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

  // Deep Link ?tab=orders / ?admin=1 / ?auth=1
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('tab') === 'orders') {
        setActiveTab('orders');
      }
      if (urlParams.get('auth') === '1' || urlParams.get('token') === '1') {
        localStorage.setItem('vk_admin_auth', '1');
        setIsAdminLoggedIn(true);
        setActiveTab('admin');
      } else if (urlParams.get('admin') === '1' || urlParams.get('tab') === 'admin') {
        setActiveTab('admin');
      }
      if (urlParams.get('order')) {
        setAdminOrderSearch(urlParams.get('order') || '');
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
    }
    const tgUser = getTelegramUser();
    if (tgUser) {
      if (tgUser.id) {
        const uidStr = String(tgUser.id);
        setCurrentUserId(prev => {
          if (prev !== uidStr) {
            localStorage.setItem('tg_store_user_id', uidStr);
            return uidStr;
          }
          return prev;
        });
      }
      if (tgUser.first_name) {
        const fullName = tgUser.first_name + (tgUser.last_name ? ` ${tgUser.last_name}` : '');
        setCustomerName(prev => (!prev || prev.trim() === '' ? fullName : prev));
      }
    }
  }, []);

  // Order status poll with gentle chime notification
  const prevStatusesRef = useRef<{ [orderNum: string]: OrderStatus }>({});

  useEffect(() => {
    let isMounted = true;
    const fetchOrders = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/orders?userId=${encodeURIComponent(currentUserId)}&_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok && isMounted) {
          const serverOrders = await res.json();
          if (Array.isArray(serverOrders)) {
            const deletedSaved: string[] = (() => {
              try { return JSON.parse(localStorage.getItem(`tg_store_deleted_orders_${currentUserId}`) || '[]'); } catch { return []; }
            })();
            const deletedSet = new Set(deletedSaved);

            const normalizedOrders: OrderData[] = serverOrders
              .filter((o: any) => {
                const num = o.orderNumber || o.order_number;
                return num && !deletedSet.has(num);
              })
              .map((o: any) => ({
                ...o,
                id: o.id || o.orderNumber || o.order_number,
                orderNumber: o.orderNumber || o.order_number,
                totalPrice: Number(o.totalPrice ?? o.total_price ?? 0),
                customerName: o.customerName || o.user_name || '',
                createdAt: o.createdAt || o.created_at || '',
                estimatedTime: o.estimatedTime || o.estimated_time,
                statusNote: o.statusNote || o.status_note,
                statusUpdatedAt: o.statusUpdatedAt || o.status_updated_at,
                completedAt: o.completedAt || o.completed_at,
                etaTimestamp: o.etaTimestamp || o.eta_timestamp,
                etaMinutes: o.etaMinutes || o.eta_minutes,
                items: Array.isArray(o.items) ? o.items : []
              }));

            let statusChanged = false;
            normalizedOrders.forEach((o: OrderData) => {
              const num = o.orderNumber;
              if (num && o.status) {
                const oldSt = prevStatusesRef.current[num];
                if (oldSt && oldSt !== o.status) {
                  statusChanged = true;
                }
                prevStatusesRef.current[num] = o.status;
              }
            });

            if (statusChanged) {
              playSound('status');
              try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success'); } catch {}
            }

            setOrders(prev => {
              const serverNums = new Set(normalizedOrders.map(o => o.orderNumber));
              const pendingLocal = prev.filter(p => p.orderNumber && !serverNums.has(p.orderNumber) && !deletedSet.has(p.orderNumber));
              const merged = [...normalizedOrders, ...pendingLocal];
              localStorage.setItem(`tg_store_orders_${currentUserId}`, JSON.stringify(merged));
              return merged;
            });
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
  }, [currentUserId]);

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
                const sp = serverProducts.find((s: any) => s.id === p.id);
                const ip = INITIAL_PRODUCTS.find(i => i.id === p.id);
                if (sp) {
                  const finalPrice = typeof sp.price === 'number' ? sp.price : p.price;
                  const rawOld = sp.oldPrice ?? sp.old_price;
                  const cleanOld = rawOld && Number(rawOld) > Number(finalPrice) ? Number(rawOld) : undefined;
                  return {
                    ...ip,
                    ...p,
                    price: finalPrice,
                    isAvailable: sp.isAvailable !== undefined ? Boolean(sp.isAvailable) : (sp.is_available !== undefined ? Boolean(sp.is_available) : p.isAvailable),
                    oldPrice: cleanOld,
                    calories: sp.calories ?? p.calories ?? ip?.calories,
                    proteins: sp.proteins ?? p.proteins ?? ip?.proteins,
                    fats: sp.fats ?? p.fats ?? ip?.fats,
                    carbs: sp.carbs ?? p.carbs ?? ip?.carbs
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

  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
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

  const cartTotalKbju = useMemo(() => {
    let cals = 0, p = 0, f = 0, c = 0;
    cartItems.forEach(item => {
      const im = INITIAL_PRODUCTS.find(x => x.id === item.product.id);
      const cal = item.product.calories ?? im?.calories ?? 0;
      const prot = item.product.proteins ?? im?.proteins ?? 0;
      const fat = item.product.fats ?? im?.fats ?? 0;
      const carb = item.product.carbs ?? im?.carbs ?? 0;
      cals += cal * item.quantity;
      p += prot * item.quantity;
      f += fat * item.quantity;
      c += carb * item.quantity;
    });
    return { cals, p, f, c };
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

    const orderItems = Array.isArray(order.items) ? order.items : [];
    for (const item of orderItems) {
      const prod = products.find(p => p.id === item.id);
      if (prod && prod.isAvailable !== false) {
        newCart[item.id] = Number(item.quantity) || 1;
      } else {
        skippedItems.push(item.name);
      }
    }

    setCart(newCart);
    if (order.address) setAddress(order.address);
    const cName = order.customerName || (order as any).user_name;
    if (cName) setCustomerName(cName);
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

  const handleArchiveOrder = (orderNum: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic('light');
    playSound('add');
    setArchivedOrderNums(prev => {
      const next = prev.includes(orderNum) ? prev : [...prev, orderNum];
      localStorage.setItem(`tg_store_archived_orders_${currentUserId}`, JSON.stringify(next));
      return next;
    });
  };

  const handleUnarchiveOrder = (orderNum: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic('light');
    playSound('add');
    setArchivedOrderNums(prev => {
      const next = prev.filter(num => num !== orderNum);
      localStorage.setItem(`tg_store_archived_orders_${currentUserId}`, JSON.stringify(next));
      return next;
    });
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    triggerHaptic('medium');
    playSound('remove');
    const orderNum = orderToDelete.orderNumber || (orderToDelete as any).order_number;
    if (!orderNum) {
      setOrderToDelete(null);
      return;
    }

    setOrders(prev => {
      const next = prev.filter(o => (o.orderNumber || (o as any).order_number) !== orderNum);
      localStorage.setItem(`tg_store_orders_${currentUserId}`, JSON.stringify(next));
      return next;
    });

    setArchivedOrderNums(prev => {
      const next = prev.filter(num => num !== orderNum);
      localStorage.setItem(`tg_store_archived_orders_${currentUserId}`, JSON.stringify(next));
      return next;
    });

    setDeletedOrderNums(prev => {
      const next = prev.includes(orderNum) ? prev : [...prev, orderNum];
      localStorage.setItem(`tg_store_deleted_orders_${currentUserId}`, JSON.stringify(next));
      return next;
    });

    try {
      await fetch(`${API_BASE_URL}/api/orders/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderNum, order_number: orderNum })
      });
    } catch (e) {
      console.warn('API delete error:', e);
    }

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

    const tgUser = getTelegramUser();
    const effectiveUserId = tgUser?.id ? String(tgUser.id) : currentUserId;
    const effectiveUsername = (tgUser?.username || '').replace(/^@/, '').trim();
    const resolvedCustomerName = customerName.trim() || 
      (tgUser?.first_name ? `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}` : 'Клиент');

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
      customerName: resolvedCustomerName,
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
        keepalive: true,
        body: JSON.stringify({
          ...newOrder,
          customerName: resolvedCustomerName,
          userId: effectiveUserId,
          username: effectiveUsername
        })
      }).catch(err => console.warn('API sync warning:', err));
    } catch {}

    setOrders(prev => {
      const next = [newOrder, ...prev];
      localStorage.setItem(`tg_store_orders_${effectiveUserId}`, JSON.stringify(next));
      return next;
    });
    setIsCartOpen(false);
    setCart({});
    setOrderSuccess(newOrder);
  };

  const unarchivedOrders = useMemo(() => {
    const archivedSet = new Set(archivedOrderNums);
    return orders.filter(o => {
      const num = o.orderNumber || (o as any).order_number;
      return num && !archivedSet.has(num);
    });
  }, [orders, archivedOrderNums]);

  const archivedOrders = useMemo(() => {
    const archivedSet = new Set(archivedOrderNums);
    return orders.filter(o => {
      const num = o.orderNumber || (o as any).order_number;
      return num && archivedSet.has(num);
    });
  }, [orders, archivedOrderNums]);

  const inProgressOrders = useMemo(() => {
    return unarchivedOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
  }, [unarchivedOrders]);

  const activeOrders = inProgressOrders;

  const displayedOrders = useMemo(() => {
    return orderFilterTab === 'active' ? unarchivedOrders : archivedOrders;
  }, [orderFilterTab, unarchivedOrders, archivedOrders]);

  // --- ADMIN DASHBOARD LOGIC ---
  const fetchAdminOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders?admin=1&_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped: OrderData[] = data.map((o: any) => ({
            ...o,
            id: o.id || o.orderNumber || o.order_number,
            orderNumber: o.orderNumber || o.order_number,
            totalPrice: Number(o.totalPrice ?? o.total_price ?? 0),
            customerName: o.customerName || o.user_name || 'Клиент',
            username: o.username || (o as any).user_name || '',
            phone: o.phone || '',
            address: o.address || '',
            comment: o.comment || '',
            createdAt: o.createdAt || o.created_at || '',
            estimatedTime: o.estimatedTime || o.estimated_time,
            statusNote: o.statusNote || o.status_note,
            statusUpdatedAt: o.statusUpdatedAt || o.status_updated_at,
            completedAt: o.completedAt || o.completed_at,
            etaTimestamp: o.etaTimestamp || o.eta_timestamp,
            etaMinutes: o.etaMinutes || o.eta_minutes,
            items: Array.isArray(o.items) ? o.items : []
          }));
          setAdminOrders(mapped);
        }
      }
    } catch (e) {
      console.error('Failed to fetch admin orders:', e);
    }
  }, []);

  useEffect(() => {
    if (isAdminLoggedIn) {
      fetchAdminOrders();
      const interval = setInterval(fetchAdminOrders, 4000);
      return () => clearInterval(interval);
    }
  }, [isAdminLoggedIn, fetchAdminOrders]);

  const adminAnalytics = useMemo(() => {
    const totalOrders = adminOrders.length;
    const completedOrders = adminOrders.filter(o => o.status === 'completed');
    const revenue = completedOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const newOrders = adminOrders.filter(o => o.status === 'new');
    const cookingOrders = adminOrders.filter(o => o.status === 'cooking');
    const deliveringOrders = adminOrders.filter(o => o.status === 'delivering');
    const inProgressCount = newOrders.length + cookingOrders.length + deliveringOrders.length;
    return {
      totalOrders,
      revenue,
      inProgressCount,
      newCount: newOrders.length,
      cookingCount: cookingOrders.length,
      deliveringCount: deliveringOrders.length,
      completedCount: completedOrders.length
    };
  }, [adminOrders]);

  const filteredAdminOrders = useMemo(() => {
    let list = adminOrders;
    if (adminFilterTab === 'new') list = list.filter(o => o.status === 'new');
    else if (adminFilterTab === 'cooking') list = list.filter(o => o.status === 'cooking');
    else if (adminFilterTab === 'delivering') list = list.filter(o => o.status === 'delivering');
    else if (adminFilterTab === 'completed') list = list.filter(o => o.status === 'completed' || o.status === 'cancelled');

    if (adminOrderSearch.trim()) {
      const q = adminOrderSearch.trim().toLowerCase();
      list = list.filter(o => 
        (o.orderNumber && String(o.orderNumber).toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.phone && o.phone.toLowerCase().includes(q)) ||
        (o.address && o.address.toLowerCase().includes(q)) ||
        (o.username && o.username.toLowerCase().includes(q))
      );
    }
    return list;
  }, [adminOrders, adminFilterTab, adminOrderSearch]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const login = adminLoginInput.trim();
    const pass = adminPasswordInput.trim();
    if ((login === '1' || login.toLowerCase() === 'admin') && (pass === '1' || pass.toLowerCase() === 'admin')) {
      localStorage.setItem('vk_admin_auth', '1');
      setIsAdminLoggedIn(true);
      setAdminAuthError('');
      playSound('success');
      triggerHaptic('heavy');
    } else {
      setAdminAuthError('Неверный логин или пароль (используйте 1 / 1)');
      playSound('error');
      triggerHaptic('error');
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('vk_admin_auth');
    setIsAdminLoggedIn(false);
    setActiveTab('menu');
    triggerHaptic('light');
  };

  const handleAdminUpdateStatus = async (orderNumber: string, newStatus: string, etaMinutes?: number) => {
    try {
      triggerHaptic('medium');
      const payload: any = {
        orderNumber,
        status: newStatus
      };
      if (etaMinutes) {
        payload.etaMinutes = etaMinutes;
        payload.estimatedTime = `~${etaMinutes} мин`;
      }
      const res = await fetch(`${API_BASE_URL}/api/orders/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        playSound('status');
        fetchAdminOrders();
      }
    } catch (e) {
      console.error('Failed to update order status:', e);
    }
  };

  const handleAdminDelete = async (orderNumber: string) => {
    if (!window.confirm(`Удалить заказ #${orderNumber} из базы данных?`)) return;
    try {
      triggerHaptic('heavy');
      const res = await fetch(`${API_BASE_URL}/api/orders/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber })
      });
      if (res.ok) {
        playSound('remove');
        fetchAdminOrders();
      }
    } catch (e) {
      console.error('Failed to delete order:', e);
    }
  };

  const handleAdminToggleAvailability = async (productId: string) => {
    try {
      triggerHaptic('light');
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, isAvailable: !p.isAvailable } : p));
      await fetch(`${API_BASE_URL}/api/products/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });
    } catch (e) {
      console.error('Failed to toggle product availability:', e);
    }
  };

  const handleAdminChangePrice = async (productId: string, newPrice: number) => {
    try {
      triggerHaptic('medium');
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, price: newPrice } : p));
      setEditingPriceProductId(null);
      await fetch(`${API_BASE_URL}/api/products/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, price: newPrice })
      });
    } catch (e) {
      console.error('Failed to update price:', e);
    }
  };

  // MPSTATS High-contrast Tech Minimalism tokens
  const theme = {
    bg: isDarkTheme ? 'bg-[#0c0d10]' : 'bg-[#f7f8fa]',
    cardBg: isDarkTheme ? 'bg-[#14151a]' : 'bg-[#ffffff]',
    cardBorder: isDarkTheme ? 'border-[#22242c]' : 'border-[#e5e7eb]',
    subtleBg: isDarkTheme ? 'bg-[#1a1b22]' : 'bg-[#f1f2f5]',
    textPrimary: isDarkTheme ? 'text-[#f4f5f8]' : 'text-[#0c0d10]',
    textMuted: isDarkTheme ? 'text-[#8b8f9e]' : 'text-[#6b7280]',
    accentColor: 'text-[#16ff60]',
    accentBg: isDarkTheme ? 'bg-[#16ff60] text-[#0c0d10] font-bold' : 'bg-[#0c0d10] text-[#ffffff] font-bold',
    pillActive: isDarkTheme ? 'bg-[#16ff60] text-[#0c0d10] font-bold shadow-[0_0_15px_rgba(22,255,96,0.3)]' : 'bg-[#0c0d10] text-[#ffffff] font-bold',
    pillInactive: isDarkTheme ? 'bg-[#14151a] text-[#8b8f9e] border border-[#22242c]' : 'bg-[#ffffff] text-[#6b7280] border border-[#e5e7eb]'
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-150 select-none pb-28 ${theme.bg} ${theme.textPrimary}`}>

      {/* MPSTATS TECH MINIMALIST HEADER */}
      <header className={`sticky top-0 z-30 px-4 py-3 border-b backdrop-blur-xl transition-colors ${
        isDarkTheme ? 'bg-[#0c0d10]/90 border-[#22242c]' : 'bg-[#f7f8fa]/90 border-[#e5e7eb]'
      }`}>
        <div className="flex items-center justify-between gap-3">
          
          {/* Brand Typography */}
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[15px] font-extrabold tracking-tight uppercase ${theme.textPrimary}`}>
                Vibe Kitchen
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#16ff60] shadow-[0_0_8px_#16ff60]" />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8b8f9e]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#16ff60] animate-pulse" />
              <span>Кухня онлайн • 25–35 мин</span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2">
            
            {/* Moscow Time Glass Pill */}
            <button
              onClick={() => {
                triggerHaptic('light');
                setIsDarkTheme(!isDarkTheme);
              }}
              title="Переключить тему"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${
                isDarkTheme 
                  ? 'bg-[#14151a] border-[#22242c] text-[#f4f5f8] hover:border-[#333742]' 
                  : 'bg-[#ffffff] border-[#e5e7eb] text-[#0c0d10] hover:border-[#d1d5db]'
              }`}
            >
              {isDarkTheme ? <Moon className="w-3.5 h-3.5 text-[#16ff60]" /> : <Sun className="w-3.5 h-3.5 text-[#ff5533]" />}
              <span className="font-mono text-[11px]">{moscowTimeStr}</span>
            </button>

            {/* Admin PRO Quick Switch */}
            {isAdminLoggedIn && (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('admin');
                }}
                title="Панель управления"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase border transition-all active:scale-95 cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-[#16ff60] text-[#0c0d10] border-[#16ff60] shadow-[0_0_10px_rgba(22,255,96,0.4)]'
                    : 'bg-[#16ff60]/10 text-[#16ff60] border-[#16ff60]/30 hover:border-[#16ff60]'
                }`}
              >
                <Shield className="w-3 h-3" />
                <span>PRO</span>
              </button>
            )}

            {/* Cart Button */}
            <button
              onClick={() => {
                triggerHaptic('medium');
                setIsCartOpen(true);
              }}
              className={`relative p-2.5 rounded-full border transition-all active:scale-95 cursor-pointer ${
                isDarkTheme 
                  ? 'bg-[#14151a] border-[#22242c] text-[#f4f5f8] hover:border-[#16ff60]/50' 
                  : 'bg-[#ffffff] border-[#e5e7eb] text-[#0c0d10] hover:border-black'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#16ff60] text-[#0c0d10] text-[10px] font-black rounded-full min-w-4 h-4 px-1 flex items-center justify-center shadow-[0_0_10px_rgba(22,255,96,0.6)]">
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
            className={`mt-2.5 px-3 py-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all active:scale-[0.99] ${
              isDarkTheme ? 'bg-[#14151a] border-[#22242c] hover:border-[#16ff60]/40' : 'bg-[#ffffff] border-[#e5e7eb]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16ff60] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16ff60]"></span>
              </span>
              <span className="font-bold text-xs tracking-tight">Заказ в процессе выполнения</span>
            </div>
            <div className="flex items-center gap-1 font-extrabold text-xs text-[#16ff60]">
              <span>Трекер</span>
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
              <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${theme.textMuted}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по меню (бургеры, паста, напитки)..."
                className={`w-full pl-10 pr-9 py-2.5 rounded-full text-xs border transition-all focus:outline-none ${
                  isDarkTheme 
                    ? 'bg-[#14151a] border-[#22242c] text-[#f4f5f8] placeholder:text-[#6b7280] focus:border-[#16ff60] focus:shadow-[0_0_12px_rgba(22,255,96,0.15)]' 
                    : 'bg-[#ffffff] border-[#e5e7eb] text-[#0c0d10] placeholder:text-[#9ca3af] focus:border-black'
                }`}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${theme.textMuted} hover:text-white`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Chips Bar (Pills) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedCategory('all');
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
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
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === 'favorites' 
                    ? 'bg-[#ff5533] text-white shadow-[0_0_15px_rgba(255,85,51,0.35)]'
                    : theme.pillInactive
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${wishlist.length > 0 ? 'fill-current' : ''}`} />
                <span>Избранное ({wishlist.length})</span>
              </button>

              {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
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
                    className={`rounded-2xl border flex flex-col justify-between overflow-hidden transition-all duration-200 cursor-pointer ${
                      theme.cardBg
                    } ${theme.cardBorder} hover:border-[#383d4a] active:scale-[0.99] ${!isAvail ? 'opacity-50 grayscale-[35%]' : ''}`}
                  >
                    {/* Image Container */}
                    <div className="relative aspect-4/3 overflow-hidden bg-[#1a1b22]">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />

                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {product.badge && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0c0d10]/85 text-[#16ff60] border border-[#16ff60]/30 backdrop-blur-md">
                            {product.badge}
                          </span>
                        )}
                        {product.spicy && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ff5533]/90 text-white backdrop-blur-md flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" /> Острое
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => toggleWishlist(product.id, e)}
                        className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-transform active:scale-90 cursor-pointer ${
                          isFav ? 'bg-[#ff5533] text-white shadow-[0_0_10px_rgba(255,85,51,0.5)]' : 'bg-[#0c0d10]/60 border border-white/10 text-white'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                      </button>

                      {product.weight && (
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-[#0c0d10]/70 backdrop-blur-md border border-white/10 text-[10px] font-medium text-white/90">
                          {product.weight}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className={`text-xs font-bold tracking-tight line-clamp-1 mb-0.5 ${theme.textPrimary}`}>
                          {product.name}
                        </h3>
                        <p className={`text-[11px] line-clamp-2 leading-relaxed mb-2 ${theme.textMuted}`}>
                          {product.description}
                        </p>

                        {/* Analytical KBJU Chip */}
                        {Boolean(product.calories) && (
                          <div className={`inline-flex items-center gap-1.5 text-[10px] mb-2 px-2 py-0.5 rounded-full font-medium tracking-tight border ${
                            isDarkTheme ? 'bg-[#1a1b22] border-[#262832] text-[#c2c4cb]' : 'bg-[#f1f2f5] border-[#e5e7eb] text-[#4f4c46]'
                          }`}>
                            <span className="font-extrabold text-[#ff5533]">⚡ {product.calories} ккал</span>
                            {Boolean(product.proteins || product.fats || product.carbs) && (
                              <span className="opacity-75 font-mono text-[9px]">
                                • БЖУ {product.proteins || 0}/{product.fats || 0}/{product.carbs || 0}г
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Price & Add Action */}
                      <div className={`flex items-center justify-between pt-1.5 border-t ${
                        isDarkTheme ? 'border-[#22242c]' : 'border-[#e5e7eb]'
                      }`}>
                        <div>
                          <div className={`text-sm font-black tabular-nums ${theme.textPrimary}`}>
                            {product.price} ₽
                          </div>
                          {Boolean(product.oldPrice && Number(product.oldPrice) > Number(product.price)) && (
                            <div className={`text-[10px] line-through ${theme.textMuted}`}>
                              {product.oldPrice} ₽
                            </div>
                          )}
                        </div>

                        {isAvail ? (
                          qty > 0 ? (
                            <div 
                              onClick={e => e.stopPropagation()} 
                              className="flex items-center gap-1 rounded-full p-0.5 bg-[#16ff60] text-[#0c0d10] font-bold shadow-[0_0_12px_rgba(22,255,96,0.3)]"
                            >
                              <button 
                                onClick={e => removeFromCart(product.id, e)}
                                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 active:scale-90 transition-transform cursor-pointer"
                              >
                                <Minus className="w-3 h-3 stroke-[2.5]" />
                              </button>
                              <span className="text-xs font-black px-1 min-w-[14px] text-center">{qty}</span>
                              <button 
                                onClick={e => addToCart(product.id, e)}
                                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 active:scale-90 transition-transform cursor-pointer"
                              >
                                <Plus className="w-3 h-3 stroke-[2.5]" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={e => addToCart(product.id, e)}
                              className="px-3 py-1.5 rounded-full font-extrabold text-xs transition-transform active:scale-95 flex items-center gap-1 cursor-pointer bg-[#16ff60] text-[#0c0d10] shadow-[0_2px_10px_rgba(22,255,96,0.25)] hover:brightness-105"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>+ В корзину</span>
                            </button>
                          )
                        ) : (
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${theme.subtleBg} ${theme.textMuted}`}>
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
            {/* Header + Tabs (Active vs Archive) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-1">
              <div>
                <h2 className={`text-sm font-semibold tracking-tight ${theme.textPrimary}`}>
                  Мои заказы
                </h2>
                <p className={`text-[11px] ${theme.textMuted}`}>
                  Отслеживание статуса и архив выполненных заказов
                </p>
              </div>

              {/* Segmented controls: Активные / Архив */}
              <div className={`inline-flex items-center p-0.5 rounded-xl border self-start sm:self-auto ${theme.subtleBg} ${theme.cardBorder}`}>
                <button
                  onClick={() => { triggerHaptic('light'); setOrderFilterTab('active'); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    orderFilterTab === 'active'
                      ? `${theme.cardBg} ${theme.textPrimary} shadow-xs font-semibold`
                      : `${theme.textMuted}`
                  }`}
                >
                  <span>Активные</span>
                  {unarchivedOrders.length > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      orderFilterTab === 'active' ? 'bg-[#c86428]/15 text-[#c86428] font-bold' : theme.subtleBg
                    }`}>
                      {unarchivedOrders.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { triggerHaptic('light'); setOrderFilterTab('archived'); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    orderFilterTab === 'archived'
                      ? `${theme.cardBg} ${theme.textPrimary} shadow-xs font-semibold`
                      : `${theme.textMuted}`
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Архив</span>
                  {archivedOrders.length > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      orderFilterTab === 'archived' ? 'bg-[#c86428]/15 text-[#c86428] font-bold' : theme.subtleBg
                    }`}>
                      {archivedOrders.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {displayedOrders.length === 0 ? (
              <div className="text-center py-16 space-y-2.5">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${theme.subtleBg} ${theme.textMuted}`}>
                  {orderFilterTab === 'active' ? <Package className="w-6 h-6" /> : <Archive className="w-6 h-6" />}
                </div>
                <h3 className={`text-xs font-semibold ${theme.textPrimary}`}>
                  {orderFilterTab === 'active' ? 'Активных заказов пока нет' : 'В архиве пока пусто'}
                </h3>
                <p className={`text-[11px] max-w-xs mx-auto ${theme.textMuted}`}>
                  {orderFilterTab === 'active'
                    ? 'Выберите понравившиеся блюда в меню для оформления заказа'
                    : 'Вы можете переносить завершенные заказы в архив, чтобы они не загромождали список'}
                </p>
                {orderFilterTab === 'active' && (
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setActiveTab('menu');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-medium cursor-pointer ${theme.accentBg}`}
                  >
                    Перейти в меню
                  </button>
                )}
              </div>
            ) : (
              displayedOrders.map(order => {
                const orderNum = order.orderNumber || (order as any).order_number || String(order.id);
                const orderPrice = Number(order.totalPrice ?? (order as any).total_price ?? 0);
                const stageIndex = order.status === 'cooking' ? 2 : order.status === 'delivering' ? 3 : order.status === 'completed' ? 4 : 1;
                const isCancelled = order.status === 'cancelled';

                return (
                  <div
                    key={orderNum}
                    className={`rounded-2xl border p-3.5 space-y-3 transition-colors ${theme.cardBg} ${theme.cardBorder}`}
                  >
                    {/* Header */}
                    <div className={`flex items-center justify-between pb-2 border-b ${
                      isDarkTheme ? 'border-[#26282e]' : 'border-[#f0eee9]'
                    }`}>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold text-xs ${theme.textPrimary}`}>
                            Заказ #{orderNum}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            order.status === 'completed' ? 'bg-[#16ff60]/15 text-[#16ff60] border-[#16ff60]/30' :
                            order.status === 'delivering' ? 'bg-[#8b5cf6]/15 text-[#a78bfa] border-[#8b5cf6]/30' :
                            order.status === 'cooking' ? 'bg-[#ffaa00]/15 text-[#ffbe3b] border-[#ffaa00]/30' :
                            order.status === 'cancelled' ? 'bg-[#ff5533]/15 text-[#ff5533] border-[#ff5533]/30' :
                            theme.subtleBg
                          }`}>
                            {order.status === 'completed' ? 'Доставлен' :
                             order.status === 'delivering' ? 'Курьер в пути' :
                             order.status === 'cooking' ? 'На кухне' :
                             order.status === 'cancelled' ? 'Отменен' : 'Принят'}
                          </span>
                        </div>
                        <div className={`text-[10px] font-mono mt-0.5 ${theme.textMuted}`}>{order.createdAt || (order as any).created_at || ''}</div>
                      </div>

                      <div className="text-right">
                        <div className={`text-sm font-black tabular-nums ${theme.textPrimary}`}>
                          {orderPrice} ₽
                        </div>
                        <div className={`text-[10px] ${theme.textMuted}`}>
                          Оплата при получении
                        </div>
                      </div>
                    </div>

                    {/* STATUS & TIME INFO BLOCK */}
                    {!isCancelled && (
                      order.status === 'completed' ? (
                        /* Completed Order: Delivered Duration Badge */
                        <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          isDarkTheme ? 'bg-[#142319] border-[#1b3d26]' : 'bg-[#f0fdf4] border-[#bbf7d0]'
                        }`}>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16ff60]" />
                            <span className="font-bold text-[#16ff60]">
                              Заказ доставлен за {getDeliveredDurationText(order)}
                            </span>
                          </div>
                          {order.statusNote && (
                            <span className={`text-[11px] ${theme.textMuted}`}>{order.statusNote}</span>
                          )}
                        </div>
                      ) : order.status === 'delivering' ? (
                        /* Delivering Order: Real-time Countdown Timer */
                        (() => {
                          const cd = getOrderCountdown(order, nowTick);
                          return (
                            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                              isDarkTheme ? 'bg-[#1e172a] border-[#362752]' : 'bg-[#faf5ff] border-[#e9d5ff]'
                            }`}>
                              <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8b5cf6] opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#8b5cf6]"></span>
                                </span>
                                <div>
                                  <span className="font-bold text-[#a78bfa]">
                                    {cd?.isArriving ? '🚴 Курьер уже подъезжает!' : '🚴 Курьер в пути'}
                                  </span>
                                  {order.statusNote && (
                                    <div className={`text-[11px] ${theme.textMuted}`}>{order.statusNote}</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-[#a78bfa] shrink-0">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{cd ? (cd.isArriving ? 'Менее 1 мин' : cd.timeStr) : (order.estimatedTime || 'В пути')}</span>
                              </div>
                            </div>
                          );
                        })()
                      ) : order.status === 'cooking' ? (
                        /* Cooking Order: Kitchen Status & Time */
                        (() => {
                          const cd = getOrderCountdown(order, nowTick);
                          return (
                            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                              isDarkTheme ? 'bg-[#221c13] border-[#3d2e1b]' : 'bg-[#fffbeb] border-[#fde68a]'
                            }`}>
                              <div className="flex items-center gap-2">
                                <ChefHat className="w-3.5 h-3.5 text-[#ffbe3b] shrink-0" />
                                <div>
                                  <span className="font-bold text-[#ffbe3b]">
                                    👨‍🍳 Заказ готовится на кухне
                                  </span>
                                  {order.statusNote && (
                                    <div className={`text-[11px] ${theme.textMuted}`}>{order.statusNote}</div>
                                  )}
                                </div>
                              </div>
                              {(cd || order.estimatedTime) && (
                                <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-[#ffbe3b] shrink-0">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{cd ? (cd.isArriving ? 'Почти готово' : `~${cd.minutes > 0 ? cd.minutes : 1} мин`) : order.estimatedTime}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (order.estimatedTime || order.statusNote) ? (
                        /* New Order: ETA if assigned */
                        <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          isDarkTheme ? 'bg-[#14151a] border-[#22242c]' : 'bg-[#f1f2f5] border-[#e5e7eb]'
                        }`}>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-[#16ff60] shrink-0" />
                            <div>
                              {order.estimatedTime && (
                                <span className={`font-medium ${theme.textPrimary}`}>
                                  Примерное время: {order.estimatedTime}
                                </span>
                              )}
                              {order.statusNote && (
                                <div className={`text-[11px] ${theme.textMuted}`}>{order.statusNote}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null
                    )}

                    {/* Stepper */}
                    {!isCancelled && (
                      <div className={`p-3 rounded-2xl border ${theme.subtleBg} ${theme.cardBorder}`}>
                        <div className="relative flex items-center justify-between px-2 pt-1 pb-1">
                          {/* Stepper Track */}
                          <div className="absolute left-[22px] right-[22px] top-[18px] -translate-y-1/2 z-0">
                            {/* Base Track */}
                            <div className={`w-full h-0.5 ${isDarkTheme ? 'bg-[#22242c]' : 'bg-[#e5e7eb]'}`} />
                            {/* Active Fill Track */}
                            <div 
                              className="absolute left-0 top-0 h-0.5 transition-all duration-300 bg-[#16ff60]" 
                              style={{ width: `${Math.max(0, Math.min(100, ((stageIndex - 1) / 3) * 100))}%` }}
                            />
                          </div>

                          <div className="relative z-10 flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              stageIndex >= 1 ? 'bg-[#16ff60] text-[#0c0d10] shadow-[0_0_10px_rgba(22,255,96,0.4)]' : (isDarkTheme ? 'bg-[#1e2026] text-[#6c6e75]' : 'bg-[#e5e7eb] text-[#797670]')
                            }`}>
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            </div>
                            <span className={`text-[10px] font-medium ${theme.textMuted}`}>Принят</span>
                          </div>

                          <div className="relative z-10 flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              stageIndex >= 2 ? 'bg-[#16ff60] text-[#0c0d10] shadow-[0_0_10px_rgba(22,255,96,0.4)]' : (isDarkTheme ? 'bg-[#1e2026] text-[#6c6e75]' : 'bg-[#e5e7eb] text-[#797670]')
                            }`}>
                              <ChefHat className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-[10px] font-medium ${theme.textMuted}`}>Кухня</span>
                          </div>

                          <div className="relative z-10 flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              stageIndex >= 3 ? 'bg-[#16ff60] text-[#0c0d10] shadow-[0_0_10px_rgba(22,255,96,0.4)]' : (isDarkTheme ? 'bg-[#1e2026] text-[#6c6e75]' : 'bg-[#e5e7eb] text-[#797670]')
                            }`}>
                              <Bike className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-[10px] font-medium ${theme.textMuted}`}>В пути</span>
                          </div>

                          <div className="relative z-10 flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              stageIndex >= 4 ? 'bg-[#16ff60] text-[#0c0d10] shadow-[0_0_10px_rgba(22,255,96,0.4)]' : (isDarkTheme ? 'bg-[#1e2026] text-[#6c6e75]' : 'bg-[#e5e7eb] text-[#797670]')
                            }`}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-[10px] font-medium ${theme.textMuted}`}>Доставлен</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Order Items */}
                    <div className="space-y-1.5 text-xs">
                      {Array.isArray(order.items) && order.items.map((item: any, idx: number) => {
                        const itemPrice = Number(item.price) || 0;
                        const itemQty = Number(item.quantity) || 1;
                        const pMatch = INITIAL_PRODUCTS.find(p => p.id === item.id || p.name === item.name);
                        const cals = pMatch?.calories ? pMatch.calories * itemQty : null;

                        return (
                          <div key={idx} className="flex justify-between items-center text-[11px]">
                            <div className="truncate max-w-[210px]">
                              <span className={`font-medium ${theme.textPrimary}`}>
                                {itemQty} × {item.name}
                              </span>
                              {cals && (
                                <span className={`ml-1.5 text-[9.5px] font-mono text-[#ff5533]`}>
                                  ({cals} ккал)
                                </span>
                              )}
                            </div>
                            <span className={`font-mono font-bold ${theme.textMuted}`}>{itemPrice * itemQty} ₽</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Action Buttons */}
                    <div className={`flex items-center gap-2 pt-2.5 border-t ${
                      isDarkTheme ? 'border-[#22242c]' : 'border-[#e5e7eb]'
                    }`}>
                      <button
                        onClick={() => handleRepeatOrder(order)}
                        className={`flex-1 py-2 rounded-full border font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                          isDarkTheme ? 'border-[#22242c] bg-[#14151a] hover:bg-[#1a1b22] text-[#f4f5f8]' : 'border-[#e5e7eb] bg-[#ffffff] hover:bg-[#f1f2f5] text-[#0c0d10]'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Повторить заказ</span>
                      </button>

                      {orderFilterTab === 'active' ? (
                        <button
                          onClick={(e) => handleArchiveOrder(orderNum, e)}
                          className={`px-3 py-2 rounded-full border font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                            isDarkTheme ? 'border-[#22242c] bg-[#14151a] hover:bg-[#1a1b22] text-[#8b8f9e]' : 'border-[#e5e7eb] bg-[#ffffff] hover:bg-[#f1f2f5] text-[#6b7280]'
                          }`}
                          title="Перенести заказ в архив"
                        >
                          <Archive className="w-3.5 h-3.5 text-[#ffaa00]" />
                          <span>В архив</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleUnarchiveOrder(orderNum, e)}
                          className={`px-3 py-2 rounded-full border font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                            isDarkTheme ? 'border-[#22242c] bg-[#14151a] hover:bg-[#1a1b22] text-[#8b8f9e]' : 'border-[#e5e7eb] bg-[#ffffff] hover:bg-[#f1f2f5] text-[#6b7280]'
                          }`}
                          title="Вернуть в активные заказы"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5 text-[#16ff60]" />
                          <span>Вернуть</span>
                        </button>
                      )}

                      <button
                        onClick={() => setOrderToDelete(order)}
                        className={`p-2 rounded-full border transition-all active:scale-95 cursor-pointer ${
                          isDarkTheme ? 'border-[#22242c] bg-[#14151a] text-[#6b7280] hover:text-[#ff5533]' : 'border-[#e5e7eb] bg-[#ffffff] text-[#9ca3af] hover:text-[#ff5533]'
                        }`}
                        title="Удалить заказ"
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

            <div className={`p-4 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} space-y-3`}>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#16ff60]">
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
                className="w-full py-3 rounded-full font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all bg-[#16ff60] text-[#0c0d10] shadow-[0_4px_15px_rgba(22,255,96,0.3)] hover:brightness-105 active:scale-95"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Написать в поддержку (@qqeaux)</span>
              </a>
            </div>

            <div className={`rounded-2xl border p-4 space-y-2.5 ${theme.cardBg} ${theme.cardBorder}`}>
              <div className={`flex items-center gap-1.5 text-xs font-bold ${theme.textPrimary}`}>
                <HelpCircle className="w-4 h-4 text-[#16ff60]" />
                <span>Частые вопросы</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className={`p-3 rounded-xl border ${theme.subtleBg} ${theme.cardBorder}`}>
                  <div className={`font-bold mb-0.5 ${theme.textPrimary}`}>Как отслеживать статус?</div>
                  <div className={`text-[11px] leading-relaxed ${theme.textMuted}`}>
                    Во вкладке «Заказы» отображаются стадии приготовления и расчетное время от шефа.
                  </div>
                </div>

                  <div className={`p-3 rounded-xl border ${theme.subtleBg} ${theme.cardBorder}`}>
                  <div className={`font-bold mb-0.5 ${theme.textPrimary}`}>Способ оплаты</div>
                  <div className={`text-[11px] leading-relaxed ${theme.textMuted}`}>
                    Оплата происходит при получении курьеру — наличными или банковской картой.
                  </div>
                </div>
              </div>
            </div>

            {/* Quick entry link to admin panel */}
            <div className="pt-2 text-center">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('admin');
                }}
                className={`text-[10px] font-mono tracking-wider transition-colors ${theme.textMuted} hover:text-[#16ff60]`}
              >
                [ Диспетчерская / Панель управления ]
              </button>
            </div>
          </div>
        )}

        {/* ================= TAB 4: ADMIN / DISPATCHER ================= */}
        {activeTab === 'admin' && (
          <div className="space-y-4">
            
            {/* NOT LOGGED IN: LOGIN SCREEN */}
            {!isAdminLoggedIn ? (
              <div className={`p-6 rounded-3xl border ${theme.cardBg} ${theme.cardBorder} shadow-2xl space-y-5 max-w-md mx-auto my-4`}>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-[#16ff60]/10 border border-[#16ff60]/30 text-[#16ff60]">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h2 className={`text-base font-extrabold tracking-tight uppercase ${theme.textPrimary}`}>
                    Vibe Kitchen Pro
                  </h2>
                  <p className={`text-xs ${theme.textMuted}`}>
                    Диспетчерская панель управления рестораном
                  </p>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-3.5">
                  <div>
                    <label className={`block text-[11px] font-mono uppercase tracking-wider mb-1.5 ${theme.textMuted}`}>
                      Логин сотрудника
                    </label>
                    <input
                      type="text"
                      value={adminLoginInput}
                      onChange={(e) => setAdminLoginInput(e.target.value)}
                      placeholder="1 или admin"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-colors focus:outline-none focus:border-[#16ff60] ${
                        isDarkTheme 
                          ? 'bg-[#1a1b22] border-[#262832] text-[#f4f5f8] placeholder-[#555a68]' 
                          : 'bg-[#f1f2f5] border-[#d1d5db] text-[#0c0d10] placeholder-[#9ca3af]'
                      }`}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-mono uppercase tracking-wider mb-1.5 ${theme.textMuted}`}>
                      Пароль
                    </label>
                    <input
                      type="password"
                      value={adminPasswordInput}
                      onChange={(e) => setAdminPasswordInput(e.target.value)}
                      placeholder="••••"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-colors focus:outline-none focus:border-[#16ff60] ${
                        isDarkTheme 
                          ? 'bg-[#1a1b22] border-[#262832] text-[#f4f5f8] placeholder-[#555a68]' 
                          : 'bg-[#f1f2f5] border-[#d1d5db] text-[#0c0d10] placeholder-[#9ca3af]'
                      }`}
                    />
                  </div>

                  {adminAuthError && (
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium text-center">
                      {adminAuthError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 rounded-full font-black text-xs cursor-pointer transition-all bg-[#16ff60] text-[#0c0d10] shadow-[0_4px_15px_rgba(22,255,96,0.35)] hover:brightness-105 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Войти в диспетчерскую</span>
                  </button>

                  <div className="text-center pt-1">
                    <span className={`text-[10px] font-mono ${theme.textMuted}`}>
                      Тестовый доступ: логин <b className="text-[#16ff60]">1</b> / пароль <b className="text-[#16ff60]">1</b>
                    </span>
                  </div>
                </form>
              </div>
            ) : (
              /* LOGGED IN: MPSTATS BENTO DISPATCHER DASHBOARD */
              <div className="space-y-4">
                
                {/* Dashboard Top Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#16ff60]/10 border border-[#16ff60]/30 text-[#16ff60]">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h2 className={`text-sm font-extrabold tracking-tight uppercase ${theme.textPrimary}`}>
                          Диспетчерская VIBE
                        </h2>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16ff60] animate-pulse" />
                      </div>
                      <p className={`text-[10px] font-mono ${theme.textMuted}`}>
                        Управление заказами и кухней
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        fetchAdminOrders();
                      }}
                      title="Обновить данные"
                      className={`p-2 rounded-xl border text-xs transition-all cursor-pointer ${
                        isDarkTheme 
                          ? 'bg-[#14151a] border-[#22242c] text-[#8b8f9e] hover:text-[#16ff60] hover:border-[#16ff60]/40' 
                          : 'bg-[#ffffff] border-[#e5e7eb] text-[#6b7280] hover:text-[#0c0d10]'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={handleAdminLogout}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        isDarkTheme 
                          ? 'bg-[#14151a] border-[#22242c] text-red-400 hover:bg-red-500/10 hover:border-red-500/30' 
                          : 'bg-[#ffffff] border-[#e5e7eb] text-red-600 hover:bg-red-50'
                      }`}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Выйти</span>
                    </button>
                  </div>
                </div>

                {/* MPSTATS Bento Analytics Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className={`p-3 rounded-2xl border ${theme.cardBg} ${theme.cardBorder}`}>
                    <div className={`text-[10px] font-mono uppercase tracking-wider ${theme.textMuted}`}>
                      Выручка
                    </div>
                    <div className="text-base font-black text-[#16ff60] mt-0.5 font-mono">
                      {adminAnalytics.revenue.toLocaleString('ru-RU')} ₽
                    </div>
                    <div className={`text-[9px] mt-0.5 ${theme.textMuted}`}>
                      {adminAnalytics.completedCount} завершено
                    </div>
                  </div>

                  <div className={`p-3 rounded-2xl border ${theme.cardBg} ${theme.cardBorder}`}>
                    <div className={`text-[10px] font-mono uppercase tracking-wider ${theme.textMuted}`}>
                      В работе
                    </div>
                    <div className="text-base font-black text-amber-400 mt-0.5 font-mono">
                      {adminAnalytics.inProgressCount}
                    </div>
                    <div className={`text-[9px] mt-0.5 ${theme.textMuted}`}>
                      {adminAnalytics.newCount} нов • {adminAnalytics.cookingCount} кух • {adminAnalytics.deliveringCount} курьер
                    </div>
                  </div>

                  <div className={`p-3 rounded-2xl border ${theme.cardBg} ${theme.cardBorder}`}>
                    <div className={`text-[10px] font-mono uppercase tracking-wider ${theme.textMuted}`}>
                      Всего заказов
                    </div>
                    <div className={`text-base font-black mt-0.5 font-mono ${theme.textPrimary}`}>
                      {adminAnalytics.totalOrders}
                    </div>
                    <div className={`text-[9px] mt-0.5 ${theme.textMuted}`}>
                      В базе данных
                    </div>
                  </div>

                  <div className={`p-3 rounded-2xl border ${theme.cardBg} ${theme.cardBorder}`}>
                    <div className={`text-[10px] font-mono uppercase tracking-wider ${theme.textMuted}`}>
                      Стоп-лист
                    </div>
                    <div className="text-base font-black text-purple-400 mt-0.5 font-mono">
                      {products.filter(p => p.isAvailable === false).length}
                    </div>
                    <div className={`text-[9px] mt-0.5 ${theme.textMuted}`}>
                      Блюд отключено
                    </div>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setAdminFilterTab('all');
                    }}
                    className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-all ${
                      adminFilterTab === 'all' ? theme.pillActive : theme.pillInactive
                    }`}
                  >
                    Все ({adminOrders.length})
                  </button>

                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setAdminFilterTab('new');
                    }}
                    className={`relative px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-all ${
                      adminFilterTab === 'new' ? theme.pillActive : theme.pillInactive
                    }`}
                  >
                    🟡 Новые ({adminAnalytics.newCount})
                  </button>

                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setAdminFilterTab('cooking');
                    }}
                    className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-all ${
                      adminFilterTab === 'cooking' ? theme.pillActive : theme.pillInactive
                    }`}
                  >
                    👨‍🍳 Кухня ({adminAnalytics.cookingCount})
                  </button>

                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setAdminFilterTab('delivering');
                    }}
                    className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-all ${
                      adminFilterTab === 'delivering' ? theme.pillActive : theme.pillInactive
                    }`}
                  >
                    🚴 В пути ({adminAnalytics.deliveringCount})
                  </button>

                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setAdminFilterTab('completed');
                    }}
                    className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-all ${
                      adminFilterTab === 'completed' ? theme.pillActive : theme.pillInactive
                    }`}
                  >
                    ✅ Выполнены ({adminAnalytics.completedCount})
                  </button>

                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setAdminFilterTab('menu');
                    }}
                    className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-all ${
                      adminFilterTab === 'menu' ? theme.pillActive : theme.pillInactive
                    }`}
                  >
                    🏷 Стоп-лист и Цены
                  </button>
                </div>

                {/* TAB 4A: ORDERS MANAGEMENT */}
                {adminFilterTab !== 'menu' && (
                  <div className="space-y-3">
                    
                    {/* Search Input */}
                    <div className="relative">
                      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${theme.textMuted}`} />
                      <input
                        type="text"
                        value={adminOrderSearch}
                        onChange={(e) => setAdminOrderSearch(e.target.value)}
                        placeholder="Поиск по номеру заказа, клиенту, телефону, адресу..."
                        className={`w-full pl-9 pr-3.5 py-2 rounded-xl border text-xs font-mono transition-colors focus:outline-none focus:border-[#16ff60] ${
                          isDarkTheme 
                            ? 'bg-[#14151a] border-[#22242c] text-[#f4f5f8] placeholder-[#555a68]' 
                            : 'bg-[#ffffff] border-[#e5e7eb] text-[#0c0d10] placeholder-[#9ca3af]'
                        }`}
                      />
                      {adminOrderSearch && (
                        <button
                          onClick={() => setAdminOrderSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8b8f9e] hover:text-white"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Orders List */}
                    {filteredAdminOrders.length === 0 ? (
                      <div className={`p-8 rounded-2xl border text-center ${theme.cardBg} ${theme.cardBorder}`}>
                        <Package className={`w-8 h-8 mx-auto mb-2 opacity-30 ${theme.textMuted}`} />
                        <div className={`text-xs font-bold ${theme.textPrimary}`}>
                          Заказов не найдено
                        </div>
                        <div className={`text-[11px] mt-1 ${theme.textMuted}`}>
                          {adminOrderSearch ? 'Попробуйте изменить поисковый запрос' : 'В этой вкладке пока нет заказов'}
                        </div>
                      </div>
                    ) : (
                      filteredAdminOrders.map((order) => {
                        const isDelivered = order.status === 'completed';
                        const isCancelled = order.status === 'cancelled';
                        const isCooking = order.status === 'cooking';
                        const isDelivering = order.status === 'delivering';
                        const isNew = order.status === 'new';

                        // Calculated delivery duration
                        let deliveryDurationStr = '';
                        if (isDelivered && order.completedAt && order.createdAt) {
                          const start = new Date(order.createdAt).getTime();
                          const end = new Date(order.completedAt).getTime();
                          if (!isNaN(start) && !isNaN(end) && end > start) {
                            const diffMins = Math.max(1, Math.round((end - start) / 60000));
                            deliveryDurationStr = `Доставлен за ${diffMins} мин`;
                          }
                        }

                        return (
                          <div 
                            key={order.orderNumber || order.id}
                            className={`p-4 rounded-2xl border transition-all ${theme.cardBg} ${theme.cardBorder} space-y-3 hover:border-[#16ff60]/40`}
                          >
                            {/* Card Header: Order # + Status + Time */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-black text-[#16ff60]">
                                  #{order.orderNumber}
                                </span>
                                {order.createdAt && (
                                  <span className={`text-[10px] font-mono ${theme.textMuted}`}>
                                    {new Date(order.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>

                              {/* Status Badge */}
                              <div className="flex items-center gap-1.5">
                                {isNew && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    🟡 Новый
                                  </span>
                                )}
                                {isCooking && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                    👨‍🍳 На кухне {order.estimatedTime ? `(${order.estimatedTime})` : ''}
                                  </span>
                                )}
                                {isDelivering && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                    🚴 Курьер в пути {order.estimatedTime ? `(${order.estimatedTime})` : ''}
                                  </span>
                                )}
                                {isDelivered && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#16ff60]/15 text-[#16ff60] border border-[#16ff60]/30">
                                    ✅ Выполнен
                                  </span>
                                )}
                                {isCancelled && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/15 text-red-400 border border-red-500/30">
                                    ❌ Отменен
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Client Bento Card */}
                            <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${theme.subtleBg} ${theme.cardBorder}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className={`font-bold ${theme.textPrimary}`}>
                                  {order.customerName || 'Клиент'}
                                </span>
                                {order.username && (
                                  <a
                                    href={`https://t.me/${order.username.replace('@', '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#16ff60] font-mono text-[11px] flex items-center gap-1 hover:underline"
                                  >
                                    <span>@{order.username.replace('@', '')}</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                                {order.phone && (
                                  <a 
                                    href={`tel:${order.phone}`} 
                                    className="font-mono text-[#8b8f9e] hover:text-[#16ff60] flex items-center gap-1"
                                  >
                                    <Phone className="w-3 h-3 text-[#16ff60]" />
                                    <span>{order.phone}</span>
                                  </a>
                                )}
                                {order.address && (
                                  <div className="flex items-center gap-1 text-[#8b8f9e]">
                                    <MapPin className="w-3 h-3 text-[#16ff60]" />
                                    <span>{order.address}</span>
                                  </div>
                                )}
                              </div>

                              {order.comment && (
                                <div className={`text-[10px] italic border-t pt-1 ${theme.cardBorder} ${theme.textMuted}`}>
                                  «{order.comment}»
                                </div>
                              )}
                            </div>

                            {/* Order Items Breakdown */}
                            <div className="space-y-1 text-xs">
                              {order.items && order.items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-[11px]">
                                  <span className={theme.textPrimary}>
                                    {item.name} <span className="font-mono font-bold text-[#16ff60]">× {item.quantity}</span>
                                  </span>
                                  <span className="font-mono text-[#8b8f9e]">
                                    {((item.price || 0) * (item.quantity || 1)).toLocaleString('ru-RU')} ₽
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Total and Performance Duration Badge */}
                            <div className={`flex items-center justify-between border-t pt-2 ${theme.cardBorder}`}>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-mono uppercase tracking-wider ${theme.textMuted}`}>
                                  Сумма заказа:
                                </span>
                                <span className="font-mono text-sm font-black text-[#16ff60]">
                                  {(order.totalPrice || 0).toLocaleString('ru-RU')} ₽
                                </span>
                              </div>

                              {deliveryDurationStr && (
                                <div className="text-[10px] font-mono font-bold text-[#16ff60] px-2 py-0.5 rounded-full bg-[#16ff60]/10 border border-[#16ff60]/30">
                                  ⚡ {deliveryDurationStr}
                                </div>
                              )}
                            </div>

                            {/* Action Buttons for Dispatcher */}
                            {(() => {
                              const currentOrderNum = order.orderNumber || String(order.id || '');
                              return (
                                <div className="space-y-2 pt-1 border-t border-dashed border-[#22242c]">
                                  
                                  {/* Kitchen ETA actions (for new orders) */}
                                  {isNew && (
                                    <div>
                                      <div className={`text-[10px] font-mono uppercase tracking-wider mb-1 ${theme.textMuted}`}>
                                        👨‍🍳 Начать готовку (Шеф):
                                      </div>
                                      <div className="grid grid-cols-3 gap-1.5">
                                        <button
                                          onClick={() => handleAdminUpdateStatus(currentOrderNum, 'cooking', 15)}
                                          className="py-1.5 rounded-lg text-[11px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 active:scale-95 transition-all cursor-pointer"
                                        >
                                          15 мин
                                        </button>
                                        <button
                                          onClick={() => handleAdminUpdateStatus(currentOrderNum, 'cooking', 25)}
                                          className="py-1.5 rounded-lg text-[11px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 active:scale-95 transition-all cursor-pointer"
                                        >
                                          25 мин
                                        </button>
                                        <button
                                          onClick={() => handleAdminUpdateStatus(currentOrderNum, 'cooking', 35)}
                                          className="py-1.5 rounded-lg text-[11px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 active:scale-95 transition-all cursor-pointer"
                                        >
                                          35 мин
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Courier ETA actions (Starts live countdown on customer Mini App!) */}
                                  {(isNew || isCooking) && (
                                    <div>
                                      <div className={`text-[10px] font-mono uppercase tracking-wider mb-1 ${theme.textMuted}`}>
                                        🚴 Отправить курьера (клиент получит таймер):
                                      </div>
                                      <div className="grid grid-cols-4 gap-1.5">
                                        <button
                                          onClick={() => handleAdminUpdateStatus(currentOrderNum, 'delivering', 15)}
                                          className="py-1.5 rounded-lg text-[11px] font-mono font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 active:scale-95 transition-all cursor-pointer"
                                        >
                                          15м
                                        </button>
                                        <button
                                          onClick={() => handleAdminUpdateStatus(currentOrderNum, 'delivering', 25)}
                                          className="py-1.5 rounded-lg text-[11px] font-mono font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 active:scale-95 transition-all cursor-pointer"
                                        >
                                          25м
                                        </button>
                                        <button
                                          onClick={() => handleAdminUpdateStatus(currentOrderNum, 'delivering', 35)}
                                          className="py-1.5 rounded-lg text-[11px] font-mono font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 active:scale-95 transition-all cursor-pointer"
                                        >
                                          35м
                                        </button>
                                        <button
                                          onClick={() => handleAdminUpdateStatus(currentOrderNum, 'delivering', 45)}
                                          className="py-1.5 rounded-lg text-[11px] font-mono font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 active:scale-95 transition-all cursor-pointer"
                                        >
                                          45м
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Complete & Cancel & Delete Actions */}
                                  <div className="flex items-center gap-1.5 pt-1">
                                    {!isDelivered && (
                                      <button
                                        onClick={() => handleAdminUpdateStatus(currentOrderNum, 'completed')}
                                        className="flex-1 py-2 rounded-xl text-xs font-black bg-[#16ff60] text-[#0c0d10] hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_2px_10px_rgba(22,255,96,0.3)]"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Заказ доставлен</span>
                                      </button>
                                    )}

                                    {!isDelivered && !isCancelled && (
                                      <button
                                        onClick={() => handleAdminUpdateStatus(currentOrderNum, 'cancelled')}
                                        className="px-3 py-2 rounded-xl text-xs font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/10 active:scale-95 transition-all cursor-pointer"
                                      >
                                        Отменить
                                      </button>
                                    )}

                                    <button
                                      onClick={() => handleAdminDelete(currentOrderNum)}
                                      title="Удалить заказ навсегда"
                                      className="p-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/15 active:scale-95 transition-all cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                </div>
                              );
                            })()}

                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* TAB 4B: MENU & STOP-LIST MANAGEMENT */}
                {adminFilterTab === 'menu' && (
                  <div className="space-y-3">
                    <div className={`p-3 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} text-xs`}>
                      <div className="font-bold text-[#16ff60] mb-0.5">
                        Управление меню и стоп-листом
                      </div>
                      <div className={theme.textMuted}>
                        Отключайте блюда, которые закончились на кухне, или быстро меняйте цены прямо в приложении.
                      </div>
                    </div>

                    <div className="space-y-2">
                      {products.map((p) => {
                        const isAvailable = p.isAvailable !== false;
                        const isEditingPrice = editingPriceProductId === p.id;

                        return (
                          <div
                            key={p.id}
                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                              theme.cardBg
                            } ${!isAvailable ? 'opacity-60 border-red-500/30' : theme.cardBorder}`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={p.image}
                                alt={p.name}
                                className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <div className={`text-xs font-bold truncate ${theme.textPrimary}`}>
                                  {p.name}
                                </div>
                                <div className={`text-[10px] font-mono ${theme.textMuted}`}>
                                  {p.weight} • {p.calories} ккал • {p.category}
                                </div>

                                {/* Price display or Price editor */}
                                <div className="mt-1 flex items-center gap-1.5">
                                  {isEditingPrice ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        value={editingPriceValue}
                                        onChange={(e) => setEditingPriceValue(e.target.value)}
                                        className="w-16 px-1.5 py-0.5 rounded border text-xs font-mono bg-[#1a1b22] border-[#16ff60] text-white focus:outline-none"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => {
                                          const val = parseInt(editingPriceValue, 10);
                                          if (!isNaN(val) && val > 0) {
                                            handleAdminChangePrice(p.id, val);
                                          }
                                        }}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#16ff60] text-[#0c0d10]"
                                      >
                                        OK
                                      </button>
                                      <button
                                        onClick={() => setEditingPriceProductId(null)}
                                        className="px-1 py-0.5 text-[10px] text-[#8b8f9e]"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingPriceProductId(p.id);
                                        setEditingPriceValue(String(p.price));
                                      }}
                                      title="Нажмите, чтобы изменить цену"
                                      className="font-mono text-xs font-bold text-[#16ff60] hover:underline cursor-pointer"
                                    >
                                      {p.price} ₽ ✏️
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Toggle availability button */}
                            <button
                              onClick={() => handleAdminToggleAvailability(p.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                                isAvailable
                                  ? 'bg-[#16ff60]/15 text-[#16ff60] border-[#16ff60]/30 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/30'
                                  : 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-[#16ff60]/15 hover:text-[#16ff60] hover:border-[#16ff60]/30'
                              }`}
                            >
                              {isAvailable ? '🟢 В наличии' : '🔴 Стоп-лист'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        )}
      </main>

      {/* MPSTATS FLOATING CAPSULE BOTTOM NAVIGATION */}
      <div className="fixed bottom-3 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
        <nav className={`pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-full border shadow-2xl backdrop-blur-2xl transition-all ${
          isDarkTheme 
            ? 'bg-[#14151a]/95 border-[#22242c] shadow-[0_10px_35px_rgba(0,0,0,0.7)]' 
            : 'bg-[#ffffff]/95 border-[#e5e7eb] shadow-[0_10px_35px_rgba(0,0,0,0.1)]'
        }`}>
          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('menu');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'menu' 
                ? (isDarkTheme ? 'bg-[#16ff60] text-[#0c0d10] shadow-[0_0_12px_rgba(22,255,96,0.3)]' : 'bg-[#0c0d10] text-[#ffffff]') 
                : theme.textMuted
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Меню</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('orders');
            }}
            className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'orders' 
                ? (isDarkTheme ? 'bg-[#16ff60] text-[#0c0d10] shadow-[0_0_12px_rgba(22,255,96,0.3)]' : 'bg-[#0c0d10] text-[#ffffff]') 
                : theme.textMuted
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Заказы</span>
            {activeOrders.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#16ff60] animate-pulse" />
            )}
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('support');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'support' 
                ? (isDarkTheme ? 'bg-[#16ff60] text-[#0c0d10] shadow-[0_0_12px_rgba(22,255,96,0.3)]' : 'bg-[#0c0d10] text-[#ffffff]') 
                : theme.textMuted
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Инфо</span>
          </button>

          {/* Admin panel tab button */}
          {(isAdminLoggedIn || window.location.search.includes('admin')) && (
            <button
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('admin');
              }}
              className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'admin' 
                  ? (isDarkTheme ? 'bg-[#16ff60] text-[#0c0d10] shadow-[0_0_12px_rgba(22,255,96,0.3)]' : 'bg-[#0c0d10] text-[#ffffff]') 
                  : theme.textMuted
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Админ</span>
              {adminAnalytics.newCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#16ff60] animate-pulse" />
              )}
            </button>
          )}

          <button
            onClick={() => {
              triggerHaptic('light');
              setIsCartOpen(true);
            }}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
              isDarkTheme 
                ? 'bg-[#1a1b22] border-[#262832] text-[#f4f5f8] hover:border-[#16ff60]/50' 
                : 'bg-[#f1f2f5] border-[#e5e7eb] text-[#0c0d10]'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {totalItemsCount > 0 && (
              <span className="bg-[#16ff60] text-[#0c0d10] text-[10px] font-black rounded-full px-1.5 py-0.2 min-w-4 text-center">
                {totalItemsCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* PRODUCT DETAIL MODAL */}
      {selectedProduct && (() => {
        const currentProduct = products.find(p => p.id === selectedProduct.id) || selectedProduct;
        const initialMatch = INITIAL_PRODUCTS.find(p => p.id === currentProduct.id);
        const curCal = currentProduct.calories ?? initialMatch?.calories ?? 0;
        const curProt = currentProduct.proteins ?? initialMatch?.proteins ?? 0;
        const curFat = currentProduct.fats ?? initialMatch?.fats ?? 0;
        const curCarb = currentProduct.carbs ?? initialMatch?.carbs ?? 0;
        const isAvail = currentProduct.isAvailable !== false;

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
            <div className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden border shadow-2xl ${
              theme.cardBg
            } ${theme.cardBorder}`}>
              
              <div className="relative aspect-16/9 w-full bg-[#1a1b22] overflow-hidden shrink-0">
                <img 
                  src={currentProduct.image} 
                  alt={currentProduct.name} 
                  className={`w-full h-full object-cover ${!isAvail ? 'opacity-50 grayscale-[35%]' : ''}`}
                />
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-3.5 right-3.5 p-2 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-transform active:scale-95 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                  {!isAvail ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#bd3a2e] text-white">
                      Стоп-лист
                    </span>
                  ) : currentProduct.badge ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#0c0d10]/90 text-[#16ff60] border border-[#16ff60]/40 backdrop-blur-md">
                      {currentProduct.badge}
                    </span>
                  ) : null}
                  {currentProduct.weight && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white/90 bg-black/60 backdrop-blur-md border border-white/10">
                      {currentProduct.weight}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 overflow-y-auto space-y-4">
                <div>
                  <h2 className={`text-lg font-black tracking-tight ${theme.textPrimary}`}>{currentProduct.name}</h2>
                  <p className={`text-xs mt-1.5 leading-relaxed ${theme.textMuted}`}>
                    {currentProduct.description}
                  </p>
                </div>

                {/* Analytical KBJU Bento Grid */}
                <div className={`p-3.5 rounded-2xl border ${theme.subtleBg} ${theme.cardBorder}`}>
                  <div className={`text-[10px] font-bold uppercase tracking-wider mb-2.5 flex justify-between ${theme.textMuted}`}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16ff60]" /> 
                      Энергетический баланс
                    </span>
                    <span className="font-mono text-[10px]">{currentProduct.weight ? currentProduct.weight : 'на 1 порцию'}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className={`p-2 rounded-xl border flex flex-col justify-center ${isDarkTheme ? 'bg-[#14151a] border-[#22242c]' : 'bg-[#ffffff] border-[#e5e7eb]'}`}>
                      <div className="font-black text-sm text-[#ff5533]">{curCal}</div>
                      <div className={`text-[10px] font-medium ${theme.textMuted}`}>ккал</div>
                    </div>
                    <div className={`p-2 rounded-xl border flex flex-col justify-center ${isDarkTheme ? 'bg-[#14151a] border-[#22242c]' : 'bg-[#ffffff] border-[#e5e7eb]'}`}>
                      <div className="font-bold text-xs">{curProt} г</div>
                      <div className={`text-[10px] font-medium ${theme.textMuted}`}>белки</div>
                    </div>
                    <div className={`p-2 rounded-xl border flex flex-col justify-center ${isDarkTheme ? 'bg-[#14151a] border-[#22242c]' : 'bg-[#ffffff] border-[#e5e7eb]'}`}>
                      <div className="font-bold text-xs">{curFat} г</div>
                      <div className={`text-[10px] font-medium ${theme.textMuted}`}>жиры</div>
                    </div>
                    <div className={`p-2 rounded-xl border flex flex-col justify-center ${isDarkTheme ? 'bg-[#14151a] border-[#22242c]' : 'bg-[#ffffff] border-[#e5e7eb]'}`}>
                      <div className="font-bold text-xs">{curCarb} г</div>
                      <div className={`text-[10px] font-medium ${theme.textMuted}`}>углеводы</div>
                    </div>
                  </div>
                </div>

                {/* Ingredients */}
                {currentProduct.ingredients && currentProduct.ingredients.length > 0 && (
                  <div className="space-y-1.5">
                    <div className={`text-xs font-bold ${theme.textMuted}`}>Состав и аллергены</div>
                    <div className={`p-3 rounded-2xl border ${theme.subtleBg} ${theme.cardBorder}`}>
                      <div className="flex flex-wrap gap-1.5">
                        {currentProduct.ingredients.map((ing, i) => (
                          <span 
                            key={i} 
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                              isDarkTheme ? 'bg-[#14151a] border-[#22242c] text-[#f4f5f8]' : 'bg-[#ffffff] border-[#e5e7eb] text-[#0c0d10]'
                            }`}
                          >
                            <span className="w-1 h-1 rounded-full bg-[#16ff60]" />
                            <span>{ing}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className={`p-4 border-t flex items-center justify-between gap-4 ${
                isDarkTheme ? 'border-[#22242c] bg-[#0c0d10]' : 'border-[#e5e7eb] bg-[#f7f8fa]'
              }`}>
                <div>
                  <div className={`text-[10px] font-medium ${theme.textMuted}`}>Стоимость:</div>
                  <div className="flex items-baseline gap-2">
                    <div className={`text-xl font-black tabular-nums ${theme.textPrimary}`}>
                      {currentProduct.price} ₽
                    </div>
                    {Boolean(currentProduct.oldPrice && Number(currentProduct.oldPrice) > Number(currentProduct.price)) && (
                      <div className={`text-xs line-through ${theme.textMuted}`}>
                        {currentProduct.oldPrice} ₽
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  {!isAvail ? (
                    <span className={`px-4 py-2.5 rounded-full text-xs font-bold ${theme.subtleBg} ${theme.textMuted}`}>
                      Недоступно
                    </span>
                  ) : (cart[currentProduct.id] || 0) > 0 ? (
                    <div className="flex items-center gap-2 rounded-full p-1 bg-[#16ff60] text-[#0c0d10] font-black shadow-[0_0_15px_rgba(22,255,96,0.35)]">
                      <button 
                        onClick={() => removeFromCart(currentProduct.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 active:scale-90 transition-transform cursor-pointer"
                      >
                        <Minus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                      <span className="text-sm font-black px-2 text-center">
                        {cart[currentProduct.id]}
                      </span>
                      <button 
                        onClick={() => addToCart(currentProduct.id)}
                        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 active:scale-90 transition-transform cursor-pointer"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(currentProduct.id)}
                      className="px-6 py-2.5 rounded-full font-black text-xs transition-all active:scale-95 flex items-center gap-2 cursor-pointer bg-[#16ff60] text-[#0c0d10] shadow-[0_4px_15px_rgba(22,255,96,0.35)] hover:brightness-105"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
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
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-md h-full flex flex-col justify-between border-l ${theme.cardBg} ${theme.cardBorder}`}>
            <div className={`p-4 border-b flex items-center justify-between ${
              isDarkTheme ? 'border-[#22242c]' : 'border-[#e5e7eb]'
            }`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                <ShoppingBag className="w-4 h-4 text-[#16ff60]" />
                <span>Корзина заказа</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-[#16ff60] text-[#0c0d10]">
                  {totalItemsCount}
                </span>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className={`p-1.5 rounded-full ${theme.subtleBg} ${theme.textMuted} hover:text-white cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {cartItems.length === 0 ? (
                <div className="text-center py-20 space-y-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${theme.subtleBg} ${theme.textMuted}`}>
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <div className={`text-sm font-bold ${theme.textPrimary}`}>Корзина пуста</div>
                  <p className={`text-xs ${theme.textMuted}`}>Выберите блюда в меню, чтобы сделать заказ</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cartItems.map(item => (
                    <div 
                      key={item.product.id}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border text-xs ${theme.subtleBg} ${theme.cardBorder}`}
                    >
                      <div className="flex items-center gap-2.5 truncate max-w-[200px]">
                        <img src={item.product.image} alt={item.product.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                        <div className="truncate">
                          <div className={`font-bold truncate ${theme.textPrimary}`}>{item.product.name}</div>
                          <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                            <span className="text-[#16ff60] font-black">{item.product.price} ₽</span>
                            {Boolean(item.product.calories) && (
                              <span className={`text-[10px] font-mono ${theme.textMuted}`}>
                                • {(item.product.calories || 0) * item.quantity} ккал
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 rounded-full p-0.5 bg-[#16ff60] text-[#0c0d10] font-bold">
                        <button 
                          onClick={() => removeFromCart(item.product.id)}
                          className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 active:scale-90 transition-transform cursor-pointer"
                        >
                          <Minus className="w-3 h-3 stroke-[2.5]" />
                        </button>
                        <span className="text-xs font-black px-1.5 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => addToCart(item.product.id)}
                          className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-black/10 active:scale-90 transition-transform cursor-pointer"
                        >
                          <Plus className="w-3 h-3 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total Cart KBJU Widget */}
              {cartItems.length > 0 && cartTotalKbju.cals > 0 && (
                <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                  isDarkTheme ? 'bg-[#14151a] border-[#22242c]' : 'bg-[#f1f2f5] border-[#e5e7eb]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-base text-[#ff5533]">⚡</span>
                    <div>
                      <div className={`font-bold text-xs ${theme.textPrimary}`}>КБЖУ всего заказа</div>
                      <div className={`text-[10px] font-mono mt-0.5 ${theme.textMuted}`}>
                        Б: {cartTotalKbju.p}г • Ж: {cartTotalKbju.f}г • У: {cartTotalKbju.c}г
                      </div>
                    </div>
                  </div>
                  <div className="font-black text-sm text-[#ff5533] tabular-nums">
                    {cartTotalKbju.cals} ккал
                  </div>
                </div>
              )}

              {/* Promocode */}
              {cartItems.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCodeInput}
                      onChange={e => setPromoCodeInput(e.target.value)}
                      placeholder="Промокод (VIBE20)"
                      className={`flex-1 px-3 py-2 rounded-full text-xs font-bold uppercase border focus:outline-none transition-all ${
                        isDarkTheme 
                          ? 'bg-[#14151a] border-[#22242c] text-[#f4f5f8] placeholder:text-[#6b7280] focus:border-[#16ff60]' 
                          : 'bg-[#ffffff] border-[#e5e7eb] text-[#0c0d10] placeholder:text-[#9ca3af] focus:border-black'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      className="px-4 py-2 rounded-full font-black text-xs cursor-pointer bg-[#16ff60] text-[#0c0d10] active:scale-95 transition-transform"
                    >
                      Применить
                    </button>
                  </div>
                  {appliedPromo && <div className="text-[11px] text-[#16ff60] font-bold">Промокод {appliedPromo.code} применен!</div>}
                  {promoError && <div className="text-[11px] text-[#ff5533] font-bold">{promoError}</div>}
                </div>
              )}

              {/* Checkout Form */}
              {cartItems.length > 0 && (
                <form id="order-form" onSubmit={handleSubmitOrder} className="space-y-2.5 pt-2">
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${theme.textMuted}`}>Данные доставки:</div>
                  
                  <div>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Имя и Фамилия"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none transition-all ${
                        isDarkTheme ? 'bg-[#14151a] border-[#22242c] text-[#f4f5f8] focus:border-[#16ff60]' : 'bg-[#ffffff] border-[#e5e7eb] text-[#0c0d10] focus:border-black'
                      }`}
                    />
                    {formErrors.customerName && <div className="text-[10px] text-[#ff5533] mt-0.5 font-medium">{formErrors.customerName}</div>}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(formatRussianPhone(e.target.value))}
                      placeholder="+7 (9XX) XXX-XX-XX"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border focus:outline-none transition-all ${
                        isDarkTheme ? 'bg-[#14151a] border-[#22242c] text-[#f4f5f8] focus:border-[#16ff60]' : 'bg-[#ffffff] border-[#e5e7eb] text-[#0c0d10] focus:border-black'
                      }`}
                    />
                    {formErrors.phone && <div className="text-[10px] text-[#ff5533] mt-0.5 font-medium">{formErrors.phone}</div>}
                  </div>

                  <div>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Email для электронного чека"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none transition-all ${
                        isDarkTheme ? 'bg-[#14151a] border-[#22242c] text-[#f4f5f8] focus:border-[#16ff60]' : 'bg-[#ffffff] border-[#e5e7eb] text-[#0c0d10] focus:border-black'
                      }`}
                    />
                    {formErrors.email && <div className="text-[10px] text-[#ff5533] mt-0.5 font-medium">{formErrors.email}</div>}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      placeholder="Адрес (город, улица, дом, кв)"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none transition-all ${
                        isDarkTheme ? 'bg-[#14151a] border-[#22242c] text-[#f4f5f8] focus:border-[#16ff60]' : 'bg-[#ffffff] border-[#e5e7eb] text-[#0c0d10] focus:border-black'
                      }`}
                    />
                    {formErrors.address && <div className="text-[10px] text-[#ff5533] mt-0.5 font-medium">{formErrors.address}</div>}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Пожелание курьеру (этаж, домофон)"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none transition-all ${
                        isDarkTheme ? 'bg-[#14151a] border-[#22242c] text-[#f4f5f8] focus:border-[#16ff60]' : 'bg-[#ffffff] border-[#e5e7eb] text-[#0c0d10] focus:border-black'
                      }`}
                    />
                  </div>

                  <div className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs ${theme.subtleBg} ${theme.cardBorder}`}>
                    <Banknote className="w-4 h-4 text-[#16ff60] shrink-0" />
                    <span className={theme.textPrimary}>Оплата при получении курьеру (наличные или карта)</span>
                  </div>
                </form>
              )}
            </div>

            {cartItems.length > 0 && (
              <div className={`p-4 border-t space-y-3 ${
                isDarkTheme ? 'border-[#22242c] bg-[#0c0d10]' : 'border-[#e5e7eb] bg-[#f7f8fa]'
              }`}>
                <div className="flex justify-between items-center text-sm font-bold">
                  <span>Итого к оплате:</span>
                  <span className="text-[#16ff60] text-lg font-black tabular-nums">{totalPrice} ₽</span>
                </div>

                <button
                  type="submit"
                  form="order-form"
                  className="w-full py-3.5 rounded-full font-black text-sm transition-all active:scale-98 cursor-pointer bg-[#16ff60] text-[#0c0d10] shadow-[0_4px_20px_rgba(22,255,96,0.35)] hover:brightness-105"
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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-xs rounded-3xl p-6 border text-center space-y-4 shadow-2xl ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto bg-[#16ff60]/15 text-[#16ff60] border border-[#16ff60]/30 shadow-[0_0_15px_rgba(22,255,96,0.3)]">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className={`text-base font-black tracking-tight ${theme.textPrimary}`}>Заказ #{orderSuccess.orderNumber} принят!</h2>
              <p className={`text-xs mt-1 leading-relaxed ${theme.textMuted}`}>
                Шеф-повар уже готовит блюда. Вы можете следить за статусом во вкладке «Заказы».
              </p>
            </div>

            <button
              onClick={() => {
                triggerHaptic('light');
                setOrderSuccess(null);
                setActiveTab('orders');
              }}
              className="w-full py-3 rounded-full font-black text-xs cursor-pointer bg-[#16ff60] text-[#0c0d10] shadow-[0_4px_15px_rgba(22,255,96,0.3)] hover:brightness-105 active:scale-95 transition-all"
            >
              Перейти к заказам
            </button>
          </div>
        </div>
      )}

      {/* SINGLE ORDER DELETE MODAL */}
      {orderToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-xs rounded-3xl p-5 border text-center space-y-3.5 shadow-2xl ${theme.cardBg} ${theme.cardBorder}`}>
            <h3 className={`text-sm font-bold ${theme.textPrimary}`}>
              Удалить заказ #{orderToDelete.orderNumber || (orderToDelete as any).order_number}?
            </h3>
            <p className={`text-xs ${theme.textMuted}`}>Заказ будет безвозвратно удален из списка и базы данных.</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOrderToDelete(null)}
                className={`flex-1 py-2.5 rounded-full border text-xs font-bold cursor-pointer transition-all active:scale-95 ${theme.cardBorder} ${theme.textMuted} hover:border-[#383d4a]`}
              >
                Отмена
              </button>
              <button
                onClick={confirmDeleteOrder}
                className="flex-1 py-2.5 rounded-full bg-[#ff5533] text-white text-xs font-bold cursor-pointer shadow-[0_2px_10px_rgba(255,85,51,0.3)] hover:brightness-105 active:scale-95 transition-all"
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
