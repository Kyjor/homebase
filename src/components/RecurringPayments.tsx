import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { RecurringPayment, Category } from '../types';
import {
  getRecurringPaymentsByHousehold,
  addRecurringPayment,
  updateRecurringPayment,
  deleteRecurringPayment
} from '../services/recurringPaymentService';
import { getCategoriesByHousehold } from '../services/categoryService';
import { getCache, setCache } from '../utils/cacheManager';

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 700;

const RecurringPayments: React.FC = () => {
  const { household } = useHousehold();
  const [payments, setPayments] = useState<RecurringPayment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPayment, setNewPayment] = useState<Partial<RecurringPayment>>({ description: '', amount: 0, category_id: '', frequency: 'monthly', next_due: '', status: 'active' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPayment, setEditPayment] = useState<Partial<RecurringPayment>>({});
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
    const cacheKey = `recurring_${household.id}`;
    const fetchData = async () => {
      if (!isOnline) {
        const cached = await getCache<RecurringPayment[]>(cacheKey);
        if (!ignore && cached) setPayments(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      Promise.all([
        getRecurringPaymentsByHousehold(household.id),
        getCategoriesByHousehold(household.id)
      ])
        .then(async ([payments, categories]) => {
          if (!ignore) {
            setPayments(payments);
            setCategories(categories);
            setLoading(false);
            await setCache(cacheKey, payments);
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
  }, [household, isOnline]);

  // Load queued mutations from localStorage
  useEffect(() => {
    if (!household) return;
    const key = `recurring_mutations_${household.id}`;
    const raw = localStorage.getItem(key);
    if (raw) setQueuedMutations(JSON.parse(raw));
    else setQueuedMutations([]);
  }, [household]);

  // Sync queued mutations when back online
  useEffect(() => {
    if (!household || !isOnline || queuedMutations.length === 0) return;
    const key = `recurring_mutations_${household.id}`;
    const sync = async () => {
      setSyncing(true);
      for (const m of queuedMutations) {
        try {
          if (m.type === 'add') await addRecurringPayment(m.data);
          if (m.type === 'update') await updateRecurringPayment(m.id, m.data);
          if (m.type === 'delete') await deleteRecurringPayment(m.id);
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
    const key = `recurring_mutations_${household.id}`;
    const updated = [...queuedMutations, mutation];
    setQueuedMutations(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !newPayment.description || !newPayment.amount || !newPayment.category_id || !newPayment.frequency || !newPayment.next_due) return;
    const paymentData = {
      household_id: household.id,
      description: newPayment.description,
      amount: Number(newPayment.amount),
      category_id: newPayment.category_id,
      frequency: newPayment.frequency,
      next_due: newPayment.next_due,
      status: 'active' as const,
    };
    if (!isOnline) {
      setPayments([...payments, paymentData as RecurringPayment]);
      queueMutation({ type: 'add', data: paymentData });
      setNewPayment({ description: '', amount: 0, category_id: '', frequency: 'monthly', next_due: '', status: 'active' });
      return;
    }
    try {
      const payment = await addRecurringPayment(paymentData);
      setPayments([...payments, payment]);
      setNewPayment({ description: '', amount: 0, category_id: '', frequency: 'monthly', next_due: '', status: 'active' });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEdit = (payment: RecurringPayment) => {
    setEditingId(payment.id);
    setEditPayment({ ...payment });
  };

  const handleEditChange = (field: keyof RecurringPayment, value: any) => {
    setEditPayment(prev => ({ ...prev, [field]: value }));
  };

  const handleEditSave = async (id: string) => {
    if (!isOnline) {
      setPayments(payments.map(p => (p.id === id ? { ...p, ...editPayment } : p)));
      queueMutation({ type: 'update', id, data: editPayment });
      setEditingId(null);
      setEditPayment({});
      return;
    }
    try {
      const updated = await updateRecurringPayment(id, editPayment);
      setPayments(payments.map(p => (p.id === id ? updated : p)));
      setEditingId(null);
      setEditPayment({});
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this recurring payment?')) return;
    if (!isOnline) {
      setPayments(payments.filter(p => p.id !== id));
      queueMutation({ type: 'delete', id });
      return;
    }
    try {
      await deleteRecurringPayment(id);
      setPayments(payments.filter(p => p.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <div>Loading recurring payments...</div>;
  if (error) return <div className="recurring-error">{error}</div>;

  const mobile = isMobile();

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 2px 12px 0 rgba(60,72,88,0.08)',
      padding: mobile ? '1rem 0.5rem' : '1.5rem 1.5rem',
      margin: mobile ? '10px 0' : '18px 0',
      maxWidth: 520,
      width: '100%',
      boxSizing: 'border-box',
      marginLeft: 'auto',
      marginRight: 'auto',
    }}>
      <h3 style={{ fontWeight: 700, fontSize: mobile ? 18 : 22, color: '#2d3748', marginBottom: 10, textAlign: 'center' }}>Recurring Payments</h3>
      {syncing && <div style={{ background: '#e3f2fd', color: '#1565c0', padding: '4px 0', textAlign: 'center', fontWeight: 600, borderRadius: 6, marginBottom: 10 }}>Syncing offline changes...</div>}
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '8px 12px', fontSize: 15, textAlign: 'center', marginBottom: 10, fontWeight: 500 }}>{error}</div>}
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 10 : 8, marginBottom: 16, alignItems: mobile ? 'stretch' : 'flex-end' }}>
        <input
          type="text"
          placeholder="Description"
          value={newPayment.description || ''}
          onChange={e => setNewPayment({ ...newPayment, description: e.target.value })}
          required
          style={{ flex: 2, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
        />
        <input
          type="number"
          placeholder="Amount"
          value={newPayment.amount || ''}
          onChange={e => setNewPayment({ ...newPayment, amount: Number(e.target.value) })}
          min="0"
          step="0.01"
          required
          style={{ flex: 1, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
        />
        <select
          value={newPayment.category_id || ''}
          onChange={e => setNewPayment({ ...newPayment, category_id: e.target.value })}
          required
          style={{ flex: 1, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
        >
          <option value="">Category</option>
          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
        <select
          value={newPayment.frequency || 'monthly'}
          onChange={e => setNewPayment({ ...newPayment, frequency: e.target.value as any })}
          required
          style={{ flex: 1, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
        >
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
          <option value="custom">Custom</option>
        </select>
        <input
          type="date"
          value={newPayment.next_due || ''}
          onChange={e => setNewPayment({ ...newPayment, next_due: e.target.value })}
          required
          style={{ flex: 1, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
        />
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
      </form>
      <div style={{ overflowX: 'auto', width: '100%', maxWidth: '100vw', boxSizing: 'border-box' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, minWidth: mobile ? undefined : 600, boxSizing: 'border-box' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'left', fontSize: 15 }}>Description</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'left', fontSize: 15 }}>Amount</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'left', fontSize: 15 }}>Category</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'left', fontSize: 15 }}>Frequency</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'left', fontSize: 15 }}>Next Due</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'left', fontSize: 15 }}>Status</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'left', fontSize: 15 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(payment => (
              editingId === payment.id ? (
                <tr key={payment.id} style={{ background: '#f8fafc' }}>
                  <td><input type="text" value={editPayment.description || ''} onChange={e => handleEditChange('description', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} /></td>
                  <td><input type="number" value={editPayment.amount || ''} onChange={e => handleEditChange('amount', Number(e.target.value))} min="0" step="0.01" style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} /></td>
                  <td>
                    <select value={editPayment.category_id || ''} onChange={e => handleEditChange('category_id', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={editPayment.frequency || 'monthly'} onChange={e => handleEditChange('frequency', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </td>
                  <td><input type="date" value={editPayment.next_due || ''} onChange={e => handleEditChange('next_due', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} /></td>
                  <td>
                    <select value={editPayment.status || 'active'} onChange={e => handleEditChange('status', e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>
                    <button onClick={() => handleEditSave(payment.id)} style={{ marginRight: 6, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={payment.id}>
                  <td>{payment.description}</td>
                  <td>{payment.amount.toFixed(2)}</td>
                  <td>{categories.find(cat => cat.id === payment.category_id)?.name || '—'}</td>
                  <td>{payment.frequency}</td>
                  <td>{payment.next_due}</td>
                  <td>{payment.status}</td>
                  <td>
                    <button onClick={() => handleEdit(payment)} style={{ marginRight: 6, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => handleDelete(payment.id)} style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
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

export default RecurringPayments; 