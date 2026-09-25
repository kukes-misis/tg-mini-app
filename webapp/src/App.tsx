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
  User, 
  CheckCircle2, 
  Sparkles,
  CreditCard,
  Banknote
} from 'lucide-react';
import { CATEGORIES, PRODUCTS } from './data/products';
import { Product, CartItem, OrderData } from './types';

export function App() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<OrderData | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('online');

  // Initialize Telegram WebApp
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

  const triggerHaptic = (type: 'light' | 'medium' | 'success') => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      if (type === 'success') {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      } else {
        window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
      }
    }
  };

  const addToCart = (productId: string) => {
    triggerHaptic('light');
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }));
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
    return PRODUCTS.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const prod = PRODUCTS.find(p => p.id === id);
        return prod ? { product: prod, quantity: qty } : null;
      })
      .filter((item): item is CartItem => item !== null);
  }, [cart]);

  const totalQuantity = useMemo(() => {
    return Object.values(cart).reduce((sum, q) => sum + q, 0);
  }, [cart]);

  const totalPrice = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cartItems]);

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !phone.trim()) {
      alert('Пожалуйста, укажите телефон и адрес доставки');
      return;
    }

    const orderPayload: OrderData = {
      items: cartItems.map(item => ({
        id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price
      })),
      totalPrice,
      customerName: customerName || 'Покупатель',
      phone,
      address,
      comment,
      paymentMethod
    };

    triggerHaptic('success');

    // If inside Telegram, send data back to the bot!
    if (window.Telegram?.WebApp?.sendData) {
      window.Telegram.WebApp.sendData(JSON.stringify(orderPayload));
    }

    setOrderSuccess(orderPayload);
    setIsCartOpen(false);
    setCart({});
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 pt-3 pb-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gourmet & Craft</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name 
                ? `Привет, ${window.Telegram.WebApp.initDataUnsafe.user.first_name}!` 
                : 'Вкусная Доставка'}
            </h1>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>30–45 мин</span>
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
            return (
              <div 
                key={product.id}
                className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-xs flex flex-col justify-between transition-transform active:scale-[0.99]"
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

                    {qty === 0 ? (
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

              {/* Delivery Details Form */}
              <form id="order-form" onSubmit={handleSubmitOrder} className="space-y-3.5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Куда доставить</h3>
                
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Имя получателя"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    placeholder="+7 (___) ___-__-__"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Город, улица, дом, квартира"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-blue-500"
                  />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center shadow-xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-1">Заказ принят!</h2>
            <p className="text-xs text-slate-500 mb-4">
              Мы уже начали готовить ваш заказ. Детали отправлены в бот.
            </p>

            <div className="bg-slate-50 rounded-2xl p-3.5 text-left text-xs space-y-1.5 mb-5 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-400">Получатель:</span>
                <span className="font-semibold text-slate-800">{orderSuccess.customerName}</span>
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
