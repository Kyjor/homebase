import React, { useState } from 'react';
import { HouseTask } from '../../types';
import { todayISO } from '../../utils/houseHealth';
import styles from './HouseHealth.module.css';

interface CompleteTaskModalProps {
  task: HouseTask;
  onSubmit: (data: {
    completed_at: string;
    cost: number | null;
    notes: string;
  }) => Promise<void>;
  onClose: () => void;
}

const CompleteTaskModal: React.FC<CompleteTaskModalProps> = ({ task, onSubmit, onClose }) => {
  const [completedAt, setCompletedAt] = useState(todayISO());
  const [cost, setCost] = useState<string>(
    task.estimated_cost != null ? String(task.estimated_cost) : ''
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completedAt) {
      setError('Completion date is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        completed_at: completedAt,
        cost: cost === '' ? null : Number(cost),
        notes: notes.trim(),
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
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3 className={styles.modalTitle}>Mark complete</h3>
        <p className={styles.subtitle} style={{ marginBottom: 12 }}>
          {task.title} — this adds a history entry and keeps the task for next time.
        </p>
        <form className={styles.formStack} onSubmit={handleSubmit}>
          <label className={styles.formLabel}>
            Date completed
            <input
              className={styles.input}
              type="date"
              value={completedAt}
              onChange={e => setCompletedAt(e.target.value)}
              required
            />
          </label>
          <label className={styles.formLabel}>
            Actual cost
            <input
              className={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={e => setCost(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className={styles.formLabel}>
            Notes
            <textarea
              className={styles.textarea}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Who did it, parts used, warranty…"
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.formActions}>
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
              {saving ? 'Saving…' : 'Save completion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompleteTaskModal;
