import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { Category } from '../types';
import { getCategoriesByHousehold, addCategory, updateCategory, deleteCategory } from '../services/categoryService';
import supabase from '../services/supabaseClient';
import { getCache, setCache } from '../utils/cacheManager';
import { validateCategoryName } from '../utils/validation';
import styles from './ManagePanel.module.css';

const CategoryManager: React.FC = () => {
  const { household } = useHousehold();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [queuedMutations, setQueuedMutations] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [validationError, setValidationError] = useState<string | null>(null);

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
    const cacheKey = `categories_${household.id}`;
    const fetchData = async () => {
      if (!isOnline) {
        const cached = await getCache<Category[]>(cacheKey);
        if (!ignore && cached) setCategories(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      getCategoriesByHousehold(household.id)
        .then(async cats => {
          if (!ignore) {
            setCategories(cats);
            setLoading(false);
            await setCache(cacheKey, cats);
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
    const channel = supabase.channel('categories-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `household_id=eq.${household.id}`,
        },
        payload => {
          if (payload.eventType === 'INSERT') {
            setCategories(prev => [...prev, payload.new as Category]);
          } else if (payload.eventType === 'UPDATE') {
            setCategories(prev => prev.map(c => c.id === payload.new.id ? payload.new as Category : c));
          } else if (payload.eventType === 'DELETE') {
            setCategories(prev => prev.filter(c => c.id !== payload.old.id));
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
    const key = `category_mutations_${household.id}`;
    const raw = localStorage.getItem(key);
    if (raw) setQueuedMutations(JSON.parse(raw));
    else setQueuedMutations([]);
  }, [household]);

  // Sync queued mutations when back online
  useEffect(() => {
    if (!household || !isOnline || queuedMutations.length === 0) return;
    const key = `category_mutations_${household.id}`;
    const sync = async () => {
      setSyncing(true);
      for (const m of queuedMutations) {
        try {
          if (m.type === 'add') await addCategory(m.data);
          if (m.type === 'update') await updateCategory(m.id, m.data);
          if (m.type === 'delete') await deleteCategory(m.id);
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
    const key = `category_mutations_${household.id}`;
    const updated = [...queuedMutations, mutation];
    setQueuedMutations(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household) return;
    
    const validation = validateCategoryName(newCategory);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid category name');
      return;
    }
    
    setValidationError(null);
    setError(null);
    
    const catData = {
      household_id: household.id,
      name: newCategory.trim(),
      type: 'custom' as const,
    };
    if (!isOnline) {
      setCategories([...categories, catData as Category]);
      queueMutation({ type: 'add', data: catData });
      setNewCategory('');
      return;
    }
    try {
      const cat = await addCategory(catData);
      setCategories([...categories, cat]);
      setNewCategory('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const handleEditSave = async (id: string) => {
    const validation = validateCategoryName(editName);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid category name');
      return;
    }
    
    setValidationError(null);
    setError(null);
    
    if (!isOnline) {
      setCategories(categories.map(cat => (cat.id === id ? { ...cat, name: editName } : cat)));
      queueMutation({ type: 'update', id, data: { name: editName } });
      setEditingId(null);
      setEditName('');
      return;
    }
    try {
      const updated = await updateCategory(id, { name: editName });
      setCategories(categories.map(cat => (cat.id === id ? updated : cat)));
      setEditingId(null);
      setEditName('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this category? Expenses in this category will need to be reassigned.')) return;
    if (!isOnline) {
      setCategories(categories.filter(cat => cat.id !== id));
      queueMutation({ type: 'delete', id });
      return;
    }
    try {
      await deleteCategory(id);
      setCategories(categories.filter(cat => cat.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <div className={styles.hint}>Loading categories…</div>;

  return (
    <div className={styles.panel}>
      <p className={styles.hint}>Organize spending. Default categories can’t be deleted.</p>
      {syncing && <p className={styles.hint}>Syncing offline changes…</p>}
      {(error || validationError) && (
        <div className={styles.error}>{error || validationError}</div>
      )}
      <form onSubmit={handleAdd} className={styles.form}>
        <input
          type="text"
          placeholder="New category name"
          value={newCategory}
          onChange={e => {
            setNewCategory(e.target.value);
            if (validationError) setValidationError(null);
          }}
          required
          className={styles.input}
        />
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
          Add
        </button>
      </form>
      {categories.length === 0 ? (
        <div className={styles.empty}>No categories yet.</div>
      ) : (
        <div className={styles.stack}>
          {categories.map(cat => (
            <div key={cat.id} className={styles.row}>
              {editingId === cat.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => {
                      setEditName(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    required
                    className={styles.input}
                  />
                  <div className={styles.actions}>
                    <button type="button" onClick={() => handleEditSave(cat.id)} className={`${styles.btn} ${styles.btnPrimary}`}>Save</button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditName('');
                        setValidationError(null);
                      }}
                      className={`${styles.btn} ${styles.btnSecondary}`}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className={styles.label}>
                    {cat.name}
                    {cat.type === 'default' && (
                      <span className={styles.meta}> · default</span>
                    )}
                  </span>
                  {cat.type === 'custom' && (
                    <div className={styles.actions}>
                      <button type="button" onClick={() => handleEdit(cat)} className={`${styles.btn} ${styles.btnPrimary}`}>Rename</button>
                      <button type="button" onClick={() => handleDelete(cat.id)} className={`${styles.btn} ${styles.btnDanger}`}>Delete</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryManager; 