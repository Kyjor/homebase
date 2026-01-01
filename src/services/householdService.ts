import supabase from './supabaseClient';
import { User } from '../types';

export async function getHouseholdMembers(householdId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('household_id', householdId)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return data as User[];
}

export async function inviteUserByEmail(email: string, householdId: string): Promise<void> {
  // In a real app, you'd send an invite email. For now, we'll just check if user exists
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error || !data) {
    throw new Error('User not found. They need to sign up first.');
  }
  
  // Update user's household_id
  const { error: updateError } = await supabase
    .from('users')
    .update({ household_id: householdId })
    .eq('id', data.id);
  
  if (updateError) {
    throw new Error(updateError.message);
  }
}

