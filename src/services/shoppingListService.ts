import supabase from './supabaseClient';
import { ShoppingListItem } from '../types';

export async function getShoppingListByHousehold(householdId: string): Promise<ShoppingListItem[]> {
  const { data, error } = await supabase
    .from('shopping_list')
    .select('*')
    .eq('household_id', householdId)
    .order('added_by', { ascending: true });
  if (error) throw new Error(error.message);
  return data as ShoppingListItem[];
}

export async function addShoppingListItem(item: Omit<ShoppingListItem, 'id' | 'purchased_at'>): Promise<ShoppingListItem> {
  const { data, error } = await supabase
    .from('shopping_list')
    .insert(item)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ShoppingListItem;
}

export async function updateShoppingListItem(id: string, updates: Partial<ShoppingListItem>): Promise<ShoppingListItem> {
  const { data, error } = await supabase
    .from('shopping_list')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ShoppingListItem;
}

export async function deleteShoppingListItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('shopping_list')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
} 