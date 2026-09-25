import { Product } from '../types';

export const CATEGORIES = [
  { id: 'all', name: '🔥 Все' },
  { id: 'burgers', name: '🍔 Бургеры' },
  { id: 'pizza', name: '🍕 Пицца' },
  { id: 'drinks', name: '🥤 Напитки' },
  { id: 'desserts', name: '🍰 Десерты' }
];

export const PRODUCTS: Product[] = [
  {
    id: 'b1',
    name: 'Блэк Ангус Бургер',
    description: 'Мраморная говядина, сыр чеддер, хрустящий бекон, карамелизированный лук и фирменный соус BBQ.',
    price: 490,
    oldPrice: 590,
    category: 'burgers',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
    badge: 'Хит',
    weight: '360 г'
  },
  {
    id: 'b2',
    name: 'Трюфельный Чизбургер',
    description: 'Двойная котлета из говядины, соус с белым трюфелем, руккола и выдержанный пармезан.',
    price: 590,
    category: 'burgers',
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80',
    badge: 'Шеф-выбор',
    weight: '380 г'
  },
  {
    id: 'b3',
    name: 'Криспи Чикен Бургер',
    description: 'Нежное филе цыпленка в хрустящей панировке, салат айсберг, маринованные огурчики и соус ранч.',
    price: 420,
    category: 'burgers',
    image: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600&auto=format&fit=crop&q=80',
    weight: '320 г'
  },
  {
    id: 'p1',
    name: 'Пицца Пепперони Премиум',
    description: 'Пряная чоризо, моцарелла фьор ди латте, соус из томатов Сан Марцано и базилик.',
    price: 680,
    oldPrice: 750,
    category: 'pizza',
    image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&auto=format&fit=crop&q=80',
    badge: 'Топ',
    weight: '550 г (30 см)'
  },
  {
    id: 'p2',
    name: 'Пицца Четыре Сыра',
    description: 'Сливочная основа, моцарелла, горгонзола с благородной плесенью, таледжо и пармезан.',
    price: 740,
    category: 'pizza',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
    weight: '520 г (30 см)'
  },
  {
    id: 'd1',
    name: 'Лимонад Малина-Маракуйя',
    description: 'Крафтовый освежающий лимонад из натурального пюре маракуйи и свежей малины.',
    price: 260,
    category: 'drinks',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
    weight: '450 мл'
  },
  {
    id: 'd2',
    name: 'Матча Латте на кокосовом',
    description: 'Церемониальный зеленый чай матча из Японии на нежном кокосовом молоке.',
    price: 310,
    category: 'drinks',
    image: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80',
    weight: '350 мл'
  },
  {
    id: 'des1',
    name: 'Баскский Чизкейк Сан-Себастьян',
    description: 'Карамелизованная корочка и тающая сливочная середина. Подается с ягодным конфитюром.',
    price: 390,
    category: 'desserts',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&auto=format&fit=crop&q=80',
    badge: 'Новинка',
    weight: '180 г'
  }
];
