import supabase from './supabaseClient';
import { Budget } from '../types';

export async function getBudgetsByHousehold(householdId: string): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('household_id', householdId)
    .order('month', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Budget[];
}

export async function addBudget(budget: Omit<Budget, 'id'>): Promise<Budget> {
  const { data, error } = await supabase
    .from('budgets')
    .insert(budget)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Budget;
}

export async function updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
  const { data, error } = await supabase
    .from('budgets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Budget;
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
} 