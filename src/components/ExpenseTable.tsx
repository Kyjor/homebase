import React, { useEffect, useState, useMemo } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { Expense, Category } from '../types';
import { getExpensesByHousehold, addExpense, updateExpense, deleteExpense } from '../services/expenseService';
import { getCategoriesByHousehold } from '../services/categoryService';
import supabase from '../services/supabaseClient';
import { getCache, setCache } from '../utils/cacheManager';
import { useAuth } from '../contexts/AuthContext';
import { isMobile } from '../styles/theme';
import { validateAmount, validateItemName, validateDate } from '../utils/validation';
import styles from './ExpenseTable.module.css';

const ITEMS_PER_PAGE = 20;

const ExpenseTable: React.FC = () => {
  const { household } = useHousehold();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({ date: '', item_name: '', amount: 0, category_id: '', notes: '', is_recurring: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<Partial<Expense>>({});
  const [syncing, setSyncing] = useState(false);
  const [queuedMutations, setQueuedMutations] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentPage, setCurrentPage] = useState(1);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
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
        return;
      }
      Promise.all([
        getExpensesByHousehold(household.id),
        getCategoriesByHousehold(household.id)
      ])
        .then(async ([expenses, categories]) => {
          if (!ignore) {
            setExpenses(expenses);
            setCategories(categories);
            await setCache(cacheKey, expenses);
          }
        })
        .catch(e => {
          if (!ignore) {
            setError(e.message);
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
    if (!household || !user) return;

    const errors: { [key: string]: string } = {};
    const itemNameValidation = validateItemName(newExpense.item_name || '');
    if (!itemNameValidation.isValid) {
      errors.item_name = itemNameValidation.error || '';
    }

    const amountValidation = validateAmount(newExpense.amount || 0);
    if (!amountValidation.isValid) {
      errors.amount = amountValidation.error || '';
    }

    const dateValidation = validateDate(newExpense.date || new Date().toISOString().slice(0, 10));
    if (!dateValidation.isValid) {
      errors.date = dateValidation.error || '';
    }

    if (!newExpense.category_id) {
      errors.category_id = 'Category is required';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setError(null);

    const expenseData = {
      ...newExpense,
      household_id: household.id,
      created_by: user.id,
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
      setCurrentPage(1);
      return;
    }
    try {
      const expense = await addExpense(expenseData);
      setExpenses([expense, ...expenses]);
      setNewExpense({ date: '', item_name: '', amount: 0, category_id: '', notes: '', is_recurring: false });
      setCurrentPage(1);
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
    const errors: { [key: string]: string } = {};
    const itemNameValidation = validateItemName(editExpense.item_name || '');
    if (!itemNameValidation.isValid) {
      errors.item_name = itemNameValidation.error || '';
    }

    const amountValidation = validateAmount(editExpense.amount || 0);
    if (!amountValidation.isValid) {
      errors.amount = amountValidation.error || '';
    }

    const dateValidation = validateDate(editExpense.date || new Date().toISOString().slice(0, 10));
    if (!dateValidation.isValid) {
      errors.date = dateValidation.error || '';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setError(null);

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

  const mobile = isMobile();

  // Pagination logic
  const totalPages = Math.ceil(expenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return expenses.slice(start, end);
  }, [expenses, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  return (
    <div className={`${styles.container} ${mobile ? styles.containerMobile : ''}`}>
      {syncing && <div className={styles.syncingMessage}>Syncing offline changes...</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}
      {Object.keys(validationErrors).length > 0 && (
        <div className={styles.errorMessage}>
          {Object.values(validationErrors).join(', ')}
        </div>
      )}
      {/* Add Expense Form */}
      <form
        onSubmit={handleAdd}
        className={`${styles.form} ${mobile ? styles.formMobile : ''}`}
      >
        <div className={`${styles.formGroup} ${mobile ? styles.formGroupMobile : ''}`}>
          <input
            type="date"
            value={newExpense.date || ''}
            onChange={e => {
              setNewExpense({ ...newExpense, date: e.target.value });
              if (validationErrors.date) {
                setValidationErrors({ ...validationErrors, date: '' });
              }
            }}
            required
            className={`${styles.input} ${styles.inputDate}`}
          />
          <input
            type="text"
            placeholder="Name"
            value={newExpense.item_name || ''}
            onChange={e => {
              setNewExpense({ ...newExpense, item_name: e.target.value });
              if (validationErrors.item_name) {
                setValidationErrors({ ...validationErrors, item_name: '' });
              }
            }}
            required
            className={`${styles.input} ${styles.inputName}`}
          />
        </div>
        <div className={`${styles.formGroup} ${mobile ? styles.formGroupMobile : ''}`}>
          <input
            type="number"
            placeholder="Price"
            value={newExpense.amount || ''}
            onChange={e => {
              setNewExpense({ ...newExpense, amount: Number(e.target.value) });
              if (validationErrors.amount) {
                setValidationErrors({ ...validationErrors, amount: '' });
              }
            }}
            required
            min="0"
            step="0.01"
            className={`${styles.input} ${styles.inputAmount}`}
          />
          <select
            value={newExpense.category_id || ''}
            onChange={e => {
              setNewExpense({ ...newExpense, category_id: e.target.value });
              if (validationErrors.category_id) {
                setValidationErrors({ ...validationErrors, category_id: '' });
              }
            }}
            required
            className={styles.select}
          >
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </div>
        <div className={`${styles.formGroup} ${styles.formGroupLarge} ${mobile ? styles.formGroupMobile : ''}`}>
          <input
            type="text"
            placeholder="Notes"
            value={newExpense.notes || ''}
            onChange={e => setNewExpense({ ...newExpense, notes: e.target.value })}
            className={`${styles.input} ${styles.inputNotes}`}
          />
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={!!newExpense.is_recurring}
              onChange={e => setNewExpense({ ...newExpense, is_recurring: e.target.checked })}
              className={styles.checkbox}
            />
            Recurring
          </label>
          <button
            type="submit"
            className={`${styles.submitButton} ${mobile ? styles.submitButtonMobile : ''}`}
          >Add</button>
        </div>
      </form>
      {/* Responsive Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.tableHeader}>
            <tr>
              <th className={styles.tableHeaderCell}>Date</th>
              <th className={styles.tableHeaderCell}>Item</th>
              <th className={styles.tableHeaderCell}>Amount</th>
              <th className={styles.tableHeaderCell}>Category</th>
              <th className={styles.tableHeaderCell}>Notes</th>
              <th className={styles.tableHeaderCell}>Recurring</th>
              <th className={styles.tableHeaderCell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedExpenses.map(exp => (
              editingId === exp.id ? (
                <tr key={exp.id} className={styles.tableRow}>
                  <td className={styles.tableCell}>
                    <input
                      type="date"
                      value={editExpense.date || new Date().toISOString().slice(0, 10)}
                      onChange={e => handleEditChange('date', e.target.value)}
                      className={styles.tableInput}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <input
                      type="text"
                      value={editExpense.item_name || ''}
                      onChange={e => handleEditChange('item_name', e.target.value)}
                      className={styles.tableInput}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <input
                      type="number"
                      value={editExpense.amount || ''}
                      onChange={e => handleEditChange('amount', Number(e.target.value))}
                      min="0"
                      step="0.01"
                      className={styles.tableInput}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <select
                      value={editExpense.category_id || ''}
                      onChange={e => handleEditChange('category_id', e.target.value)}
                      className={styles.tableInput}
                    >
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </td>
                  <td className={styles.tableCell}>
                    <input
                      type="text"
                      value={editExpense.notes || ''}
                      onChange={e => handleEditChange('notes', e.target.value)}
                      className={styles.tableInput}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <input
                      type="checkbox"
                      checked={!!editExpense.is_recurring}
                      onChange={() => handleEditChange('is_recurring', !editExpense.is_recurring)}
                    />
                  </td>
                  <td className={styles.tableCell}>
                    <button onClick={() => handleEditSave(exp.id)} className={`${styles.actionButton}`}>Save</button>
                    <button onClick={() => {
                      setEditingId(null);
                      setEditExpense({});
                      setValidationErrors({});
                    }} className={`${styles.actionButton} ${styles.actionButtonSecondary}`}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={exp.id}>
                  <td className={styles.tableCell}>{exp.date}</td>
                  <td className={styles.tableCell}>{exp.item_name}</td>
                  <td className={styles.tableCell}>${exp.amount.toFixed(2)}</td>
                  <td className={styles.tableCell}>{categories.find(cat => cat.id === exp.category_id)?.name || '—'}</td>
                  <td className={styles.tableCell}>{exp.notes}</td>
                  <td className={styles.tableCell}>{exp.is_recurring ? 'Yes' : 'No'}</td>
                  <td className={styles.tableCell}>
                    <button onClick={() => handleEdit(exp)} className={`${styles.actionButton}`}>Edit</button>
                    <button onClick={() => handleDelete(exp.id)} className={`${styles.actionButton} ${styles.actionButtonSecondary}`}>Delete</button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={styles.paginationButton}
          >
            Previous
          </button>
          <span className={styles.paginationInfo}>
            Page {currentPage} of {totalPages} ({expenses.length} total)
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={styles.paginationButton}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ExpenseTable; 