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
import styles from './ManagePanel.module.css';

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

  if (loading) return <div className={styles.hint}>Loading recurring payments…</div>;

  return (
    <div className={styles.panel}>
      <p className={styles.hint}>Subscriptions and repeating bills for this household.</p>
      {syncing && <p className={styles.hint}>Syncing offline changes…</p>}
      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleAdd} className={styles.form}>
        <input
          className={styles.input}
          type="text"
          placeholder="Description"
          value={newPayment.description || ''}
          onChange={e => setNewPayment({ ...newPayment, description: e.target.value })}
          required
        />
        <input
          className={styles.input}
          type="number"
          placeholder="Amount"
          value={newPayment.amount || ''}
          onChange={e => setNewPayment({ ...newPayment, amount: Number(e.target.value) })}
          min="0"
          step="0.01"
          required
        />
        <select
          className={styles.select}
          value={newPayment.category_id || ''}
          onChange={e => setNewPayment({ ...newPayment, category_id: e.target.value })}
          required
        >
          <option value="">Category</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <select
          className={styles.select}
          value={newPayment.frequency || 'monthly'}
          onChange={e => setNewPayment({ ...newPayment, frequency: e.target.value as any })}
          required
        >
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
          <option value="custom">Custom</option>
        </select>
        <input
          className={styles.input}
          type="date"
          value={newPayment.next_due || ''}
          onChange={e => setNewPayment({ ...newPayment, next_due: e.target.value })}
          required
        />
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>Add</button>
      </form>

      {payments.length === 0 ? (
        <div className={styles.empty}>No recurring payments yet.</div>
      ) : (
        <div className={styles.stack}>
          {payments.map(payment => (
            <div key={payment.id} className={styles.row}>
              {editingId === payment.id ? (
                <>
                  <input
                    className={styles.input}
                    value={editPayment.description || ''}
                    onChange={e => handleEditChange('description', e.target.value)}
                  />
                  <input
                    className={styles.input}
                    type="number"
                    value={editPayment.amount || ''}
                    onChange={e => handleEditChange('amount', Number(e.target.value))}
                    min="0"
                    step="0.01"
                  />
                  <select
                    className={styles.select}
                    value={editPayment.category_id || ''}
                    onChange={e => handleEditChange('category_id', e.target.value)}
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <select
                    className={styles.select}
                    value={editPayment.frequency || 'monthly'}
                    onChange={e => handleEditChange('frequency', e.target.value)}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="custom">Custom</option>
                  </select>
                  <input
                    className={styles.input}
                    type="date"
                    value={editPayment.next_due || ''}
                    onChange={e => handleEditChange('next_due', e.target.value)}
                  />
                  <select
                    className={styles.select}
                    value={editPayment.status || 'active'}
                    onChange={e => handleEditChange('status', e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <div className={styles.actions}>
                    <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => handleEditSave(payment.id)}>Save</button>
                    <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div className={styles.label}>{payment.description}</div>
                    <div className={styles.meta}>
                      ${Number(payment.amount).toFixed(2)} · {payment.frequency} · due {payment.next_due} · {payment.status}
                      {' · '}
                      {categories.find(cat => cat.id === payment.category_id)?.name || '—'}
                    </div>
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => handleEdit(payment)}>Edit</button>
                    <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDelete(payment.id)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecurringPayments; 