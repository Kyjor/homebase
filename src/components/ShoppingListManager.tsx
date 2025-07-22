import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { getShoppingListsByHousehold, addShoppingList, updateShoppingList, deleteShoppingList, ShoppingList } from '../services/shoppingListsService';
import { Expense } from '../types';
import { getExpensesByHousehold, addExpense, updateExpense, deleteExpense } from '../services/expenseService';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../services/supabaseClient';

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 700;

const ShoppingListManager: React.FC = () => {
  const { household } = useHousehold();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);
  const mobile = isMobile();

  useEffect(() => {
    if (!household) return;
    setLoading(true);
    getShoppingListsByHousehold(household.id)
      .then(setLists)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [household]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !newListName.trim()) return;
    try {
      const list = await addShoppingList({ household_id: household.id, name: newListName.trim() });
      setLists([...lists, list]);
      setNewListName('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEdit = (list: ShoppingList) => {
    setEditingId(list.id);
    setEditName(list.name);
  };

  const handleEditSave = async (id: string) => {
    try {
      const updated = await updateShoppingList(id, { name: editName });
      setLists(lists.map(l => (l.id === id ? updated : l)));
      setEditingId(null);
      setEditName('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this shopping list and all its items?')) return;
    try {
      await deleteShoppingList(id);
      setLists(lists.filter(l => l.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (activeList) {
    return <ShoppingListPage list={activeList} onBack={() => setActiveList(null)} />;
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 4px 24px 0 rgba(60,72,88,0.10)',
      padding: mobile ? '1.2rem 0.5rem' : '2rem 2.5rem',
      margin: mobile ? '18px 0' : '32px 0',
      maxWidth: 520,
      width: '100%',
      boxSizing: 'border-box',
      marginLeft: 'auto',
      marginRight: 'auto',
    }}>
      <h2 style={{ fontWeight: 700, fontSize: mobile ? 22 : 26, color: '#2d3748', marginBottom: 10, textAlign: 'center' }}>Shopping Lists</h2>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '8px 12px', fontSize: 15, textAlign: 'center', marginBottom: 10, fontWeight: 500 }}>{error}</div>}
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 10 : 8, marginBottom: 18 }}>
        <input
          type="text"
          placeholder="New list name"
          value={newListName}
          onChange={e => setNewListName(e.target.value)}
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
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lists.map(list => (
          <li key={list.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
            {editingId === list.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required
                  style={{ flex: 1, minWidth: 0, width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
                />
                <button onClick={() => handleEditSave(list.id)} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditingId(null)} style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontWeight: 600, color: '#334155', fontSize: 16, cursor: 'pointer' }} onClick={() => setActiveList(list)}>{list.name}</span>
                <button onClick={() => handleEdit(list)} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', marginRight: 4 }}>Rename</button>
                <button onClick={() => handleDelete(list.id)} style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const ShoppingListPage: React.FC<{ list: ShoppingList; onBack: () => void }> = ({ list, onBack }) => {
  const { household } = useHousehold();
  const { user } = useAuth();
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<Expense & { is_purchased?: boolean; quantity?: number }>>({ item_name: '', amount: 0, category_id: '', notes: '', is_purchased: false, quantity: 1 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Partial<Expense & { is_purchased?: boolean }>>({});
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const mobile = isMobile();

  useEffect(() => {
    if (!household) return;
    setLoading(true);
    Promise.all([
      getExpensesByHousehold(household.id),
      import('../services/categoryService').then(m => m.getCategoriesByHousehold(household.id)),
    ])
      .then(([expenses, cats]) => {
        setItems(expenses.filter(e => e.shopping_list_id === list.id));
        setCategories(cats);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
    // Real-time subscription for this list
    const channel = supabase.channel(`shopping-list-items-${list.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `shopping_list_id=eq.${list.id}`,
        },
        payload => {
          if (payload.eventType === 'INSERT') {
            setItems(prev => [...prev, payload.new as Expense]);
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(i => i.id === payload.new.id ? payload.new as Expense : i));
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [household, list.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !user || !newItem.item_name?.trim()) return;
    const qty = Math.max(1, Number(newItem.quantity) || 1);
    const { quantity, ...expenseBase } = newItem; // Remove quantity from payload
    try {
      const promises = Array.from({ length: qty }).map(() =>
        addExpense({
          ...expenseBase,
          household_id: household.id,
          shopping_list_id: list.id,
          created_by: user.id,
          is_recurring: false,
          is_purchased: false,
          date: new Date().toISOString().slice(0, 10),
          amount: Number(newItem.amount) || 0,
          category_id: newItem.category_id || categories[0]?.id || '',
          item_name: newItem.item_name || '',
        } as any)
      );
      const results = await Promise.all(promises);
      setItems([...items, ...results]);
      setNewItem({ item_name: '', amount: 0, category_id: '', notes: '', is_purchased: false, quantity: 1 });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEdit = (item: Expense) => {
    setEditingId(item.id);
    setEditItem({ ...item });
  };

  const handleEditSave = async (id: string) => {
    try {
      const updated = await updateExpense(id, editItem);
      setItems(items.map(i => (i.id === id ? updated : i)));
      setEditingId(null);
      setEditItem({});
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await deleteExpense(id);
      setItems(items.filter(i => i.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handlePurchase = async (item: Expense) => {
    try {
      const updated = await updateExpense(item.id, { is_purchased: true });
      setItems(items.map(i => (i.id === item.id ? updated : i)));
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 4px 24px 0 rgba(60,72,88,0.10)',
      padding: mobile ? '1.2rem 0.5rem' : '2rem 2.5rem',
      margin: mobile ? '18px 0' : '32px 0',
      maxWidth: 520,
      width: '100%',
      boxSizing: 'border-box',
      marginLeft: 'auto',
      marginRight: 'auto',
      position: 'relative',
    }}>
      <button onClick={onBack} style={{ position: 'absolute', left: 12, top: 12, background: 'none', border: 'none', color: '#6366f1', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>← Back</button>
      <h2 style={{ fontWeight: 700, fontSize: mobile ? 22 : 26, color: '#2d3748', marginBottom: 10, textAlign: 'center' }}>{list.name}</h2>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '8px 12px', fontSize: 15, textAlign: 'center', marginBottom: 10, fontWeight: 500 }}>{error}</div>}
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 10 : 8, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Item name"
          value={newItem.item_name || ''}
          onChange={e => setNewItem({ ...newItem, item_name: e.target.value })}
          required
          style={{ flex: 2, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
        />
        <input
          type="number"
          placeholder="Amount"
          value={newItem.amount || ''}
          onChange={e => setNewItem({ ...newItem, amount: Number(e.target.value) })}
          min="0"
          step="0.01"
          required
          style={{ flex: 1, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
        />
        <input
          type="number"
          placeholder="Qty"
          value={newItem.quantity || 1}
          onChange={e => setNewItem({ ...newItem, quantity: Math.max(1, Number(e.target.value)) })}
          min="1"
          step="1"
          required
          style={{ flex: 1, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
        />
        <select
          value={newItem.category_id || ''}
          onChange={e => setNewItem({ ...newItem, category_id: e.target.value })}
          required
          style={{ flex: 1, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
        >
          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
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
              <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'left', fontSize: 15 }}>Item</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'left', fontSize: 15 }}>Amount</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'left', fontSize: 15 }}>Category</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'left', fontSize: 15 }}>Purchased</th>
              <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'left', fontSize: 15 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              editingId === item.id ? (
                <tr key={item.id} style={{ background: '#f8fafc' }}>
                  <td><input type="text" value={editItem.item_name || ''} onChange={e => setEditItem({ ...editItem, item_name: e.target.value })} style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} /></td>
                  <td><input type="number" value={editItem.amount || ''} onChange={e => setEditItem({ ...editItem, amount: Number(e.target.value) })} min="0" step="0.01" style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }} /></td>
                  <td>
                    <select value={editItem.category_id || ''} onChange={e => setEditItem({ ...editItem, category_id: e.target.value })} style={{ width: '100%', padding: '6px', borderRadius: 5, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </td>
                  <td>{!!item.is_purchased ? 'Yes' : 'No'}</td>
                  <td>
                    <button onClick={() => handleEditSave(item.id)} style={{ marginRight: 6, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={item.id}>
                  <td>{item.item_name}</td>
                  <td>{item.amount.toFixed(2)}</td>
                  <td>{categories.find(cat => cat.id === item.category_id)?.name || '—'}</td>
                  <td>{!!item.is_purchased ? 'Yes' : 'No'}</td>
                  <td>
                    <button onClick={() => handleEdit(item)} style={{ marginRight: 6, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => handleDelete(item.id)} style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                    {!item.is_purchased && <button onClick={() => handlePurchase(item)} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', marginLeft: 6 }}>Purchased</button>}
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

export default ShoppingListManager; 