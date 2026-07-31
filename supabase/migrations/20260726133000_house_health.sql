-- House Health: rooms, tasks, completions, attachments

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  color text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rooms_household_name_active_uidx
  ON public.rooms (household_id, name)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS rooms_household_id_idx ON public.rooms (household_id);
CREATE INDEX IF NOT EXISTS rooms_household_archived_idx ON public.rooms (household_id, archived_at);

CREATE TABLE IF NOT EXISTS public.house_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  estimated_cost numeric(12, 2),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'paused', 'archived')),
  frequency text NOT NULL DEFAULT 'none'
    CHECK (frequency IN ('none', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
  interval_days integer
    CHECK (interval_days IS NULL OR interval_days > 0),
  next_due date,
  last_completed_at date,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT house_tasks_custom_interval_chk CHECK (
    (frequency <> 'custom') OR (interval_days IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS house_tasks_household_room_idx
  ON public.house_tasks (household_id, room_id);
CREATE INDEX IF NOT EXISTS house_tasks_household_priority_idx
  ON public.house_tasks (household_id, priority);
CREATE INDEX IF NOT EXISTS house_tasks_household_next_due_idx
  ON public.house_tasks (household_id, next_due);
CREATE INDEX IF NOT EXISTS house_tasks_household_active_idx
  ON public.house_tasks (household_id)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.house_tasks(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  completed_at date NOT NULL DEFAULT (CURRENT_DATE),
  cost numeric(12, 2),
  notes text,
  completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_completions_task_completed_idx
  ON public.task_completions (task_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS task_completions_household_idx
  ON public.task_completions (household_id);

CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.house_tasks(id) ON DELETE CASCADE,
  completion_id uuid REFERENCES public.task_completions(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  mime_type text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_attachments_parent_chk CHECK (
    task_id IS NOT NULL OR completion_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS task_attachments_task_idx ON public.task_attachments (task_id);
CREATE INDEX IF NOT EXISTS task_attachments_completion_idx ON public.task_attachments (completion_id);
CREATE INDEX IF NOT EXISTS task_attachments_household_idx ON public.task_attachments (household_id);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rooms_set_updated_at ON public.rooms;
CREATE TRIGGER rooms_set_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS house_tasks_set_updated_at ON public.house_tasks;
CREATE TRIGGER house_tasks_set_updated_at
  BEFORE UPDATE ON public.house_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Completion → refresh last_completed_at + next_due
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_task_after_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  t public.house_tasks%ROWTYPE;
  next_date date;
BEGIN
  SELECT * INTO t FROM public.house_tasks WHERE id = NEW.task_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  next_date := NULL;
  IF t.frequency = 'weekly' THEN
    next_date := NEW.completed_at + 7;
  ELSIF t.frequency = 'monthly' THEN
    next_date := NEW.completed_at + INTERVAL '1 month';
  ELSIF t.frequency = 'quarterly' THEN
    next_date := NEW.completed_at + INTERVAL '3 months';
  ELSIF t.frequency = 'yearly' THEN
    next_date := NEW.completed_at + INTERVAL '1 year';
  ELSIF t.frequency = 'custom' AND t.interval_days IS NOT NULL THEN
    next_date := NEW.completed_at + (t.interval_days || ' days')::interval;
  END IF;
  -- frequency = 'none' → next_due cleared

  UPDATE public.house_tasks
  SET
    last_completed_at = NEW.completed_at,
    next_due = next_date,
    updated_at = now()
  WHERE id = NEW.task_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_completions_refresh_task ON public.task_completions;
CREATE TRIGGER task_completions_refresh_task
  AFTER INSERT ON public.task_completions
  FOR EACH ROW EXECUTE FUNCTION public.refresh_task_after_completion();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Membership check: users.household_id matches row.household_id
DROP POLICY IF EXISTS rooms_select ON public.rooms;
CREATE POLICY rooms_select ON public.rooms
  FOR SELECT TO authenticated
  USING (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS rooms_insert ON public.rooms;
CREATE POLICY rooms_insert ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS rooms_update ON public.rooms;
CREATE POLICY rooms_update ON public.rooms
  FOR UPDATE TO authenticated
  USING (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS rooms_delete ON public.rooms;
CREATE POLICY rooms_delete ON public.rooms
  FOR DELETE TO authenticated
  USING (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS house_tasks_select ON public.house_tasks;
CREATE POLICY house_tasks_select ON public.house_tasks
  FOR SELECT TO authenticated
  USING (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS house_tasks_insert ON public.house_tasks;
CREATE POLICY house_tasks_insert ON public.house_tasks
  FOR INSERT TO authenticated
  WITH CHECK (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS house_tasks_update ON public.house_tasks;
CREATE POLICY house_tasks_update ON public.house_tasks
  FOR UPDATE TO authenticated
  USING (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS house_tasks_delete ON public.house_tasks;
CREATE POLICY house_tasks_delete ON public.house_tasks
  FOR DELETE TO authenticated
  USING (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS task_completions_select ON public.task_completions;
CREATE POLICY task_completions_select ON public.task_completions
  FOR SELECT TO authenticated
  USING (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS task_completions_insert ON public.task_completions;
CREATE POLICY task_completions_insert ON public.task_completions
  FOR INSERT TO authenticated
  WITH CHECK (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS task_completions_update ON public.task_completions;
CREATE POLICY task_completions_update ON public.task_completions
  FOR UPDATE TO authenticated
  USING (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS task_completions_delete ON public.task_completions;
CREATE POLICY task_completions_delete ON public.task_completions
  FOR DELETE TO authenticated
  USING (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS task_attachments_select ON public.task_attachments;
CREATE POLICY task_attachments_select ON public.task_attachments
  FOR SELECT TO authenticated
  USING (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS task_attachments_insert ON public.task_attachments;
CREATE POLICY task_attachments_insert ON public.task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS task_attachments_update ON public.task_attachments;
CREATE POLICY task_attachments_update ON public.task_attachments
  FOR UPDATE TO authenticated
  USING (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS task_attachments_delete ON public.task_attachments;
CREATE POLICY task_attachments_delete ON public.task_attachments
  FOR DELETE TO authenticated
  USING (household_id IN (SELECT household_id FROM public.users WHERE id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage bucket + policies
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'house-health',
  'house-health',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS house_health_storage_select ON storage.objects;
CREATE POLICY house_health_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'house-health'
    AND (storage.foldername(name))[1] IN (
      SELECT household_id::text FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS house_health_storage_insert ON storage.objects;
CREATE POLICY house_health_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'house-health'
    AND (storage.foldername(name))[1] IN (
      SELECT household_id::text FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS house_health_storage_update ON storage.objects;
CREATE POLICY house_health_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'house-health'
    AND (storage.foldername(name))[1] IN (
      SELECT household_id::text FROM public.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'house-health'
    AND (storage.foldername(name))[1] IN (
      SELECT household_id::text FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS house_health_storage_delete ON storage.objects;
CREATE POLICY house_health_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'house-health'
    AND (storage.foldername(name))[1] IN (
      SELECT household_id::text FROM public.users WHERE id = auth.uid()
    )
  );
