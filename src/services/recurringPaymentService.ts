import supabase from './supabaseClient';
import { RecurringPayment } from '../types';

export async function getRecurringPaymentsByHousehold(householdId: string): Promise<RecurringPayment[]> {
  const { data, error } = await supabase
    .from('recurring_payments')
    .select('*')
    .eq('household_id', householdId)
    .order('next_due', { ascending: true });
  if (error) throw new Error(error.message);
  return data as RecurringPayment[];
}

export async function addRecurringPayment(payment: Omit<RecurringPayment, 'id' | 'last_logged'>): Promise<RecurringPayment> {
  const { data, error } = await supabase
    .from('recurring_payments')
    .insert(payment)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RecurringPayment;
}

export async function updateRecurringPayment(id: string, updates: Partial<RecurringPayment>): Promise<RecurringPayment> {
  const { data, error } = await supabase
    .from('recurring_payments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RecurringPayment;
}

export async function deleteRecurringPayment(id: string): Promise<void> {
  const { error } = await supabase
    .from('recurring_payments')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
} 