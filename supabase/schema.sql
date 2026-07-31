-- =============================================================================
-- Homebase / Homeplan — full Supabase schema bootstrap
-- Run this once in the Supabase SQL Editor on a fresh project.
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- Core: households + users
-- =============================================================================

CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Profile row mirrors auth.users; id must match auth.uid()
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  household_id uuid REFERENCES public.households(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_household_id_idx ON public.users (household_id);
CREATE INDEX users_email_idx ON public.users (email);

-- Auto-create public.users when someone signs up (bypasses RLS; client insert often has no session yet)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Finance
-- =============================================================================

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'custom'
    CHECK (type IN ('default', 'custom')),
  color text,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX categories_household_name_uidx
  ON public.categories (household_id, name);
CREATE INDEX categories_household_id_idx ON public.categories (household_id);

CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  month text NOT NULL, -- YYYY-MM
  limit_amount numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (limit_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budgets_month_format_chk CHECK (month ~ '^\d{4}-\d{2}$')
);

CREATE UNIQUE INDEX budgets_household_category_month_uidx
  ON public.budgets (household_id, category_id, month);
CREATE INDEX budgets_household_id_idx ON public.budgets (household_id);

CREATE TABLE public.shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shopping_lists_household_id_idx ON public.shopping_lists (household_id);

-- Legacy flat shopping items table (kept for older ShoppingList.tsx path)
CREATE TABLE public.shopping_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  is_purchased boolean NOT NULL DEFAULT false,
  purchased_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shopping_list_household_id_idx ON public.shopping_list (household_id);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  item_name text NOT NULL,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  notes text,
  is_recurring boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  shopping_list_id uuid REFERENCES public.shopping_lists(id) ON DELETE SET NULL,
  is_purchased boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expenses_household_id_idx ON public.expenses (household_id);
CREATE INDEX expenses_household_date_idx ON public.expenses (household_id, date DESC);
CREATE INDEX expenses_shopping_list_id_idx ON public.expenses (shopping_list_id);

CREATE TABLE public.recurring_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  description text NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('monthly', 'weekly', 'custom')),
  next_due date NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled')),
  last_logged date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recurring_payments_household_id_idx ON public.recurring_payments (household_id);

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  date date NOT NULL,
  time text, -- HH:MM
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reminders_household_id_idx ON public.reminders (household_id);
CREATE INDEX reminders_household_date_idx ON public.reminders (household_id, date);

-- =============================================================================
-- House Health
-- =============================================================================

