import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { Category } from '../types';
import { getCategoriesByHousehold, addCategory, updateCategory, deleteCategory } from '../services/categoryService';
import supabase from '../services/supabaseClient';
import { getCache, setCache } from '../utils/cacheManager';

const defaultCategoryNames = ['Groceries', 'Utilities', 'Entertainment', 'Household Items'];

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
    if (!household || !newCategory.trim()) return;
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

  if (loading) return <div>Loading categories...</div>;
  if (error) return <div className="category-error">{error}</div>;

  return (
    <div className="category-manager">
      {syncing && <div style={{ background: '#e3f2fd', color: '#1565c0', padding: '4px 0', textAlign: 'center', fontWeight: 600 }}>Syncing offline changes...</div>}
      <h3>Manage Categories</h3>
      <form onSubmit={handleAdd} className="category-add-form">
        <input
          type="text"
          placeholder="New category name"
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
          required
        />
        <button type="submit">Add</button>
      </form>
      <ul className="category-list">
        {categories.map(cat => (
          <li key={cat.id} className={cat.type === 'default' ? 'default-category' : 'custom-category'}>
            {editingId === cat.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required
                />
                <button onClick={() => handleEditSave(cat.id)}>Save</button>
                <button onClick={() => setEditingId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span>{cat.name}</span>
                {cat.type === 'custom' && (
                  <>
                    <button onClick={() => handleEdit(cat)}>Rename</button>
                    <button onClick={() => handleDelete(cat.id)}>Delete</button>
                  </>
                )}
                {cat.type === 'default' && <span className="default-label">(default)</span>}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CategoryManager; 