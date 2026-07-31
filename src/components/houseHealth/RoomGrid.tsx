import React from 'react';
import { HouseTask, Room } from '../../types';
import { countOpen, countOverdue, roomHealthScore } from '../../utils/houseHealth';
import HealthScore from './HealthScore';
import styles from './HouseHealth.module.css';

interface RoomGridProps {
  rooms: Room[];
  tasks: HouseTask[];
  onSelect: (room: Room) => void;
  onAdd: () => void;
}

const RoomGrid: React.FC<RoomGridProps> = ({ rooms, tasks, onSelect, onAdd }) => {
  if (rooms.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h3>No rooms yet</h3>
        <p>Start by adding rooms — Kitchen, Garage, HVAC closet — then attach maintenance and projects.</p>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onAdd} style={{ marginTop: 16 }}>
          Add your first room
        </button>
      </div>
    );
  }

  return (
    <div className={styles.roomGrid}>
      {rooms.map(room => {
        const roomTasks = tasks.filter(t => t.room_id === room.id);
        const score = roomHealthScore(roomTasks);
        const open = countOpen(roomTasks);
        const overdue = countOverdue(roomTasks);
        return (
          <button
            key={room.id}
            type="button"
            className={`${styles.roomCard} ${room.archived_at ? styles.archived : ''}`}
            onClick={() => onSelect(room)}
          >
            <div className={styles.roomCardTop}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span
                  className={styles.roomAccent}
                  style={{ background: room.color || '#6366f1' }}
                />
                <div>
                  <h3 className={styles.roomName}>{room.name}</h3>
                  {room.description && (
                    <p className={styles.subtitle} style={{ marginTop: 4 }}>
                      {room.description}
                    </p>
                  )}
                </div>
              </div>
              <HealthScore score={score} size="sm" />
            </div>
            <div className={styles.roomMeta}>
              <span>{open} open</span>
              {overdue > 0 && <span className={styles.metaWarn}>{overdue} overdue</span>}
              {room.archived_at && <span>Archived</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default RoomGrid;
