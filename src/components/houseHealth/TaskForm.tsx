import React, { useState } from 'react';
import { HouseTask, Room, TaskFrequency, TaskPriority, TaskStatus } from '../../types';
import styles from './HouseHealth.module.css';

export interface TaskFormValues {
  title: string;
  description: string;
  room_id: string;
  estimated_cost: number | null;
  priority: TaskPriority;
  status: TaskStatus;
  frequency: TaskFrequency;
  interval_days: number | null;
  next_due: string | null;
}

interface TaskFormProps {
  rooms: Room[];
  initial?: Partial<HouseTask>;
  defaultRoomId?: string;
  onSubmit: (data: TaskFormValues) => Promise<void>;
  onClose: () => void;
  title?: string;
}

const TaskForm: React.FC<TaskFormProps> = ({
  rooms,
  initial,
  defaultRoomId,
  onSubmit,
  onClose,
  title = 'Add task',
}) => {
  const [form, setForm] = useState<TaskFormValues>({
    title: initial?.title || '',
    description: initial?.description || '',
    room_id: initial?.room_id || defaultRoomId || rooms[0]?.id || '',
    estimated_cost: initial?.estimated_cost ?? null,
    priority: initial?.priority || 'medium',
    status: initial?.status === 'archived' ? 'open' : initial?.status || 'open',
    frequency: initial?.frequency || 'none',
    interval_days: initial?.interval_days ?? null,
    next_due: initial?.next_due ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!form.room_id) {
      setError('Pick a room');
      return;
    }
    if (form.frequency === 'custom' && (!form.interval_days || form.interval_days <= 0)) {
      setError('Custom frequency needs interval days');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalWide}`} onClick={e => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3 className={styles.modalTitle}>{title}</h3>
        <form className={styles.formStack} onSubmit={handleSubmit}>
          <label className={styles.formLabel}>
            Title
            <input
              className={styles.input}
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Service furnace, reseal deck…"
              autoFocus
            />
          </label>
          <label className={styles.formLabel}>
            Description
            <textarea
              className={styles.textarea}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </label>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              Room
              <select
                className={styles.select}
                value={form.room_id}
                onChange={e => set('room_id', e.target.value)}
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.formLabel}>
              Priority
              <select
                className={styles.select}
                value={form.priority}
                onChange={e => set('priority', e.target.value as TaskPriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              Estimated cost
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={form.estimated_cost ?? ''}
                onChange={e =>
                  set('estimated_cost', e.target.value === '' ? null : Number(e.target.value))
                }
                placeholder="0.00"
              />
            </label>
            <label className={styles.formLabel}>
              Status
              <select
                className={styles.select}
                value={form.status}
                onChange={e => set('status', e.target.value as TaskStatus)}
              >
                <option value="open">Open</option>
                <option value="paused">Paused</option>
              </select>
            </label>
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              Frequency
              <select
                className={styles.select}
                value={form.frequency}
                onChange={e => set('frequency', e.target.value as TaskFrequency)}
              >
                <option value="none">One-off / as needed</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom days</option>
              </select>
            </label>
            <label className={styles.formLabel}>
              Next due
              <input
                className={styles.input}
                type="date"
                value={form.next_due || ''}
                onChange={e => set('next_due', e.target.value || null)}
              />
            </label>
          </div>
          {form.frequency === 'custom' && (
            <label className={styles.formLabel}>
              Interval (days)
              <input
                className={styles.input}
                type="number"
                min="1"
                value={form.interval_days ?? ''}
                onChange={e =>
                  set('interval_days', e.target.value === '' ? null : Number(e.target.value))
                }
              />
            </label>
          )}
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.formActions}>
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
              {saving ? 'Saving…' : 'Save task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskForm;
