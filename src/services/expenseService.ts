import supabase from './supabaseClient';
import { Expense } from '../types';

export async function getExpensesByHousehold(householdId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('household_id', householdId)
    .order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Expense[];
}

export async function addExpense(expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert(expense)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Expense;
}

export async function updateExpense(id: string, updates: Partial<Expense>): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Expense;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
} 