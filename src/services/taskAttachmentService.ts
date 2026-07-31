import supabase from './supabaseClient';
import { TaskAttachment } from '../types';

const BUCKET = 'house-health';

export async function getAttachmentsForTask(taskId: string): Promise<TaskAttachment[]> {
  const { data, error } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as TaskAttachment[];
}

export async function getAttachmentsForCompletion(
  completionId: string
): Promise<TaskAttachment[]> {
  const { data, error } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('completion_id', completionId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as TaskAttachment[];
}

export async function uploadAttachment(input: {
  householdId: string;
  taskId?: string | null;
  completionId?: string | null;
  file: File;
  createdBy?: string | null;
}): Promise<TaskAttachment> {
  const { householdId, taskId, completionId, file, createdBy } = input;
  if (!taskId && !completionId) {
    throw new Error('Attachment must belong to a task or completion');
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const parent = taskId || completionId;
  const path = `${householdId}/${parent}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from('task_attachments')
    .insert({
      household_id: householdId,
      task_id: taskId ?? null,
      completion_id: completionId ?? null,
      storage_path: path,
      mime_type: file.type,
      created_by: createdBy ?? null,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }

  return data as TaskAttachment;
}

export async function deleteAttachment(attachment: TaskAttachment): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([attachment.storage_path]);
  if (storageError) throw new Error(storageError.message);

  const { error } = await supabase
    .from('task_attachments')
    .delete()
    .eq('id', attachment.id);
  if (error) throw new Error(error.message);
}

export async function getAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
