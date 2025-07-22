import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { ShoppingListItem, Category } from '../types';
import {
  getShoppingListByHousehold,
  addShoppingListItem,
  updateShoppingListItem,
  deleteShoppingListItem
} from '../services/shoppingListService';
import { getCategoriesByHousehold } from '../services/categoryService';
import { addExpense } from '../services/expenseService';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../services/supabaseClient';
import { getCache, setCache } from '../utils/cacheManager';

const ShoppingList: React.FC = () => {
  const { household } = useHousehold();
  const { user } = useAuth();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<{ name: string; category_id: string }>({ name: '', category_id: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<{ name: string; category_id: string }>({ name: '', category_id: '' });
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
    const cacheKey = `shopping_${household.id}`;
    const fetchData = async () => {
      if (!isOnline) {
        const cached = await getCache<ShoppingListItem[]>(cacheKey);
        if (!ignore && cached) setItems(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      Promise.all([
        getShoppingListByHousehold(household.id),
        getCategoriesByHousehold(household.id)
      ])
        .then(async ([items, categories]) => {
          if (!ignore) {
            setItems(items);
            setCategories(categories);
            setLoading(false);
            await setCache(cacheKey, items);
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
    const channel = supabase.channel('shopping-list-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_list',
          filter: `household_id=eq.${household.id}`,
        },
        payload => {
          if (payload.eventType === 'INSERT') {
            setItems(prev => [...prev, payload.new as ShoppingListItem]);
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(i => i.id === payload.new.id ? payload.new as ShoppingListItem : i));
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== payload.old.id));
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
    const key = `shopping_mutations_${household.id}`;
    const raw = localStorage.getItem(key);
    if (raw) setQueuedMutations(JSON.parse(raw));
    else setQueuedMutations([]);
  }, [household]);

  // Sync queued mutations when back online
  useEffect(() => {
    if (!household || !isOnline || queuedMutations.length === 0) return;
    const key = `shopping_mutations_${household.id}`;
    const sync = async () => {
      setSyncing(true);
      for (const m of queuedMutations) {
        try {
          if (m.type === 'add') await addShoppingListItem(m.data);
          if (m.type === 'update') await updateShoppingListItem(m.id, m.data);
          if (m.type === 'delete') await deleteShoppingListItem(m.id);
          if (m.type === 'purchase') await updateShoppingListItem(m.id, m.data);
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
    const key = `shopping_mutations_${household.id}`;
    const updated = [...queuedMutations, mutation];
    setQueuedMutations(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !user || !newItem.name.trim()) return;
    const itemData = {
      household_id: household.id,
      item_name: newItem.name.trim(),
      category_id: newItem.category_id || undefined,
      added_by: user.id,
      is_purchased: false,
    } as any;
    if (!isOnline) {
      setItems([...items, itemData]);
      queueMutation({ type: 'add', data: itemData });
      setNewItem({ name: '', category_id: '' });
      return;
    }
    try {
      const item = await addShoppingListItem(itemData);
      setItems([...items, item]);
      setNewItem({ name: '', category_id: '' });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEdit = (item: ShoppingListItem) => {
    setEditingId(item.id);
    setEditItem({ name: item.item_name, category_id: item.category_id || '' });
  };

  const handleEditSave = async (id: string) => {
    if (!isOnline) {
      setItems(items.map(i => (i.id === id ? { ...i, item_name: editItem.name, category_id: editItem.category_id || undefined } : i)));
      queueMutation({ type: 'update', id, data: { item_name: editItem.name, category_id: editItem.category_id || undefined } });
      setEditingId(null);
      setEditItem({ name: '', category_id: '' });
      return;
    }
    try {
      const updated = await updateShoppingListItem(id, {
        item_name: editItem.name,
        category_id: editItem.category_id || undefined,
      });
      setItems(items.map(i => (i.id === id ? updated : i)));
      setEditingId(null);
      setEditItem({ name: '', category_id: '' });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this shopping item?')) return;
    if (!isOnline) {
      setItems(items.filter(i => i.id !== id));
      queueMutation({ type: 'delete', id });
      return;
    }
    try {
      await deleteShoppingListItem(id);
      setItems(items.filter(i => i.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handlePurchase = async (item: ShoppingListItem) => {
    if (!household || !user) return;
    const shouldConvert = window.confirm('Mark as purchased and log as expense?');
    const purchaseData = {
      is_purchased: true,
      purchased_at: new Date().toISOString(),
    };
    if (!isOnline) {
      setItems(items.map(i => (i.id === item.id ? { ...i, ...purchaseData } : i)));
      queueMutation({ type: 'purchase', id: item.id, data: purchaseData });
      return;
    }
    try {
      const updated = await updateShoppingListItem(item.id, purchaseData);
      setItems(items.map(i => (i.id === item.id ? updated : i)));
      if (shouldConvert) {
        const amount = Number(prompt('Enter amount for this expense:', ''));
        if (!isNaN(amount) && amount > 0) {
          await addExpense({
            household_id: household.id,
            date: new Date().toISOString().slice(0, 10),
            item_name: item.item_name,
            amount,
            category_id: item.category_id || categories[0]?.id || '',
            notes: 'From shopping list',
            is_recurring: false,
            created_by: user.id,
          } as any);
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <div>Loading shopping list...</div>;
  if (error) return <div className="shopping-error">{error}</div>;

  return (
    <div className="shopping-list">
      {syncing && <div style={{ background: '#e3f2fd', color: '#1565c0', padding: '4px 0', textAlign: 'center', fontWeight: 600 }}>Syncing offline changes...</div>}
      <h3>Shopping List</h3>
      <form onSubmit={handleAdd} className="shopping-add-form">
        <input
          type="text"
          placeholder="Item name"
          value={newItem.name}
          onChange={e => setNewItem({ ...newItem, name: e.target.value })}
          required
        />
        <select
          value={newItem.category_id}
          onChange={e => setNewItem({ ...newItem, category_id: e.target.value })}
        >
          <option value="">Category</option>
          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
        <button type="submit">Add</button>
      </form>
      <ul className="shopping-list-items">
        {items.filter(i => !i.is_purchased).map(item => (
          <li key={item.id}>
            {editingId === item.id ? (
              <>
                <input
                  type="text"
                  value={editItem.name}
                  onChange={e => setEditItem({ ...editItem, name: e.target.value })}
                  required
                />
                <select
                  value={editItem.category_id}
                  onChange={e => setEditItem({ ...editItem, category_id: e.target.value })}
                >
                  <option value="">Category</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                <button onClick={() => handleEditSave(item.id)}>Save</button>
                <button onClick={() => setEditingId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span>{item.item_name}</span>
                {item.category_id && (
                  <span className="shopping-category">({categories.find(cat => cat.id === item.category_id)?.name})</span>
                )}
                <button onClick={() => handleEdit(item)}>Edit</button>
                <button onClick={() => handleDelete(item.id)}>Delete</button>
                <button onClick={() => handlePurchase(item)}>Purchased</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <h4>Purchased Items</h4>
      <ul className="shopping-list-purchased">
        {items.filter(i => i.is_purchased).map(item => (
          <li key={item.id}>
            <span>{item.item_name}</span>
            {item.category_id && (
              <span className="shopping-category">({categories.find(cat => cat.id === item.category_id)?.name})</span>
            )}
            <span className="shopping-date">{item.purchased_at?.slice(0, 10)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ShoppingList; 