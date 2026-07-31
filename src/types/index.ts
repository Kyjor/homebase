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
  shopping_list_id?: string; // Optional: links to a shopping list if this is a shopping list item
  is_purchased?: boolean; // Optional: for shopping list/expense integration
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

// Reminder type
export interface Reminder {
  id: string;
  household_id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  created_by: string;
  created_at: string;
  is_completed: boolean;
}

// House Health
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'open' | 'paused' | 'archived';
export type TaskFrequency = 'none' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export interface Room {
  id: string;
  household_id: string;
  name: string;
  description?: string | null;
  sort_order: number;
  color?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HouseTask {
  id: string;
  household_id: string;
  room_id: string;
  title: string;
  description?: string | null;
  estimated_cost?: number | null;
  priority: TaskPriority;
  status: TaskStatus;
  frequency: TaskFrequency;
  interval_days?: number | null;
  next_due?: string | null;
  last_completed_at?: string | null;
  created_by?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  household_id: string;
  completed_at: string;
  cost?: number | null;
  notes?: string | null;
  completed_by?: string | null;
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  household_id: string;
  task_id?: string | null;
  completion_id?: string | null;
  storage_path: string;
  mime_type?: string | null;
  created_by?: string | null;
  created_at: string;
}
