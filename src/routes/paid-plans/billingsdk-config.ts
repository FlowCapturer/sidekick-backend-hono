export interface Plan {
  id: string;
  title: string;
  description: string;
  highlight?: boolean;
  type?: 'monthly' | 'yearly';
  currency?: string;
  monthlyPrice: string;
  yearlyPrice: string;
  buttonText: string;
  badge?: string;
  planDisplayCost?: {
    monthly: string;
    yearly: string;
  };
  minUserRequired: number;
  maxUserRequired: number;
  features: {
    name: string;
    icon: string;
    iconColor?: string;
  }[];
}

export interface CurrentPlan {
  plan: Plan;
  type: 'monthly' | 'yearly' | 'custom';
  price?: string;
  startDate: string;
  expiryDate: string;
  activePlanFor: number;
  paidAmount: string;
  transactionId?: string;
  paymentMethod: string;
  status: 'active' | 'inactive' | 'past_due' | 'cancelled';
}
