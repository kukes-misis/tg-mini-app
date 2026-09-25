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
  }[];
  totalPrice: number;
  customerName: string;
  phone: string;
  address: string;
  comment?: string;
  paymentMethod: 'online' | 'cash';
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  createdAt?: string;
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
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}
