import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { Category } from '../types';
import { getCategoriesByHousehold, addCategory, updateCategory, deleteCategory } from '../services/categoryService';
import supabase from '../services/supabaseClient';
import { getCache, setCache } from '../utils/cacheManager';

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 700;

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

  const mobile = isMobile();

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 2px 12px 0 rgba(60,72,88,0.08)',
      padding: mobile ? '1rem 0.5rem' : '1.5rem 1.5rem',
      margin: mobile ? '10px 0' : '18px 0',
      maxWidth: 420,
      width: '100%',
      boxSizing: 'border-box',
      marginLeft: 'auto',
      marginRight: 'auto',
    }}>
      <h3 style={{ fontWeight: 700, fontSize: mobile ? 18 : 22, color: '#2d3748', marginBottom: 10, textAlign: 'center' }}>Categories</h3>
      {syncing && <div style={{ background: '#e3f2fd', color: '#1565c0', padding: '4px 0', textAlign: 'center', fontWeight: 600, borderRadius: 6, marginBottom: 10 }}>Syncing offline changes...</div>}
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '8px 12px', fontSize: 15, textAlign: 'center', marginBottom: 10, fontWeight: 500 }}>{error}</div>}
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 10 : 8, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="New category name"
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
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
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {categories.map(cat => (
          <li key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
            {editingId === cat.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required
                  style={{ flex: 1, minWidth: 0, width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
                />
                <button onClick={() => handleEditSave(cat.id)} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontWeight: 600, color: '#334155', fontSize: 15 }}>{cat.name}</span>
                {cat.type === 'custom' && (
                  <>
                    <button onClick={() => handleEdit(cat)} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', marginRight: 4 }}>Rename</button>
                    <button onClick={() => handleDelete(cat.id)} style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                  </>
                )}
                {cat.type === 'default' && <span style={{ color: '#64748b', fontSize: 14, marginLeft: 6 }}>(default)</span>}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CategoryManager; 