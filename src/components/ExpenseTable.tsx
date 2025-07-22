import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { Expense, Category } from '../types';
import { getExpensesByHousehold, addExpense, updateExpense, deleteExpense } from '../services/expenseService';
import { getCategoriesByHousehold } from '../services/categoryService';
import supabase from '../services/supabaseClient';
import { getCache, setCache } from '../utils/cacheManager';

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
      created_by: '', // Fill with user id if available
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

  if (loading) return <div>Loading expenses...</div>;
  if (error) return <div className="expense-error">{error}</div>;

  return (
    <div className="expense-table-container">
      {syncing && <div style={{ background: '#e3f2fd', color: '#1565c0', padding: '4px 0', textAlign: 'center', fontWeight: 600 }}>Syncing offline changes...</div>}
      <form className="expense-add-row" onSubmit={handleAdd}>
        <input type="date" value={newExpense.date || ''} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} required />
        <input type="text" placeholder="Item Name" value={newExpense.item_name || ''} onChange={e => setNewExpense({ ...newExpense, item_name: e.target.value })} required />
        <input type="number" placeholder="Amount" value={newExpense.amount || ''} onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })} required min="0" step="0.01" />
        <select value={newExpense.category_id || ''} onChange={e => setNewExpense({ ...newExpense, category_id: e.target.value })} required>
          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
        <input type="text" placeholder="Notes" value={newExpense.notes || ''} onChange={e => setNewExpense({ ...newExpense, notes: e.target.value })} />
        <input type="checkbox" checked={!!newExpense.is_recurring} onChange={e => setNewExpense({ ...newExpense, is_recurring: e.target.checked })} />
        <button type="submit">Add</button>
      </form>
      <table className="expense-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Item Name</th>
            <th>Amount</th>
            <th>Category</th>
            <th>Notes</th>
            <th>Recurring</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map(exp => (
            editingId === exp.id ? (
              <tr key={exp.id} className="editing-row">
                <td><input type="date" value={editExpense.date || ''} onChange={e => handleEditChange('date', e.target.value)} /></td>
                <td><input type="text" value={editExpense.item_name || ''} onChange={e => handleEditChange('item_name', e.target.value)} /></td>
                <td><input type="number" value={editExpense.amount || ''} onChange={e => handleEditChange('amount', Number(e.target.value))} min="0" step="0.01" /></td>
                <td>
                  <select value={editExpense.category_id || ''} onChange={e => handleEditChange('category_id', e.target.value)}>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </td>
                <td><input type="text" value={editExpense.notes || ''} onChange={e => handleEditChange('notes', e.target.value)} /></td>
                <td><input type="checkbox" checked={!!editExpense.is_recurring} onChange={e => handleEditChange('is_recurring', !editExpense.is_recurring)} /></td>
                <td>
                  <button onClick={() => handleEditSave(exp.id)}>Save</button>
                  <button onClick={() => setEditingId(null)}>Cancel</button>
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
                  <button onClick={() => handleEdit(exp)}>Edit</button>
                  <button onClick={() => handleDelete(exp.id)}>Delete</button>
                </td>
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ExpenseTable; 