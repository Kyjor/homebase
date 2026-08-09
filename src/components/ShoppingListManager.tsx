import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import {
  getShoppingListsByHousehold,
  addShoppingList,
  updateShoppingList,
  deleteShoppingList,
  ShoppingList,
} from '../services/shoppingListsService';
import { Expense } from '../types';
import {
  getExpensesByHousehold,
  addExpense,
  updateExpense,
  deleteExpense,
} from '../services/expenseService';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../services/supabaseClient';
import styles from './ShoppingListManager.module.css';

function formatMoney(dollars: string, cents: string) {
  const d = parseInt(dollars || '0', 10) || 0;
  const c = (cents || '00').padStart(2, '0').slice(0, 2);
  return `${d}.${c}`;
}

const activeListStorageKey = (householdId: string) =>
  `homebase_shopping_list_${householdId}`;

const ShoppingListManager: React.FC = () => {
  const { household } = useHousehold();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);

  const openList = (list: ShoppingList | null) => {
    setActiveList(list);
    if (!household) return;
    try {
      if (list) sessionStorage.setItem(activeListStorageKey(household.id), list.id);
      else sessionStorage.removeItem(activeListStorageKey(household.id));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!household) return;
    getShoppingListsByHousehold(household.id)
      .then(fetched => {
        setLists(fetched);
        try {
          const savedId = sessionStorage.getItem(activeListStorageKey(household.id));
          if (savedId) {
            const match = fetched.find(l => l.id === savedId);
            if (match) setActiveList(match);
          }
        } catch {
          /* ignore */
        }
      })
      .catch(e => setError(e.message));
  }, [household]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !newListName.trim()) return;
    try {
      const list = await addShoppingList({
        household_id: household.id,
        name: newListName.trim(),
      });
      setLists([...lists, list]);
      setNewListName('');
      openList(list);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditSave = async (id: string) => {
    try {
      const updated = await updateShoppingList(id, { name: editName });
      setLists(lists.map(l => (l.id === id ? updated : l)));
      setEditingId(null);
      setEditName('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this shopping list?')) return;
    try {
      await deleteShoppingList(id);
      setLists(lists.filter(l => l.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (activeList) {
    return <ShoppingListPage list={activeList} onBack={() => openList(null)} />;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Shopping</h2>
      </div>
      <p className={styles.subtitle}>Shared lists for the household. Tap a list to add items.</p>
      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleAdd} className={styles.addForm}>
        <input
          className={styles.input}
          type="text"
          placeholder="New list name"
          value={newListName}
          onChange={e => setNewListName(e.target.value)}
          required
        />
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
          Create list
        </button>
      </form>

      {lists.length === 0 ? (
        <div className={styles.empty}>No lists yet — create one to get started.</div>
      ) : (
        <ul className={styles.list}>
          {lists.map(list => (
            <li key={list.id} className={styles.listItem}>
              {editingId === list.id ? (
                <>
                  <input
                    className={styles.input}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    autoFocus
                  />
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={() => handleEditSave(list.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.listName}
                    onClick={() => openList(list)}
                  >
                    {list.name}
                  </button>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost}`}
                      onClick={() => {
                        setEditingId(list.id);
                        setEditName(list.name);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger}`}
                      onClick={() => handleDelete(list.id)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const ShoppingListPage: React.FC<{ list: ShoppingList; onBack: () => void }> = ({
  list,
  onBack,
}) => {
  const { household } = useHousehold();
  const { user } = useAuth();
  const [items, setItems] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [dollars, setDollars] = useState('0');
  const [cents, setCents] = useState('00');
  const [priceOpen, setPriceOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [editCategoryId, setEditCategoryId] = useState('');

  useEffect(() => {
    if (!household) return;
    Promise.all([
      getExpensesByHousehold(household.id),
      import('../services/categoryService').then(m =>
        m.getCategoriesByHousehold(household.id)
      ),
    ])
      .then(([expenses, cats]) => {
        setItems(expenses.filter(e => e.shopping_list_id === list.id));
        setCategories(cats);
        if (cats[0]) setCategoryId(cats[0].id);
      })
      .catch(e => setError(e.message));

    const channel = supabase
      .channel(`shopping-list-items-${list.id}`)
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
            const incoming = payload.new as Expense;
            setItems(prev =>
              prev.some(i => i.id === incoming.id) ? prev : [...prev, incoming]
            );
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev =>
              prev.map(i => (i.id === payload.new.id ? (payload.new as Expense) : i))
            );
          } else if (payload.eventType === 'DELETE') {
            const removedId = (payload.old as { id?: string })?.id;
            if (removedId) setItems(prev => prev.filter(i => i.id !== removedId));
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
    if (!household || !user || !itemName.trim()) return;
    const qty = Math.max(1, quantity || 1);
    const amount = parseFloat(formatMoney(dollars, cents));
    try {
      const results = await Promise.all(
        Array.from({ length: qty }).map(() =>
          addExpense({
            household_id: household.id,
            shopping_list_id: list.id,
            created_by: user.id,
            is_recurring: false,
            is_purchased: false,
            date: new Date().toISOString().slice(0, 10),
            amount,
            category_id: categoryId || categories[0]?.id || '',
            item_name: itemName.trim(),
            notes: '',
          } as any)
        )
      );
      setItems(prev => {
        const seen = new Set(prev.map(i => i.id));
        return [...prev, ...results.filter(r => !seen.has(r.id))];
      });
      setItemName('');
      setQuantity(1);
      setDollars('0');
      setCents('00');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this item?')) return;
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      await deleteExpense(id);
    } catch (err: any) {
      setError(err.message);
      if (!household) return;
      try {
        const expenses = await getExpensesByHousehold(household.id);
        setItems(expenses.filter(e => e.shopping_list_id === list.id));
      } catch {
        /* keep optimistic removal */
      }
    }
  };

  const closeEditor = () => {
    setPriceOpen(false);
    setEditingItem(null);
    setEditCategoryId('');
  };

  const savePrice = async () => {
    const amount = parseFloat(formatMoney(dollars, cents));
    if (editingItem) {
      try {
        const updated = await updateExpense(editingItem.id, {
          amount,
          category_id: editCategoryId || editingItem.category_id,
        });
        setItems(prev => prev.map(i => (i.id === editingItem.id ? updated : i)));
        closeEditor();
      } catch (err: any) {
        setError(err.message);
      }
      return;
    }
    setPriceOpen(false);
  };

  const priceLabel =
    dollars !== '0' || cents !== '00'
      ? `$${formatMoney(dollars, cents)}`
      : 'Price';

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ← Lists
        </button>
        <h2 className={styles.title}>{list.name}</h2>
      </div>
      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleAdd} className={styles.addForm}>
        <input
          className={styles.input}
          type="text"
          placeholder="Item name"
          value={itemName}
          onChange={e => setItemName(e.target.value)}
          required
        />
        <button
          type="button"
          className={styles.priceBtn}
          onClick={() => {
            setEditingItem(null);
            setPriceOpen(true);
          }}
        >
          {priceLabel}
        </button>
        <input
          className={`${styles.input} ${styles.qty}`}
          type="number"
          min={1}
          value={quantity}
          onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
          aria-label="Quantity"
        />
        <select
          className={styles.select}
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
        >
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
          Add
        </button>
      </form>

      <div className={styles.itemStack}>
        {items.length === 0 && (
          <div className={styles.empty}>No items yet. Add milk, trash bags, whatever you need.</div>
        )}
        {items.map(item => (
          <div key={item.id} className={styles.itemRow}>
            <div>
              <div className={styles.itemName}>{item.item_name}</div>
              <div className={styles.itemMeta}>
                {categories.find(c => c.id === item.category_id)?.name || '—'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={styles.itemAmount}>${Number(item.amount).toFixed(2)}</span>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={() => {
                    const [d, c] = Number(item.amount).toFixed(2).split('.');
                    setDollars(d);
                    setCents(c);
                    setEditingItem(item);
                    setEditCategoryId(item.category_id || categories[0]?.id || '');
                    setPriceOpen(true);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={() => handleDelete(item.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {priceOpen && (
        <div className={styles.overlay} onClick={closeEditor}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={closeEditor}
              aria-label="Close"
            >
              ×
            </button>
            <h3 className={styles.modalTitle}>
              {editingItem ? 'Edit item' : 'Set price'}
            </h3>
            <div className={styles.simplePrice}>
              <span>$</span>
              <input
                type="number"
                min={0}
                value={dollars}
                onChange={e => setDollars(String(Math.max(0, parseInt(e.target.value || '0', 10) || 0)))}
                aria-label="Dollars"
              />
              <span>.</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={cents}
                onChange={e => setCents(e.target.value.replace(/\D/g, '').slice(0, 2))}
                aria-label="Cents"
              />
            </div>
            {editingItem && (
              <select
                className={styles.select}
                value={editCategoryId}
                onChange={e => setEditCategoryId(e.target.value)}
                aria-label="Category"
                style={{ width: '100%', marginBottom: 12 }}
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={savePrice}>
              {editingItem ? 'Save' : 'Use this price'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShoppingListManager;
