import supabase from './supabaseClient';
import { Room } from '../types';

export async function getRoomsByHousehold(
  householdId: string,
  includeArchived = false
): Promise<Room[]> {
  let query = supabase
    .from('rooms')
    .select('*')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (!includeArchived) {
    query = query.is('archived_at', null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as Room[];
}

export async function addRoom(
  room: Omit<Room, 'id' | 'created_at' | 'updated_at' | 'archived_at'>
): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .insert(room)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Room;
}

export async function updateRoom(id: string, updates: Partial<Room>): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Room;
}

export async function archiveRoom(id: string): Promise<Room> {
  return updateRoom(id, { archived_at: new Date().toISOString() });
}

export async function unarchiveRoom(id: string): Promise<Room> {
  return updateRoom(id, { archived_at: null });
}

export async function deleteRoom(id: string): Promise<void> {
  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
