import supabase from './supabaseClient';
import { HouseTask, TaskCompletion } from '../types';
import { computeNextDue } from '../utils/houseHealth';

export async function getTasksByHousehold(
  householdId: string,
  includeArchived = false
): Promise<HouseTask[]> {
  let query = supabase
    .from('house_tasks')
    .select('*')
    .eq('household_id', householdId)
    .order('priority', { ascending: true })
    .order('next_due', { ascending: true, nullsFirst: false });

  if (!includeArchived) {
    query = query.is('archived_at', null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as HouseTask[];
}

export async function getTasksByRoom(
  roomId: string,
  includeArchived = false
): Promise<HouseTask[]> {
  let query = supabase
    .from('house_tasks')
    .select('*')
    .eq('room_id', roomId)
    .order('next_due', { ascending: true, nullsFirst: false });

  if (!includeArchived) {
    query = query.is('archived_at', null);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as HouseTask[];
}

export async function addTask(
  task: Omit<HouseTask, 'id' | 'created_at' | 'updated_at' | 'archived_at' | 'last_completed_at'>
): Promise<HouseTask> {
  const { data, error } = await supabase
    .from('house_tasks')
    .insert(task)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as HouseTask;
}

export async function updateTask(id: string, updates: Partial<HouseTask>): Promise<HouseTask> {
  const { data, error } = await supabase
    .from('house_tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as HouseTask;
}

export async function archiveTask(id: string): Promise<HouseTask> {
  return updateTask(id, {
    archived_at: new Date().toISOString(),
    status: 'archived',
  });
}

export async function unarchiveTask(id: string): Promise<HouseTask> {
  return updateTask(id, { archived_at: null, status: 'open' });
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('house_tasks').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getCompletionsByTask(taskId: string): Promise<TaskCompletion[]> {
  const { data, error } = await supabase
    .from('task_completions')
    .select('*')
    .eq('task_id', taskId)
    .order('completed_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as TaskCompletion[];
}

export async function completeTask(input: {
  task: HouseTask;
  completed_at: string;
  cost?: number | null;
  notes?: string | null;
  completed_by?: string | null;
}): Promise<{ completion: TaskCompletion; task: HouseTask }> {
  const { task, completed_at, cost, notes, completed_by } = input;

  const { data: completion, error } = await supabase
    .from('task_completions')
    .insert({
      task_id: task.id,
      household_id: task.household_id,
      completed_at,
      cost: cost ?? null,
      notes: notes ?? null,
      completed_by: completed_by ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // DB trigger also updates the task; refresh for the client
  const next_due = computeNextDue(completed_at, task.frequency, task.interval_days);
  const { data: updated, error: updateError } = await supabase
    .from('house_tasks')
    .select('*')
    .eq('id', task.id)
    .single();

  if (updateError) {
    // Fallback if select fails: return optimistic shape
    return {
      completion: completion as TaskCompletion,
      task: {
        ...task,
        last_completed_at: completed_at,
        next_due,
      },
    };
  }

  return {
    completion: completion as TaskCompletion,
    task: updated as HouseTask,
  };
}
