import React, { useEffect, useState } from 'react';
import { HouseTask, Room, TaskAttachment, TaskCompletion } from '../../types';
import {
  archiveTask,
  getCompletionsByTask,
  unarchiveTask,
  updateTask,
} from '../../services/houseTaskService';
import { getAttachmentsForTask } from '../../services/taskAttachmentService';
import { PRIORITY_COLORS, isOverdue } from '../../utils/houseHealth';
import AttachmentStrip from './AttachmentStrip';
import CompleteTaskModal from './CompleteTaskModal';
import TaskForm, { TaskFormValues } from './TaskForm';
import styles from './HouseHealth.module.css';

interface TaskDetailProps {
  task: HouseTask;
  rooms: Room[];
  userId?: string | null;
  onClose: () => void;
  onUpdated: (task: HouseTask) => void;
  onComplete: (data: {
    completed_at: string;
    cost: number | null;
    notes: string;
  }) => Promise<void>;
}

const TaskDetail: React.FC<TaskDetailProps> = ({
  task,
  rooms,
  userId,
  onClose,
  onUpdated,
  onComplete,
}) => {
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [showComplete, setShowComplete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRelated = async () => {
    try {
      const [c, a] = await Promise.all([
        getCompletionsByTask(task.id),
        getAttachmentsForTask(task.id),
      ]);
      setCompletions(c);
      setAttachments(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    loadRelated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const room = rooms.find(r => r.id === task.room_id);
  const overdue = isOverdue(task);

  const handleEdit = async (values: TaskFormValues) => {
    const updated = await updateTask(task.id, {
      title: values.title,
      description: values.description || null,
      room_id: values.room_id,
      estimated_cost: values.estimated_cost,
      priority: values.priority,
      status: values.status,
      frequency: values.frequency,
      interval_days: values.frequency === 'custom' ? values.interval_days : null,
      next_due: values.next_due,
    });
    onUpdated(updated);
  };

  const handleArchiveToggle = async () => {
    try {
      const updated = task.archived_at
        ? await unarchiveTask(task.id)
        : await archiveTask(task.id);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div
          className={`${styles.modal} ${styles.modalWide}`}
          onClick={e => e.stopPropagation()}
        >
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">
            ×
          </button>
          <h3 className={styles.modalTitle}>{task.title}</h3>
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
            <span>{room?.name || 'Room'}</span>
            <span>{task.frequency === 'none' ? 'One-off' : task.frequency}</span>
            {task.next_due && (
              <span className={overdue ? styles.metaWarn : undefined}>
                {overdue ? 'Overdue ' : 'Next due '}
                {task.next_due}
              </span>
            )}
            {task.last_completed_at && <span>Last done {task.last_completed_at}</span>}
            {task.estimated_cost != null && (
              <span>Est. ${Number(task.estimated_cost).toFixed(2)}</span>
            )}
          </div>
          {task.description && (
            <p className={styles.subtitle} style={{ marginTop: 12 }}>
              {task.description}
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
              onClick={() => setShowComplete(true)}
            >
              Mark complete
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
              onClick={() => setShowEdit(true)}
            >
              Edit
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
              onClick={handleArchiveToggle}
            >
              {task.archived_at ? 'Unarchive' : 'Archive'}
            </button>
          </div>

          <div className={styles.detailSection}>
            <h4>Photos</h4>
            <AttachmentStrip
              householdId={task.household_id}
              taskId={task.id}
              attachments={attachments}
              userId={userId}
              onChange={loadRelated}
            />
          </div>

          <div className={styles.detailSection}>
            <h4>Completion history</h4>
            {completions.length === 0 ? (
              <p className={styles.subtitle}>No completions yet. Mark complete to start the log.</p>
            ) : (
              <div className={styles.timeline}>
                {completions.map(c => (
                  <div key={c.id} className={styles.timelineItem}>
                    <div className={styles.timelineDate}>{c.completed_at}</div>
                    <div className={styles.timelineMeta}>
                      {c.cost != null && <span>${Number(c.cost).toFixed(2)} · </span>}
                      {c.notes || 'No notes'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>

      {showComplete && (
        <CompleteTaskModal
          task={task}
          onClose={() => setShowComplete(false)}
          onSubmit={async data => {
            await onComplete(data);
            await loadRelated();
          }}
        />
      )}

      {showEdit && (
        <TaskForm
          rooms={rooms.filter(r => !r.archived_at || r.id === task.room_id)}
          initial={task}
          title="Edit task"
          onClose={() => setShowEdit(false)}
          onSubmit={handleEdit}
        />
      )}
    </>
  );
};

export default TaskDetail;
