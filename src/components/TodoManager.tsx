import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { useAuth } from '../contexts/AuthContext';
import { Todo } from '../types';
import { getTodosByHousehold, addTodo, updateTodo, deleteTodo, toggleTodoCompletion } from '../services/todoService';
import supabase from '../services/supabaseClient';
import { getCache, setCache } from '../utils/cacheManager';

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 700;

const TodoManager: React.FC = () => {
  const { household } = useHousehold();
  const { user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTodo, setNewTodo] = useState({ title: '', description: '', priority: 'medium' as const, due_date: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTodo, setEditTodo] = useState<Partial<Todo>>({});
  const [syncing, setSyncing] = useState(false);
  const [queuedMutations, setQueuedMutations] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const mobile = isMobile();

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
    const cacheKey = `todos_${household.id}`;
    const fetchData = async () => {
      if (!isOnline) {
        const cached = await getCache<Todo[]>(cacheKey);
        if (!ignore && cached) setTodos(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      getTodosByHousehold(household.id)
        .then(async todos => {
          if (!ignore) {
            setTodos(todos);
            setLoading(false);
            await setCache(cacheKey, todos);
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
    const channel = supabase.channel('todos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `household_id=eq.${household.id}`,
        },
        payload => {
          if (payload.eventType === 'INSERT') {
            setTodos(prev => [...prev, payload.new as Todo]);
          } else if (payload.eventType === 'UPDATE') {
            setTodos(prev => prev.map(t => t.id === payload.new.id ? payload.new as Todo : t));
          } else if (payload.eventType === 'DELETE') {
            setTodos(prev => prev.filter(t => t.id !== payload.old.id));
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
    const key = `todo_mutations_${household.id}`;
    const raw = localStorage.getItem(key);
    if (raw) setQueuedMutations(JSON.parse(raw));
    else setQueuedMutations([]);
  }, [household]);

  // Sync queued mutations when back online
  useEffect(() => {
    if (!household || !isOnline || queuedMutations.length === 0) return;
    const key = `todo_mutations_${household.id}`;
    const sync = async () => {
      setSyncing(true);
      for (const m of queuedMutations) {
        try {
          if (m.type === 'add') await addTodo(m.data);
          if (m.type === 'update') await updateTodo(m.id, m.data);
          if (m.type === 'delete') await deleteTodo(m.id);
          if (m.type === 'toggle') await toggleTodoCompletion(m.id, m.completed);
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
    const key = `todo_mutations_${household.id}`;
    const updated = [...queuedMutations, mutation];
    setQueuedMutations(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!household || !user || !newTodo.title.trim()) return;
    
    const todoData = {
      household_id: household.id,
      title: newTodo.title.trim(),
      description: newTodo.description.trim() || undefined,
      completed: false,
      created_by: user.id,
      priority: newTodo.priority,
      due_date: newTodo.due_date || undefined,
    } as any;

    if (!isOnline) {
      setTodos([...todos, { ...todoData, id: Date.now().toString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
      queueMutation({ type: 'add', data: todoData });
      setNewTodo({ title: '', description: '', priority: 'medium', due_date: '' });
      return;
    }

    try {
      const todo = await addTodo(todoData);
      setTodos([...todos, todo]);
      setNewTodo({ title: '', description: '', priority: 'medium', due_date: '' });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditTodo({ ...todo });
  };

  const handleEditSave = async (id: string) => {
    if (!editTodo.title?.trim()) return;
    
    const updates: Partial<Todo> = {
      title: editTodo.title.trim(),
      description: editTodo.description?.trim() || undefined,
      priority: editTodo.priority || 'medium',
      due_date: editTodo.due_date || undefined,
    };

    if (!isOnline) {
      setTodos(todos.map(t => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t));
      queueMutation({ type: 'update', id, data: updates });
      setEditingId(null);
      setEditTodo({});
      return;
    }

    try {
      const updated = await updateTodo(id, updates);
      setTodos(todos.map(t => t.id === id ? updated : t));
      setEditingId(null);
      setEditTodo({});
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    if (!isOnline) {
      setTodos(todos.map(t => t.id === id ? { 
        ...t, 
        completed, 
        completed_at: completed ? new Date().toISOString() : undefined,
        updated_at: new Date().toISOString()
      } : t));
      queueMutation({ type: 'toggle', id, completed });
      return;
    }

    try {
      const updated = await toggleTodoCompletion(id, completed);
      setTodos(todos.map(t => t.id === id ? updated : t));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this todo?')) return;
    
    if (!isOnline) {
      setTodos(todos.filter(t => t.id !== id));
      queueMutation({ type: 'delete', id });
      return;
    }

    try {
      await deleteTodo(id);
      setTodos(todos.filter(t => t.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  if (loading) return <div>Loading todos...</div>;

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 4px 24px 0 rgba(60,72,88,0.10)',
      padding: mobile ? 14 : 24,
    }}>
      {syncing && <div style={{ background: '#e3f2fd', color: '#1565c0', padding: '4px 0', textAlign: 'center', fontWeight: 600 }}>Syncing offline changes...</div>}
      <h3 style={{ fontWeight: 700, fontSize: 22, color: '#2d3748', marginBottom: 18 }}>Todo List</h3>
      
      {error && <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '8px 12px', fontSize: 15, textAlign: 'center', marginBottom: 10, fontWeight: 500 }}>{error}</div>}
      
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {(['all', 'active', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: filter === f ? '#6366f1' : '#f1f5f9',
              color: filter === f ? '#fff' : '#475569',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {f} ({f === 'all' ? todos.length : f === 'active' ? todos.filter(t => !t.completed).length : todos.filter(t => t.completed).length})
          </button>
        ))}
      </div>

      {/* Add new todo form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: 8 }}>
          <input
            type="text"
            placeholder="Todo title"
            value={newTodo.title}
            onChange={e => setNewTodo({ ...newTodo, title: e.target.value })}
            required
            style={{ flex: 1, padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15 }}
          />
          <select
            value={newTodo.priority}
            onChange={e => setNewTodo({ ...newTodo, priority: e.target.value as any })}
            style={{ padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, minWidth: mobile ? 'auto' : 120 }}
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: 8 }}>
          <input
            type="text"
            placeholder="Description (optional)"
            value={newTodo.description}
            onChange={e => setNewTodo({ ...newTodo, description: e.target.value })}
            style={{ flex: 1, padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15 }}
          />
          <input
            type="date"
            value={newTodo.due_date}
            onChange={e => setNewTodo({ ...newTodo, due_date: e.target.value })}
            style={{ padding: '10px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 15, minWidth: mobile ? 'auto' : 150 }}
          />
          <button
            type="submit"
            style={{
              background: 'linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '10px 20px',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              minWidth: 80,
            }}
          >
            Add
          </button>
        </div>
      </form>

      {/* Todo list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredTodos.map(todo => (
          <div key={todo.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 16,
            background: todo.completed ? '#f8fafc' : '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            opacity: todo.completed ? 0.7 : 1,
          }}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={e => handleToggleComplete(todo.id, e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            
            <div style={{
              width: 4,
              height: 40,
              background: getPriorityColor(todo.priority),
              borderRadius: 2,
            }} />
            
            {editingId === todo.id ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text"
                  value={editTodo.title || ''}
                  onChange={e => setEditTodo({ ...editTodo, title: e.target.value })}
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 14 }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Description"
                    value={editTodo.description || ''}
                    onChange={e => setEditTodo({ ...editTodo, description: e.target.value })}
                    style={{ flex: 1, minWidth: 150, padding: '6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                  <select
                    value={editTodo.priority || 'medium'}
                    onChange={e => setEditTodo({ ...editTodo, priority: e.target.value as any })}
                    style={{ padding: '6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <input
                    type="date"
                    value={editTodo.due_date || ''}
                    onChange={e => setEditTodo({ ...editTodo, due_date: e.target.value })}
                    style={{ padding: '6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleEditSave(todo.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 4,
                      border: 'none',
                      background: '#10b981',
                      color: '#fff',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setEditTodo({}); }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 4,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#6b7280',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: todo.completed ? '#6b7280' : '#1f2937',
                  textDecoration: todo.completed ? 'line-through' : 'none',
                  marginBottom: 4,
                }}>
                  {todo.title}
                </div>
                {todo.description && (
                  <div style={{
                    fontSize: 14,
                    color: '#6b7280',
                    marginBottom: 4,
                  }}>
                    {todo.description}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#9ca3af' }}>
                  <span>Priority: {todo.priority}</span>
                  {todo.due_date && <span>Due: {todo.due_date}</span>}
                  <span>Created: {new Date(todo.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            )}
            
            {editingId !== todo.id && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleEdit(todo)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: 'none',
                    background: '#f1f5f9',
                    color: '#475569',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(todo.id)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: 'none',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredTodos.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 40,
          color: '#9ca3af',
          fontSize: 16,
        }}>
          {filter === 'all' ? 'No todos yet. Add one above!' :
           filter === 'active' ? 'No active todos!' :
           'No completed todos!'}
        </div>
      )}
    </div>
  );
};

export default TodoManager;