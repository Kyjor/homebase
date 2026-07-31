import { HouseTask, Room, TaskPriority } from '../types';

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 20,
  high: 12,
  medium: 7,
  low: 3,
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysUntil(dateStr: string | null | undefined, today = todayISO()): number | null {
  if (!dateStr) return null;
  const a = new Date(today + 'T00:00:00');
  const b = new Date(dateStr + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function isOverdue(task: HouseTask, today = todayISO()): boolean {
  if (task.status !== 'open' || task.archived_at || !task.next_due) return false;
  return task.next_due < today;
}

export function isDueSoon(task: HouseTask, withinDays = 14, today = todayISO()): boolean {
  if (task.status !== 'open' || task.archived_at || !task.next_due) return false;
  const d = daysUntil(task.next_due, today);
  return d !== null && d >= 0 && d <= withinDays;
}

export function computeNextDue(
  completedAt: string,
  frequency: HouseTask['frequency'],
  intervalDays?: number | null
): string | null {
  const base = new Date(completedAt + 'T00:00:00');
  if (Number.isNaN(base.getTime())) return null;

  switch (frequency) {
    case 'none':
      return null;
    case 'weekly':
      base.setDate(base.getDate() + 7);
      break;
    case 'monthly':
      base.setMonth(base.getMonth() + 1);
      break;
    case 'quarterly':
      base.setMonth(base.getMonth() + 3);
      break;
    case 'yearly':
      base.setFullYear(base.getFullYear() + 1);
      break;
    case 'custom':
      if (!intervalDays || intervalDays <= 0) return null;
      base.setDate(base.getDate() + intervalDays);
      break;
    default:
      return null;
  }
  return base.toISOString().slice(0, 10);
}

export function roomHealthScore(tasks: HouseTask[], today = todayISO()): number {
  const active = tasks.filter(t => !t.archived_at && t.status !== 'archived');
  let score = 100;
  for (const task of active) {
    if (task.status !== 'open') continue;
    const weight = PRIORITY_WEIGHT[task.priority] ?? 7;
    if (isOverdue(task, today)) {
      score -= weight;
    } else if (isDueSoon(task, 14, today)) {
      score -= weight / 2;
    }
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function householdHealthScore(
  rooms: Room[],
  tasks: HouseTask[],
  today = todayISO()
): number {
  const activeRooms = rooms.filter(r => !r.archived_at);
  if (activeRooms.length === 0) return 100;
  const total = activeRooms.reduce((sum, room) => {
    const roomTasks = tasks.filter(t => t.room_id === room.id);
    return sum + roomHealthScore(roomTasks, today);
  }, 0);
  return Math.round(total / activeRooms.length);
}

export type TaskFilterStatus = 'open' | 'overdue' | 'paused' | 'all';
export type TaskSortKey = 'priority' | 'next_due' | 'estimated_cost';

export interface TaskFilters {
  roomId?: string | null;
  priority?: TaskPriority | 'all';
  status?: TaskFilterStatus;
  showArchived?: boolean;
  sort?: TaskSortKey;
}

export function filterAndSortTasks(
  tasks: HouseTask[],
  filters: TaskFilters,
  today = todayISO()
): HouseTask[] {
  const {
    roomId = null,
    priority = 'all',
    status = 'all',
    showArchived = false,
    sort = 'priority',
  } = filters;

  let result = tasks.filter(t => {
    if (!showArchived && (t.archived_at || t.status === 'archived')) return false;
    if (roomId && t.room_id !== roomId) return false;
    if (priority !== 'all' && t.priority !== priority) return false;
    if (status === 'open' && (t.status !== 'open' || isOverdue(t, today))) return false;
    if (status === 'overdue' && !isOverdue(t, today)) return false;
    if (status === 'paused' && t.status !== 'paused') return false;
    return true;
  });

  result = [...result].sort((a, b) => {
    if (sort === 'priority') {
      const diff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (diff !== 0) return diff;
      return (a.next_due || '9999').localeCompare(b.next_due || '9999');
    }
    if (sort === 'next_due') {
      return (a.next_due || '9999').localeCompare(b.next_due || '9999');
    }
    const ac = a.estimated_cost ?? -1;
    const bc = b.estimated_cost ?? -1;
    return bc - ac;
  });

  return result;
}

export function countOpen(tasks: HouseTask[]): number {
  return tasks.filter(t => !t.archived_at && t.status === 'open').length;
}

export function countOverdue(tasks: HouseTask[], today = todayISO()): number {
  return tasks.filter(t => isOverdue(t, today)).length;
}

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#6366f1',
  low: '#64748b',
};

export const ROOM_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#14b8a6',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#a855f7',
];
