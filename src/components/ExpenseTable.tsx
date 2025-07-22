import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { Expense, Category } from '../types';
import { getExpensesByHousehold, addExpense, updateExpense, deleteExpense } from '../services/expenseService';
import { getCategoriesByHousehold } from '../services/categoryService';
import supabase from '../services/supabaseClient';
import { getCache, setCache } from '../utils/cacheManager';
import { useAuth } from '../contexts/AuthContext';

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 700;

const ExpenseTable: React.FC = () => {
  const { household } = useHousehold();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({ date: '', item_name: '', amount: 0, category_id: '', notes: '', is_recurring: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<Partial<Expense>>({});
  const [syncing, setSyncing] = useState(false);
  const [queuedMutations, setQueuedMutations] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { user } = useAuth();

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
    const cacheKey = `expenses_${household.id}`;
    const fetchData = async () => {
      if (!isOnline) {
        const cached = await getCache<Expense[]>(cacheKey);
        if (!ignore && cached) setExpenses(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      Promise.all([
        getExpensesByHousehold(household.id),
        getCategoriesByHousehold(household.id)
      ])
        .then(async ([expenses, categories]) => {
          if (!ignore) {
            setExpenses(expenses);
            setCategories(categories);
            setLoading(false);
            await setCache(cacheKey, expenses);
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
    const channel = supabase.channel('expenses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `household_id=eq.${household.id}`,
        },
        payload => {
          if (payload.eventType === 'INSERT') {
            setExpenses(prev => [payload.new as Expense, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setExpenses(prev => prev.map(e => e.id === payload.new.id ? payload.new as Expense : e));
          } else if (payload.eventType === 'DELETE') {
            setExpenses(prev => prev.filter(e => e.id !== payload.old.id));
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
    const key = `expense_mutations_${household.id}`;
    const raw = localStorage.getItem(key);
    if (raw) setQueuedMutations(JSON.parse(raw));
    else setQueuedMutations([]);
  }, [household]);

  // Sync queued mutations when back online
  useEffect(() => {
    if (!household || !isOnline || queuedMutations.length === 0) return;
    const key = `expense_mutations_${household.id}`;
    const sync = async () => {
      setSyncing(true);
      for (const m of queuedMutations) {
        try {
          if (m.type === 'add') await addExpense(m.data);
          if (m.type === 'update') await updateExpense(m.id, m.data);
          if (m.type === 'delete') await deleteExpense(m.id);
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
    const key = `expense_mutations_${household.id}`;
    const updated = [...queuedMutations, mutation];
    setQueuedMutations(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household) return;
    const expenseData = {
      ...newExpense,
      household_id: household.id,
      created_by: user?.id, // Use the actual user ID
      is_recurring: !!newExpense.is_recurring,
      date: newExpense.date || new Date().toISOString().slice(0, 10),
      amount: Number(newExpense.amount) || 0,
      category_id: newExpense.category_id || categories[0]?.id || '',
      item_name: newExpense.item_name || '',
    } as any;
    if (!isOnline) {
      setExpenses([expenseData, ...expenses]);
      queueMutation({ type: 'add', data: expenseData });
      setNewExpense({ date: '', item_name: '', amount: 0, category_id: '', notes: '', is_recurring: false });
      return;
    }
    try {
      const expense = await addExpense(expenseData);
      setExpenses([expense, ...expenses]);
      setNewExpense({ date: '', item_name: '', amount: 0, category_id: '', notes: '', is_recurring: false });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setEditExpense({ ...expense });
  };

  const handleEditChange = (field: keyof Expense, value: any) => {
    setEditExpense(prev => ({ ...prev, [field]: value }));
  };

  const handleEditSave = async (id: string) => {
    if (!isOnline) {
      setExpenses(expenses.map(exp => (exp.id === id ? { ...exp, ...editExpense } : exp)));
      queueMutation({ type: 'update', id, data: editExpense });
      setEditingId(null);
      setEditExpense({});
      return;
    }
    try {
      const updated = await updateExpense(id, editExpense);
      setExpenses(expenses.map(exp => (exp.id === id ? updated : exp)));
      setEditingId(null);
      setEditExpense({});
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return;
    if (!isOnline) {
      setExpenses(expenses.filter(exp => exp.id !== id));
      queueMutation({ type: 'delete', id });
      return;
    }
    try {
      await deleteExpense(id);
      setExpenses(expenses.filter(exp => exp.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Responsive styles
  const mobile = isMobile();

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 4px 24px 0 rgba(60,72,88,0.10)',
      padding: mobile ? '1.2rem 0.5rem' : '2rem 2.5rem',
      margin: mobile ? '12px 0' : '32px 0',
      maxWidth: '100vw',
      width: '100%',
      boxSizing: 'border-box',
      marginLeft: 'auto',
      marginRight: 'auto',
    }}>
      {syncing && <div style={{ background: '#e3f2fd', color: '#1565c0', padding: '4px 0', textAlign: 'center', fontWeight: 600, borderRadius: 6, marginBottom: 10 }}>Syncing offline changes...</div>}
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '8px 12px', fontSize: 15, textAlign: 'center', marginBottom: 10, fontWeight: 500 }}>{error}</div>}
      {/* Add Expense Form */}
      <form
        className="expense-add-row"
        onSubmit={handleAdd}
        style={{
          display: 'flex',
          flexDirection: mobile ? 'column' : 'row',
          gap: mobile ? 10 : 16,
          alignItems: mobile ? 'stretch' : 'flex-end',
          marginBottom: 18,
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 10 : 8 }}>
          <input
            type="date"
            value={newExpense.date || ''}
            onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
            required
            style={{ flex: 1, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
          />
          <input
            type="text"
            placeholder="Name"
            value={newExpense.item_name || ''}
            onChange={e => setNewExpense({ ...newExpense, item_name: e.target.value })}
            required
            style={{ flex: 2, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 10 : 8 }}>
          <input
            type="number"
            placeholder="Price"
            value={newExpense.amount || ''}
            onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
            required
            min="0"
            step="0.01"
            style={{ flex: 1, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
          />
          <select
            value={newExpense.category_id || ''}
            onChange={e => setNewExpense({ ...newExpense, category_id: e.target.value })}
            required
            style={{ flex: 1, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
          >
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 2, display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 10 : 8 }}>
          <input
            type="text"
            placeholder="Notes"
            value={newExpense.notes || ''}
            onChange={e => setNewExpense({ ...newExpense, notes: e.target.value })}
            style={{ flex: 2, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 15 }}>
            <input
              type="checkbox"
              checked={!!newExpense.is_recurring}
              onChange={e => setNewExpense({ ...newExpense, is_recurring: e.target.checked })}
              style={{ margin: 0 }}
            />
            Recurring
          </label>
          <button
            type="submit"
            style={{
              background: 'linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '10px 0',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              minWidth: 70,
              width: mobile ? '100%' : undefined,
              boxShadow: '0 2px 8px 0 rgba(60,72,88,0.08)',
              transition: 'background 0.2s',
            }}
          >Add</button>
        </div>
      </form>
      {/* Responsive Table */}
      <div style={{ overflowX: 'auto', width: '100%', maxWidth: '100vw', boxSizing: 'border-box' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: mobile ? undefined : 600, boxSizing: 'border-box' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ padding: '10px 6px', fontWeight: 700, fontSize: 15, textAlign: 'left', whiteSpace: 'nowrap' }}>Date</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, fontSize: 15, textAlign: 'left', whiteSpace: 'nowrap' }}>Item</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, fontSize: 15, textAlign: 'left', whiteSpace: 'nowrap' }}>Amount</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, fontSize: 15, textAlign: 'left', whiteSpace: 'nowrap' }}>Category</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, fontSize: 15, textAlign: 'left', whiteSpace: 'nowrap' }}>Notes</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, fontSize: 15, textAlign: 'left', whiteSpace: 'nowrap' }}>Recurring</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, fontSize: 15, textAlign: 'left', whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(exp => (
              editingId === exp.id ? (
                <tr key={exp.id} style={{ background: '#f8fafc' }}>
                  {/* default date is today */}
                  <td><input type="date" value={editExpense.date || new Date().toISOString().slice(0, 10)} onChange={e => handleEditChange('date', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} /></td>
                  <td><input type="text" value={editExpense.item_name || ''} onChange={e => handleEditChange('item_name', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} /></td>
                  <td><input type="number" value={editExpense.amount || ''} onChange={e => handleEditChange('amount', Number(e.target.value))} min="0" step="0.01" style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} /></td>
                  <td>
                    <select value={editExpense.category_id || ''} onChange={e => handleEditChange('category_id', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </td>
                  <td><input type="text" value={editExpense.notes || ''} onChange={e => handleEditChange('notes', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} /></td>
                  <td><input type="checkbox" checked={!!editExpense.is_recurring} onChange={e => handleEditChange('is_recurring', !editExpense.is_recurring)} /></td>
                  <td>
                    <button onClick={() => handleEditSave(exp.id)} style={{ marginRight: 6, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={exp.id}>
                  <td>{exp.date}</td>
                  <td>{exp.item_name}</td>
                  <td>{exp.amount.toFixed(2)}</td>
                  <td>{categories.find(cat => cat.id === exp.category_id)?.name || '—'}</td>
                  <td>{exp.notes}</td>
                  <td>{exp.is_recurring ? 'Yes' : 'No'}</td>
                  <td>
                    <button onClick={() => handleEdit(exp)} style={{ marginRight: 6, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => handleDelete(exp.id)} style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpenseTable; 