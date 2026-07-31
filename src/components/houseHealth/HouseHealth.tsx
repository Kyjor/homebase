import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useHousehold } from '../../contexts/HouseholdContext';
import { HouseTask, Room, TaskPriority } from '../../types';
import {
  addRoom,
  archiveRoom,
  getRoomsByHousehold,
  unarchiveRoom,
  updateRoom,
} from '../../services/roomService';
import {
  addTask,
  completeTask,
  getTasksByHousehold,
} from '../../services/houseTaskService';
import supabase from '../../services/supabaseClient';
import {
  TaskFilterStatus,
  TaskSortKey,
  filterAndSortTasks,
  householdHealthScore,
} from '../../utils/houseHealth';
import HealthScore from './HealthScore';
import RoomForm from './RoomForm';
import RoomGrid from './RoomGrid';
import TaskDetail from './TaskDetail';
import TaskFiltersBar from './TaskFilters';
import TaskForm, { TaskFormValues } from './TaskForm';
import TaskList from './TaskList';
import styles from './HouseHealth.module.css';

type View = 'overview' | 'room' | 'all-tasks';

const HouseHealth: React.FC = () => {
  const { household } = useHousehold();
  const { user } = useAuth();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [tasks, setTasks] = useState<HouseTask[]>([]);
  const [view, setView] = useState<View>('overview');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<HouseTask | null>(null);

  const [showRoomForm, setShowRoomForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);

  const [roomIdFilter, setRoomIdFilter] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority | 'all'>('all');
  const [status, setStatus] = useState<TaskFilterStatus>('all');
  const [sort, setSort] = useState<TaskSortKey>('priority');
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!household) return;
    setLoading(true);
    setError(null);
    try {
      const [r, t] = await Promise.all([
        getRoomsByHousehold(household.id, true),
        getTasksByHousehold(household.id, true),
      ]);
      setRooms(r);
      setTasks(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [household]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!household) return;

    const channel = supabase
      .channel(`house-health-${household.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `household_id=eq.${household.id}` },
        () => load()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'house_tasks',
          filter: `household_id=eq.${household.id}`,
        },
        () => load()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_completions',
          filter: `household_id=eq.${household.id}`,
        },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [household, load]);

  const visibleRooms = useMemo(
    () => (showArchived ? rooms : rooms.filter(r => !r.archived_at)),
    [rooms, showArchived]
  );

  const activeRoomsForForms = useMemo(
    () => rooms.filter(r => !r.archived_at),
    [rooms]
  );

  const householdScore = useMemo(
    () => householdHealthScore(rooms.filter(r => !r.archived_at), tasks),
    [rooms, tasks]
  );

  const selectedRoom = rooms.find(r => r.id === selectedRoomId) || null;

  const filteredTasks = useMemo(() => {
    const baseFilters = {
      roomId: view === 'room' ? selectedRoomId : roomIdFilter,
      priority,
      status,
      showArchived,
      sort,
    };
    return filterAndSortTasks(tasks, baseFilters);
  }, [tasks, view, selectedRoomId, roomIdFilter, priority, status, showArchived, sort]);

  if (!household) return null;

  const handleAddRoom = async (data: { name: string; description: string; color: string }) => {
    await addRoom({
      household_id: household.id,
      name: data.name,
      description: data.description || null,
      color: data.color,
      sort_order: rooms.length,
    });
    await load();
  };

  const handleEditRoom = async (data: { name: string; description: string; color: string }) => {
    if (!editingRoom) return;
    await updateRoom(editingRoom.id, {
      name: data.name,
      description: data.description || null,
      color: data.color,
    });
    setEditingRoom(null);
    await load();
  };

  const handleAddTask = async (values: TaskFormValues) => {
    await addTask({
      household_id: household.id,
      room_id: values.room_id,
      title: values.title,
      description: values.description || null,
      estimated_cost: values.estimated_cost,
      priority: values.priority,
      status: values.status,
      frequency: values.frequency,
      interval_days: values.frequency === 'custom' ? values.interval_days : null,
      next_due: values.next_due,
      created_by: user?.id ?? null,
    });
    await load();
  };

  const handleComplete = async (data: {
    completed_at: string;
    cost: number | null;
    notes: string;
  }) => {
    if (!selectedTask) return;
    const { task } = await completeTask({
      task: selectedTask,
      completed_at: data.completed_at,
      cost: data.cost,
      notes: data.notes,
      completed_by: user?.id ?? null,
    });
    setSelectedTask(task);
    await load();
  };

  const handleArchiveRoomToggle = async () => {
    if (!selectedRoom) return;
    if (selectedRoom.archived_at) {
      await unarchiveRoom(selectedRoom.id);
    } else {
      await archiveRoom(selectedRoom.id);
    }
    await load();
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <HealthScore score={householdScore} />
          <div>
            <h2 className={styles.title}>House Health</h2>
            <p className={styles.subtitle}>
              Rooms, maintenance, and projects — track what needs care.
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => {
              setEditingRoom(null);
              setShowRoomForm(true);
            }}
          >
            Add room
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => setShowTaskForm(true)}
            disabled={activeRoomsForForms.length === 0}
          >
            Add task
          </button>
        </div>
      </div>

      <div className={styles.subnav}>
        <button
          type="button"
          className={`${styles.subnavBtn} ${view === 'overview' ? styles.subnavBtnActive : ''}`}
          onClick={() => {
            setView('overview');
            setSelectedRoomId(null);
          }}
        >
          Rooms
        </button>
        <button
          type="button"
          className={`${styles.subnavBtn} ${view === 'all-tasks' ? styles.subnavBtnActive : ''}`}
          onClick={() => {
            setView('all-tasks');
            setSelectedRoomId(null);
          }}
        >
          All tasks
        </button>
        {selectedRoom && view === 'room' && (
          <button type="button" className={`${styles.subnavBtn} ${styles.subnavBtnActive}`}>
            {selectedRoom.name}
          </button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.subtitle}>Loading…</p>}

      {view === 'overview' && (
        <RoomGrid
          rooms={visibleRooms}
          tasks={tasks}
          onAdd={() => setShowRoomForm(true)}
          onSelect={room => {
            setSelectedRoomId(room.id);
            setView('room');
            setRoomIdFilter(room.id);
          }}
        />
      )}

      {view === 'room' && selectedRoom && (
        <>
          <button type="button" className={styles.backLink} onClick={() => setView('overview')}>
            ← All rooms
          </button>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <span
                className={styles.roomAccent}
                style={{
                  width: 12,
                  height: 12,
                  background: selectedRoom.color || '#6366f1',
                  marginTop: 0,
                }}
              />
              <div>
                <h3 className={styles.title} style={{ fontSize: 20 }}>
                  {selectedRoom.name}
                </h3>
                {selectedRoom.description && (
                  <p className={styles.subtitle}>{selectedRoom.description}</p>
                )}
              </div>
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`}
                onClick={() => {
                  setEditingRoom(selectedRoom);
                  setShowRoomForm(true);
                }}
              >
                Edit room
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                onClick={handleArchiveRoomToggle}
              >
                {selectedRoom.archived_at ? 'Unarchive' : 'Archive'}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
                onClick={() => setShowTaskForm(true)}
              >
                Add task
              </button>
            </div>
          </div>
          <TaskFiltersBar
            rooms={visibleRooms}
            roomId={selectedRoomId}
            priority={priority}
            status={status}
            sort={sort}
            showArchived={showArchived}
            hideRoomFilter
            onChange={next => {
              if (next.priority !== undefined) setPriority(next.priority);
              if (next.status !== undefined) setStatus(next.status);
              if (next.sort !== undefined) setSort(next.sort);
              if (next.showArchived !== undefined) setShowArchived(next.showArchived);
            }}
          />
          <TaskList
            tasks={filteredTasks}
            rooms={rooms}
            onSelect={setSelectedTask}
            emptyMessage="No tasks in this room yet. Add furnace filters, paint touch-ups, or projects."
          />
        </>
      )}

      {view === 'all-tasks' && (
        <>
          <TaskFiltersBar
            rooms={visibleRooms}
            roomId={roomIdFilter}
            priority={priority}
            status={status}
            sort={sort}
            showArchived={showArchived}
            onChange={next => {
              if (next.roomId !== undefined) setRoomIdFilter(next.roomId);
              if (next.priority !== undefined) setPriority(next.priority);
              if (next.status !== undefined) setStatus(next.status);
              if (next.sort !== undefined) setSort(next.sort);
              if (next.showArchived !== undefined) setShowArchived(next.showArchived);
            }}
          />
          <TaskList tasks={filteredTasks} rooms={rooms} onSelect={setSelectedTask} />
        </>
      )}

      {showRoomForm && (
        <RoomForm
          title={editingRoom ? 'Edit room' : 'Add room'}
          initial={editingRoom || undefined}
          onClose={() => {
            setShowRoomForm(false);
            setEditingRoom(null);
          }}
          onSubmit={editingRoom ? handleEditRoom : handleAddRoom}
        />
      )}

      {showTaskForm && activeRoomsForForms.length > 0 && (
        <TaskForm
          rooms={activeRoomsForForms}
          defaultRoomId={selectedRoomId || activeRoomsForForms[0].id}
          onClose={() => setShowTaskForm(false)}
          onSubmit={handleAddTask}
        />
      )}

      {selectedTask && (
        <TaskDetail
          task={tasks.find(t => t.id === selectedTask.id) || selectedTask}
          rooms={rooms}
          userId={user?.id}
          onClose={() => setSelectedTask(null)}
          onUpdated={updated => {
            setSelectedTask(updated);
            load();
          }}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
};

export default HouseHealth;
