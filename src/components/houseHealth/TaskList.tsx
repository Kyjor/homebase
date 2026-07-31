import React from 'react';
import { HouseTask, Room } from '../../types';
import { PRIORITY_COLORS, isOverdue } from '../../utils/houseHealth';
import styles from './HouseHealth.module.css';

interface TaskListProps {
  tasks: HouseTask[];
  rooms: Room[];
  onSelect: (task: HouseTask) => void;
  emptyMessage?: string;
}

const TaskList: React.FC<TaskListProps> = ({
  tasks,
  rooms,
  onSelect,
  emptyMessage = 'No tasks match these filters.',
}) => {
  if (tasks.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h3>Nothing here</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const roomName = (id: string) => rooms.find(r => r.id === id)?.name || 'Room';

  return (
    <div className={styles.taskList}>
      {tasks.map(task => {
        const overdue = isOverdue(task);
        return (
          <button
            key={task.id}
            type="button"
            className={`${styles.taskRow} ${task.archived_at ? styles.archived : ''}`}
            onClick={() => onSelect(task)}
          >
            <div>
              <h4 className={styles.taskTitle}>{task.title}</h4>
              <div className={styles.taskMeta}>
                <span
                  className={styles.badge}
                  style={{
                    background: `${PRIORITY_COLORS[task.priority]}22`,
                    color: PRIORITY_COLORS[task.priority],
                  }}
                >
                  {task.priority}
                </span>
                <span>{roomName(task.room_id)}</span>
                {task.next_due && (
                  <span className={overdue ? styles.metaWarn : undefined}>
                    {overdue ? 'Overdue ' : 'Due '}
                    {task.next_due}
                  </span>
                )}
                {task.last_completed_at && <span>Last: {task.last_completed_at}</span>}
                {task.estimated_cost != null && (
                  <span>${Number(task.estimated_cost).toFixed(0)}</span>
                )}
                {task.status === 'paused' && <span>Paused</span>}
              </div>
            </div>
            {overdue && <span className={`${styles.badge} ${styles.badgeOverdue}`}>Overdue</span>}
          </button>
        );
      })}
    </div>
  );
};

export default TaskList;
