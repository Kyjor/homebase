import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { Category, Budget } from '../types';
import { getCategoriesByHousehold } from '../services/categoryService';
import { getBudgetsByHousehold, addBudget, updateBudget, deleteBudget } from '../services/budgetService';
import supabase from '../services/supabaseClient';
import { getCache, setCache } from '../utils/cacheManager';
import styles from './ManagePanel.module.css';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const BudgetManager: React.FC = () => {
  const { household } = useHousehold();
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editLimits, setEditLimits] = useState<{ [catId: string]: string }>({});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [queuedMutations, setQueuedMutations] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load from cache if offline, else fetch from Supabase
  useEffect(() => {
    if (!household) return;
    let ignore = false;
    const cacheKey = `budgets_${household.id}`;
    const fetchData = async () => {
      if (!isOnline) {
        const cached = await getCache<Budget[]>(cacheKey);
        if (!ignore && cached) setBudgets(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      Promise.all([
        getCategoriesByHousehold(household.id),
        getBudgetsByHousehold(household.id)
      ])
        .then(async ([categories, budgets]) => {
          if (!ignore) {
            setCategories(categories);
            setBudgets(budgets);
            setEditLimits(
              Object.fromEntries(
                categories.map(cat => [cat.id, String(budgets.find(b => b.category_id === cat.id && b.month === getCurrentMonth())?.limit_amount || '')])
              )
            );
            setLoading(false);
            await setCache(cacheKey, budgets);
          }
        })
        .catch(e => {
          if (!ignore) {
            setError(e.message);
            setLoading(false);
          }
        });
    };
    fetchData();

    // Real-time subscription
    const channel = supabase.channel('budgets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'budgets',
          filter: `household_id=eq.${household.id}`,
        },
        payload => {
          if (payload.eventType === 'INSERT') {
            setBudgets(prev => [...prev, payload.new as Budget]);
          } else if (payload.eventType === 'UPDATE') {
            setBudgets(prev => prev.map(b => b.id === payload.new.id ? payload.new as Budget : b));
          } else if (payload.eventType === 'DELETE') {
            setBudgets(prev => prev.filter(b => b.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, [household, isOnline]);

  // Load queued mutations from localStorage
  useEffect(() => {
    if (!household) return;
    const key = `budget_mutations_${household.id}`;
    const raw = localStorage.getItem(key);
    if (raw) setQueuedMutations(JSON.parse(raw));
    else setQueuedMutations([]);
  }, [household]);

  // Sync queued mutations when back online
  useEffect(() => {
    if (!household || !isOnline || queuedMutations.length === 0) return;
    const key = `budget_mutations_${household.id}`;
    const sync = async () => {
      setSyncing(true);
      for (const m of queuedMutations) {
        try {
          if (m.type === 'add') await addBudget(m.data);
          if (m.type === 'update') await updateBudget(m.id, m.data);
          if (m.type === 'delete') await deleteBudget(m.id);
        } catch {}
      }
      localStorage.removeItem(key);
      setQueuedMutations([]);
      setSyncing(false);
    };
    sync();
  }, [isOnline, queuedMutations, household]);

  // Helper to queue mutation if offline
  const queueMutation = (mutation: any) => {
    if (!household) return;
    const key = `budget_mutations_${household.id}`;
    const updated = [...queuedMutations, mutation];
    setQueuedMutations(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const handleLimitChange = (catId: string, value: string) => {
    setEditLimits(prev => ({ ...prev, [catId]: value }));
  };

  const handleSave = async (catId: string) => {
    if (!household) return;
    const month = getCurrentMonth();
    const limit = Number(editLimits[catId]);
    if (isNaN(limit) || limit < 0) {
      setError('Limit must be a non-negative number');
      setSaving(false);
      return;
    }
    const existing = budgets.find(b => b.category_id === catId && b.month === month);
    const budgetData = {
      household_id: household.id,
      category_id: catId,
      month,
      limit_amount: limit,
    };
    if (!isOnline) {
      if (existing) {
        setBudgets(budgets.map(b => (b.id === existing.id ? { ...b, limit_amount: limit } : b)));
        queueMutation({ type: 'update', id: existing.id, data: { limit_amount: limit } });
      } else {
        setBudgets([...budgets, budgetData as Budget]);
        queueMutation({ type: 'add', data: budgetData });
      }
      setSaving(false);
      return;
    }
    try {
      let updated: Budget;
      if (existing) {
        updated = await updateBudget(existing.id, { limit_amount: limit });
        setBudgets(budgets.map(b => (b.id === existing.id ? updated : b)));
      } else {
        updated = await addBudget(budgetData);
        setBudgets([...budgets, updated]);
      }
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  if (loading) return <div className={styles.hint}>Loading budgets…</div>;

  return (
    <div className={styles.panel}>
      <p className={styles.hint}>Monthly limits for {getCurrentMonth()}. Save each category after editing.</p>
      {syncing && <p className={styles.hint}>Syncing offline changes…</p>}
      {error && <div className={styles.error}>{error}</div>}
      {categories.length === 0 ? (
        <div className={styles.empty}>Add categories first, then set budgets here.</div>
      ) : (
        <div className={styles.stack}>
          {categories.map(cat => (
            <div key={cat.id} className={styles.row}>
              <span className={styles.label}>{cat.name}</span>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                placeholder="Limit"
                value={editLimits[cat.id] || ''}
                onChange={e => handleLimitChange(cat.id, e.target.value)}
                disabled={saving}
              />
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => handleSave(cat.id)}
                disabled={saving}
              >
                {budgets.find(b => b.category_id === cat.id && b.month === getCurrentMonth())
                  ? 'Update'
                  : 'Set'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BudgetManager; 