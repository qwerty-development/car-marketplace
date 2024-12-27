export interface Notification {
  id: string;
  userId: string;
  type: 'car_like' | 'price_drop' | 'new_message' | 'subscription' | 'car_sold' | 'view_milestone' | 'autoclip_like';
  title: string;
  message: string;
  data?: {
    screen?: string;
    params?: Record<string, any>;
  };
  isRead: boolean;
  createdAt: string;
}