import supabase from './supabaseClient';

export interface ShoppingList {
  id: string;
  household_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export async function getShoppingListsByHousehold(householdId: string): Promise<ShoppingList[]> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data as ShoppingList[];
}

export async function addShoppingList(list: Omit<ShoppingList, 'id' | 'created_at' | 'updated_at'>): Promise<ShoppingList> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .insert(list)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ShoppingList;
}

export async function updateShoppingList(id: string, updates: Partial<ShoppingList>): Promise<ShoppingList> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ShoppingList;
}

export async function deleteShoppingList(id: string): Promise<void> {
  const { error } = await supabase
    .from('shopping_lists')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
} 