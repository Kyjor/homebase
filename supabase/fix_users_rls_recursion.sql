-- Run in SQL Editor now.
-- Fixes: infinite recursion detected in policy for relation "users"

-- Helper bypasses RLS when reading the caller's household_id
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

-- Recreate users SELECT policy (this was the recursion)
DROP POLICY IF EXISTS users_select_own_or_household ON public.users;
CREATE POLICY users_select_own_or_household ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      public.current_user_household_id() IS NOT NULL
      AND household_id = public.current_user_household_id()
    )
  );

-- Household update
DROP POLICY IF EXISTS households_update ON public.households;
CREATE POLICY households_update ON public.households
  FOR UPDATE TO authenticated
  USING (id = public.current_user_household_id());

-- Household-scoped tables
DROP POLICY IF EXISTS categories_all ON public.categories;
CREATE POLICY categories_all ON public.categories FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

DROP POLICY IF EXISTS budgets_all ON public.budgets;
CREATE POLICY budgets_all ON public.budgets FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

DROP POLICY IF EXISTS shopping_lists_all ON public.shopping_lists;
CREATE POLICY shopping_lists_all ON public.shopping_lists FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

DROP POLICY IF EXISTS shopping_list_all ON public.shopping_list;
CREATE POLICY shopping_list_all ON public.shopping_list FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

DROP POLICY IF EXISTS expenses_all ON public.expenses;
CREATE POLICY expenses_all ON public.expenses FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

DROP POLICY IF EXISTS recurring_payments_all ON public.recurring_payments;
CREATE POLICY recurring_payments_all ON public.recurring_payments FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

DROP POLICY IF EXISTS reminders_all ON public.reminders;
CREATE POLICY reminders_all ON public.reminders FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

DROP POLICY IF EXISTS rooms_all ON public.rooms;
CREATE POLICY rooms_all ON public.rooms FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

DROP POLICY IF EXISTS house_tasks_all ON public.house_tasks;
CREATE POLICY house_tasks_all ON public.house_tasks FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

DROP POLICY IF EXISTS task_completions_all ON public.task_completions;
CREATE POLICY task_completions_all ON public.task_completions FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

DROP POLICY IF EXISTS task_attachments_all ON public.task_attachments;
CREATE POLICY task_attachments_all ON public.task_attachments FOR ALL TO authenticated
  USING (household_id = public.current_user_household_id())
  WITH CHECK (household_id = public.current_user_household_id());

-- Storage policies
DROP POLICY IF EXISTS house_health_storage_select ON storage.objects;
CREATE POLICY house_health_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'house-health'
    AND (storage.foldername(name))[1] = public.current_user_household_id()::text
  );

DROP POLICY IF EXISTS house_health_storage_insert ON storage.objects;
CREATE POLICY house_health_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'house-health'
    AND (storage.foldername(name))[1] = public.current_user_household_id()::text
  );

DROP POLICY IF EXISTS house_health_storage_update ON storage.objects;
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

DROP POLICY IF EXISTS house_health_storage_delete ON storage.objects;
CREATE POLICY house_health_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'house-health'
    AND (storage.foldername(name))[1] = public.current_user_household_id()::text
  );
