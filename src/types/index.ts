// User type
export interface User {
  id: string;
  email: string;
  name: string;
  household_id: string;
}

// Household type
export interface Household {
  id: string;
  name: string;
  created_at: string;
}

// Expense type
export interface Expense {
  id: string;
  household_id: string;
  date: string;
  item_name: string;
  amount: number;
  category_id: string;
  notes?: string;
  is_recurring: boolean;
  created_by: string;
  created_at: string;
}

// Category type
export interface Category {
  id: string;
  household_id: string;
  name: string;
  type: 'default' | 'custom';
  color?: string;
  icon?: string;
}

// Budget type
export interface Budget {
  id: string;
  household_id: string;
  category_id: string;
  month: string; // YYYY-MM
  limit_amount: number;
}

// Shopping List Item type
export interface ShoppingListItem {
  id: string;
  household_id: string;
  item_name: string;
  category_id?: string;
  added_by: string;
  is_purchased: boolean;
  purchased_at?: string;
}

// Recurring Payment type
export interface RecurringPayment {
  id: string;
  household_id: string;
  amount: number;
  category_id: string;
  description: string;
  frequency: 'monthly' | 'weekly' | 'custom';
  next_due: string;
  status: 'active' | 'paused' | 'cancelled';
  last_logged?: string;
}
