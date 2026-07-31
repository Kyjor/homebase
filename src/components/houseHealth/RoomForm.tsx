import React, { useState } from 'react';
import { Room } from '../../types';
import { ROOM_COLORS } from '../../utils/houseHealth';
import styles from './HouseHealth.module.css';

interface RoomFormProps {
  initial?: Partial<Room>;
  onSubmit: (data: { name: string; description: string; color: string }) => Promise<void>;
  onClose: () => void;
  title?: string;
}

const RoomForm: React.FC<RoomFormProps> = ({
  initial,
  onSubmit,
  onClose,
  title = 'Add room',
}) => {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [color, setColor] = useState(initial?.color || ROOM_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Room name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), color });
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
        <h3 className={styles.modalTitle}>{title}</h3>
        <form className={styles.formStack} onSubmit={handleSubmit}>
          <label className={styles.formLabel}>
            Name
            <input
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Kitchen, Garage, Basement…"
              autoFocus
            />
          </label>
          <label className={styles.formLabel}>
            Description (optional)
            <textarea
              className={styles.textarea}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Notes about this space"
            />
          </label>
          <div className={styles.formLabel}>
            Color
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {ROOM_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: c,
                    border: color === c ? '3px solid #1e293b' : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.formActions}>
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
              {saving ? 'Saving…' : 'Save room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoomForm;
