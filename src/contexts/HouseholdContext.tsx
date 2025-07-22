import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import supabase from '../services/supabaseClient';
import { Household } from '../types';
import { useAuth } from './AuthContext';

interface HouseholdContextType {
  household: Household | null;
  loading: boolean;
  error: string | null;
  createHousehold: (name: string) => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  refreshHousehold: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider = ({ children }: { children: ReactNode }) => {
  const { user, refreshSession } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.household_id) {
      fetchHousehold(user.household_id);
    } else {
      setHousehold(null);
    }
    // eslint-disable-next-line
  }, [user?.household_id]);

  const fetchHousehold = async (householdId: string) => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('households')
      .select('*')
      .eq('id', householdId)
      .single();
    if (data) setHousehold(data as Household);
    if (error) setError(error.message);
    setLoading(false);
  };

  const createHousehold = async (name: string) => {
    setLoading(true);
    setError(null);
    // Create household
    const { data, error } = await supabase
      .from('households')
      .insert({ name })
      .select()
      .single();
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Update user with household_id
    if (user) {
      await supabase.from('users').update({ household_id: data.id }).eq('id', user.id);
      await refreshSession();
    }
    setHousehold(data as Household);
    setLoading(false);
  };

  const joinHousehold = async (inviteCode: string) => {
    setLoading(true);
    setError(null);
    // Find household by invite code (id)
    const { data, error } = await supabase
      .from('households')
      .select('*')
      .eq('id', inviteCode)
      .single();
    if (error || !data) {
      setError('Invalid invite code');
      setLoading(false);
      return;
    }
    // Update user with household_id
    if (user) {
      await supabase.from('users').update({ household_id: data.id }).eq('id', user.id);
      await refreshSession();
    }
    setHousehold(data as Household);
    setLoading(false);
  };

  const refreshHousehold = async () => {
    if (user?.household_id) {
      await fetchHousehold(user.household_id);
    }
  };

  return (
    <HouseholdContext.Provider value={{ household, loading, error, createHousehold, joinHousehold, refreshHousehold }}>
      {children}
    </HouseholdContext.Provider>
  );
};

export const useHousehold = () => {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
}; 