import React from 'react';
import { Room, TaskPriority } from '../../types';
import { TaskFilterStatus, TaskSortKey } from '../../utils/houseHealth';
import styles from './HouseHealth.module.css';

interface TaskFiltersProps {
  rooms: Room[];
  roomId: string | null;
  priority: TaskPriority | 'all';
  status: TaskFilterStatus;
  sort: TaskSortKey;
  showArchived: boolean;
  hideRoomFilter?: boolean;
  onChange: (next: {
    roomId?: string | null;
    priority?: TaskPriority | 'all';
    status?: TaskFilterStatus;
    sort?: TaskSortKey;
    showArchived?: boolean;
  }) => void;
}

const TaskFiltersBar: React.FC<TaskFiltersProps> = ({
  rooms,
  roomId,
  priority,
  status,
  sort,
  showArchived,
  hideRoomFilter,
  onChange,
}) => {
  return (
    <div className={styles.filters}>
      {!hideRoomFilter && (
        <select
          className={styles.select}
          value={roomId || ''}
          onChange={e => onChange({ roomId: e.target.value || null })}
          aria-label="Filter by room"
        >
          <option value="">All rooms</option>
          {rooms.map(r => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
      <select
        className={styles.select}
        value={priority}
        onChange={e => onChange({ priority: e.target.value as TaskPriority | 'all' })}
        aria-label="Filter by priority"
      >
        <option value="all">All priorities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select
        className={styles.select}
        value={status}
        onChange={e => onChange({ status: e.target.value as TaskFilterStatus })}
        aria-label="Filter by status"
      >
        <option value="all">All statuses</option>
        <option value="open">Open</option>
        <option value="overdue">Overdue</option>
        <option value="paused">Paused</option>
      </select>
      <select
        className={styles.select}
        value={sort}
        onChange={e => onChange({ sort: e.target.value as TaskSortKey })}
        aria-label="Sort tasks"
      >
        <option value="priority">Sort: Priority</option>
        <option value="next_due">Sort: Next due</option>
        <option value="estimated_cost">Sort: Cost</option>
      </select>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={showArchived}
          onChange={e => onChange({ showArchived: e.target.checked })}
        />
        Show archived
      </label>
    </div>
  );
};

export default TaskFiltersBar;
