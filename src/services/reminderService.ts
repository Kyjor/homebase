import supabase from './supabaseClient';
import { Reminder } from '../types';

export async function getRemindersByHousehold(householdId: string): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('household_id', householdId)
    .order('date', { ascending: true })
    .order('time', { ascending: true });
  if (error) throw new Error(error.message);
  return data as Reminder[];
}

export async function getRemindersByDate(householdId: string, date: string): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('household_id', householdId)
    .eq('date', date)
    .order('time', { ascending: true });
  if (error) throw new Error(error.message);
  return data as Reminder[];
}

export async function addReminder(reminder: Omit<Reminder, 'id' | 'created_at'>): Promise<Reminder> {
  const { data, error } = await supabase
    .from('reminders')
    .insert(reminder)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Reminder;
}

export async function updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder> {
  const { data, error } = await supabase
    .from('reminders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Reminder;
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

