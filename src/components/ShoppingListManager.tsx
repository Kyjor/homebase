import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { getShoppingListsByHousehold, addShoppingList, updateShoppingList, deleteShoppingList, ShoppingList } from '../services/shoppingListsService';
import { Expense } from '../types';
import { getExpensesByHousehold, addExpense, updateExpense, deleteExpense } from '../services/expenseService';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../services/supabaseClient';
import { WheelPicker, WheelPickerWrapper } from '@ncdai/react-wheel-picker';
import './ShoppingListManager.css';
import PricePicker from './PricePicker';

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
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalItem, setEditModalItem] = useState<Expense | null>(null);
  const [dollarValue, setDollarValue] = useState('0');
  const [centValue, setCentValue] = useState('00');
  const [newDollarValue, setNewDollarValue] = useState('0');
  const [newCentValue, setNewCentValue] = useState('00');
  const [priceModalMode, setPriceModalMode] = useState<'add' | 'edit' | null>(null);

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
    const amount = parseFloat(`${newDollarValue}.${newCentValue.padStart(2, '0')}`);
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
          amount,
          category_id: newItem.category_id || categories[0]?.id || '',
          item_name: newItem.item_name || '',
        } as any)
      );
      const results = await Promise.all(promises);
      setItems([...items, ...results]);
      setNewItem({ item_name: '', amount: 0, category_id: '', notes: '', is_purchased: false, quantity: 1 });
      setNewDollarValue('0');
      setNewCentValue('00');
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

  const handleEditModalSave = (d: string, c: string) => {
    if (!editModalItem) return;
    const newAmount = parseFloat(`${d}.${c}`);
    updateExpense(editModalItem.id, { amount: newAmount }).then(updated => {
      setItems(items.map(i => (i.id === editModalItem.id ? updated : i)));
      setEditModalOpen(false);
      setEditModalItem(null);
    });
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
      minHeight: mobile ? 'calc(100vh - 80px)' : 420,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <button onClick={onBack} style={{ position: 'absolute', left: 12, top: 12, background: 'none', border: 'none', color: '#6366f1', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>← Back</button>
      <h2 style={{ fontWeight: 700, fontSize: mobile ? 22 : 26, color: '#2d3748', marginBottom: 10, textAlign: 'center' }}>{list.name}</h2>
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '8px 12px', fontSize: 15, textAlign: 'center', marginBottom: 10, fontWeight: 500 }}>{error}</div>}
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 10 : 8, marginBottom: 18 }}>
        <input
          type="text"
          placeholder="Item name"
          value={newItem.item_name || ''}
          onChange={e => setNewItem({ ...newItem, item_name: e.target.value })}
          required
          style={{ flex: 2, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, boxSizing: 'border-box' }}
        />
        <button
          type="button"
          onClick={() => {
            setDollarValue(newDollarValue);
            setCentValue(newCentValue);
            setPriceModalMode('add');
            setEditModalOpen(true);
          }}
          style={{ flex: 1, minWidth: 0, width: '100%', padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, fontWeight: 600, background: '#f1f5f9', color: '#334155', cursor: 'pointer' }}
        >{`Set Price${newDollarValue !== '0' || newCentValue !== '00' ? `: $${parseInt(newDollarValue, 10)}.${newCentValue.padStart(2, '0')}` : ''}`}</button>
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
      <div style={{ flex: 1, overflowY: 'auto', width: '100%', maxWidth: '100vw', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.length === 0 && (
          <div style={{ color: '#64748b', fontSize: 16, textAlign: 'center', marginTop: 24 }}>No items yet.</div>
        )}
        {items.map(item => (
          <div key={item.id} style={{
            background: '#f8fafc',
            borderRadius: 10,
            boxShadow: '0 1px 4px 0 rgba(60,72,88,0.06)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 2,
            position: 'relative',
          }}>
            <div style={{ flex: 2, fontWeight: 600, color: '#2d3748', fontSize: 16 }}>{item.item_name}</div>
            <div style={{ flex: 1, color: '#334155', fontSize: 15 }}>${item.amount.toFixed(2)}</div>
            <div style={{ flex: 1, color: '#64748b', fontSize: 15 }}>{categories.find(cat => cat.id === item.category_id)?.name || '—'}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                setEditModalItem(item);
                const [d, c] = item.amount.toFixed(2).split('.');
                setDollarValue(d);
                setCentValue(c);
                setPriceModalMode('edit');
                setEditModalOpen(true);
              }} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 20, cursor: 'pointer', padding: 4 }} aria-label="Edit"><span role="img" aria-label="Edit">✏️</span></button>
              <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 20, cursor: 'pointer', padding: 4 }} aria-label="Delete"><span role="img" aria-label="Delete">🗑️</span></button>
            </div>
          </div>
        ))}
      </div>
      {/* Modal for editing price */}
      {editModalOpen && (editModalItem || priceModalMode === 'add') && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.18)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
          onClick={() => { setEditModalOpen(false); setEditModalItem(null); }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 24,
              boxShadow: '0 12px 48px 0 rgba(60,72,88,0.22)',
              padding: 48,
              minWidth: 480,
              maxWidth: '98vw',
              zIndex: 101,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 32,
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { setEditModalOpen(false); setEditModalItem(null); }}
              style={{
                position: 'absolute',
                top: 18,
                right: 22,
                background: 'none',
                border: 'none',
                fontSize: 36,
                color: '#6366f1',
                cursor: 'pointer',
                zIndex: 2,
              }}
              aria-label="Close popup"
            >×</button>
            <div style={{ fontWeight: 800, fontSize: 32, color: '#2d3748', marginBottom: 12 }}>Edit Price</div>
            <div style={{ width: 400, display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 32, margin: '0 auto', padding: 0 }}>
              <PricePicker
                dollarValue={dollarValue}
                centValue={centValue}
                onDollarChange={setDollarValue}
                onCentChange={setCentValue}
                visibleCount={7}
                optionItemHeight={128}
              />
            </div>
            <button
              onClick={() => {
                if (priceModalMode === 'add') {
                  setNewDollarValue(dollarValue);
                  setNewCentValue(centValue);
                  setEditModalOpen(false);
                  setPriceModalMode(null);
                } else {
                  handleEditModalSave(dollarValue, centValue);
                  setPriceModalMode(null);
                }
              }}
              style={{
                background: 'linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '20px 0',
                fontWeight: 800,
                fontSize: 28,
                cursor: 'pointer',
                minWidth: 180,
                width: '100%',
                boxShadow: '0 4px 16px 0 rgba(60,72,88,0.12)',
                transition: 'background 0.2s',
                marginTop: 16,
              }}
            >+</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShoppingListManager; 