import supabase from './supabaseClient';
import { Todo } from '../types';

export async function getTodosByHousehold(householdId: string): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Todo[];
}

export async function addTodo(todo: Omit<Todo, 'id' | 'created_at' | 'updated_at'>): Promise<Todo> {
  const { data, error } = await supabase
    .from('todos')
    .insert(todo)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Todo;
}

export async function updateTodo(id: string, updates: Partial<Todo>): Promise<Todo> {
  const { data, error } = await supabase
    .from('todos')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Todo;
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function toggleTodoCompletion(id: string, completed: boolean): Promise<Todo> {
  const updates: Partial<Todo> = {
    completed,
    completed_at: completed ? new Date().toISOString() : undefined,
    updated_at: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Todo;
}