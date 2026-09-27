export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  category: string;
  image: string;
  badge?: string;
  weight?: string;
  isAvailable?: boolean;
  ingredients?: string[];
  calories?: number; // ккал
  proteins?: number; // г
  fats?: number;     // г
  carbs?: number;    // г
  allergens?: string[];
  spicy?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type OrderStatus = 'new' | 'cooking' | 'delivering' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid';

export interface OrderData {
  id?: string;
  orderNumber?: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    image?: string;
  }[];
  totalPrice: number;
  subtotal?: number;
  discount?: number;
  promoCode?: string;
  cutlery?: number;
  tips?: number;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  comment?: string;
  paymentMethod: 'online' | 'cash';
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  estimatedTime?: string;
  statusNote?: string;
  createdAt?: string;
  deletedForUser?: boolean;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        sendData: (data: string) => void;
        showAlert?: (message: string, callback?: () => void) => void;
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}