CREATE TABLE public.rooms (
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

CREATE UNIQUE INDEX rooms_household_name_active_uidx
  ON public.rooms (household_id, name)
  WHERE archived_at IS NULL;
CREATE INDEX rooms_household_id_idx ON public.rooms (household_id);

CREATE TABLE public.house_tasks (
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

CREATE INDEX house_tasks_household_room_idx ON public.house_tasks (household_id, room_id);
CREATE INDEX house_tasks_household_priority_idx ON public.house_tasks (household_id, priority);
CREATE INDEX house_tasks_household_next_due_idx ON public.house_tasks (household_id, next_due);

CREATE TABLE public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.house_tasks(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  completed_at date NOT NULL DEFAULT CURRENT_DATE,
  cost numeric(12, 2),
  notes text,
  completed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_completions_task_completed_idx
  ON public.task_completions (task_id, completed_at DESC);
CREATE INDEX task_completions_household_idx ON public.task_completions (household_id);

CREATE TABLE public.task_attachments (
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

CREATE INDEX task_attachments_task_idx ON public.task_attachments (task_id);
CREATE INDEX task_attachments_completion_idx ON public.task_attachments (completion_id);
CREATE INDEX task_attachments_household_idx ON public.task_attachments (household_id);

-- =============================================================================
-- Helpers / triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER shopping_lists_set_updated_at
  BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER rooms_set_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER house_tasks_set_updated_at
  BEFORE UPDATE ON public.house_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- After a completion: refresh last_completed_at + next_due on the task
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
    next_date := (NEW.completed_at + INTERVAL '7 days')::date;
  ELSIF t.frequency = 'monthly' THEN
    next_date := (NEW.completed_at + INTERVAL '1 month')::date;
  ELSIF t.frequency = 'quarterly' THEN
    next_date := (NEW.completed_at + INTERVAL '3 months')::date;
  ELSIF t.frequency = 'yearly' THEN
    next_date := (NEW.completed_at + INTERVAL '1 year')::date;
  ELSIF t.frequency = 'custom' AND t.interval_days IS NOT NULL THEN
    next_date := (NEW.completed_at + (t.interval_days || ' days')::interval)::date;
  END IF;

  UPDATE public.house_tasks
  SET
    last_completed_at = NEW.completed_at,
    next_due = next_date,
    updated_at = now()
  WHERE id = NEW.task_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_completions_refresh_task
  AFTER INSERT ON public.task_completions
  FOR EACH ROW EXECUTE FUNCTION public.refresh_task_after_completion();

-- Seed default categories when a household is created
CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (household_id, name, type) VALUES
    (NEW.id, 'Groceries', 'default'),
    (NEW.id, 'Utilities', 'default'),
    (NEW.id, 'Rent/Mortgage', 'default'),
    (NEW.id, 'Transport', 'default'),
    (NEW.id, 'Entertainment', 'default'),
    (NEW.id, 'Other', 'default');
  RETURN NEW;
END;
$$;

CREATE TRIGGER households_seed_categories
  AFTER INSERT ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_categories();

-- =============================================================================
-- RLS
-- Use SECURITY DEFINER helper so policies never re-query public.users under RLS
-- (avoids "infinite recursion detected in policy for relation users")
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_user_household_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.users WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_household_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_household_id() TO authenticated;

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY users_select_own_or_household ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      public.current_user_household_id() IS NOT NULL
      AND household_id = public.current_user_household_id()
    )
  );

CREATE POLICY users_insert_own ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- households: authenticated can read (needed to join via invite UUID);
-- any authenticated can create; members can update
CREATE POLICY households_select ON public.households
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY households_insert ON public.households
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY households_update ON public.households
  FOR UPDATE TO authenticated
  USING (id = public.current_user_household_id());

-- Generic household-scoped policies
CREATE POLICY categories_all ON public.categories FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

CREATE POLICY budgets_all ON public.budgets FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

CREATE POLICY shopping_lists_all ON public.shopping_lists FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

CREATE POLICY shopping_list_all ON public.shopping_list FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

CREATE POLICY expenses_all ON public.expenses FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

CREATE POLICY recurring_payments_all ON public.recurring_payments FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

CREATE POLICY reminders_all ON public.reminders FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

CREATE POLICY rooms_all ON public.rooms FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

CREATE POLICY house_tasks_all ON public.house_tasks FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

CREATE POLICY task_completions_all ON public.task_completions FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

CREATE POLICY task_attachments_all ON public.task_attachments FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

-- =============================================================================
-- Storage (House Health photos)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'house-health',
  'house-health',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY house_health_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'house-health'
    AND (storage.foldername(name))[1] = public.current_user_household_id()::text
  );

CREATE POLICY house_health_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'house-health'
    AND (storage.foldername(name))[1] = public.current_user_household_id()::text
  );

CREATE POLICY house_health_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'house-health'
    AND (storage.foldername(name))[1] = public.current_user_household_id()::text
  )
  WITH CHECK (
    bucket_id = 'house-health'
    AND (storage.foldername(name))[1] = public.current_user_household_id()::text
  );

CREATE POLICY house_health_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'house-health'
    AND (storage.foldername(name))[1] = public.current_user_household_id()::text
  );

-- =============================================================================
-- Realtime (tables the app subscribes to)
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.budgets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.house_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_completions;
