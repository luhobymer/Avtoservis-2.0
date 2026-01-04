CREATE OR REPLACE FUNCTION public.apply_schema_fix() RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE ops jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    EXECUTE 'CREATE TABLE public.users (id uuid PRIMARY KEY, email text, name text, role text DEFAULT ''client'', phone text, active boolean DEFAULT true, created_at timestamptz DEFAULT now())';
    ops := ops || jsonb_build_array(jsonb_build_object('create','users'));
  END IF;
  IF to_regclass('public.user_settings') IS NULL THEN
    EXECUTE 'CREATE TABLE public.user_settings (user_id uuid PRIMARY KEY, settings jsonb NOT NULL, updated_at timestamptz DEFAULT now())';
    ops := ops || jsonb_build_array(jsonb_build_object('create','user_settings'));
  END IF;
  IF to_regclass('public.services') IS NULL THEN
    EXECUTE 'CREATE TABLE public.services (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, price numeric(12,2) NOT NULL DEFAULT 0, duration integer NOT NULL DEFAULT 60, created_at timestamptz DEFAULT now())';
    ops := ops || jsonb_build_array(jsonb_build_object('create','services'));
  END IF;
  IF to_regclass('public.parts') IS NULL THEN
    EXECUTE 'CREATE TABLE public.parts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, price numeric(12,2) NOT NULL DEFAULT 0, stock integer NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now())';
    ops := ops || jsonb_build_array(jsonb_build_object('create','parts'));
  END IF;
  IF to_regclass('public.reminders') IS NULL THEN
    EXECUTE 'CREATE TABLE public.reminders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, vehicle_vin text, title text NOT NULL, description text, reminder_type text, due_date date, due_mileage integer, is_completed boolean DEFAULT false, is_recurring boolean DEFAULT false, recurrence_interval text, priority text DEFAULT ''medium'', notification_sent boolean DEFAULT false, created_at timestamptz DEFAULT now())';
    EXECUTE 'CREATE INDEX IF NOT EXISTS reminders_user_id_idx ON public.reminders(user_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS reminders_due_date_idx ON public.reminders(due_date)';
    ops := ops || jsonb_build_array(jsonb_build_object('create','reminders'));
  END IF;
  IF to_regclass('public.mileage_requests') IS NULL THEN
    EXECUTE 'CREATE TABLE public.mileage_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, vehicle_id text, vehicle_make text, vehicle_model text, vehicle_year integer, current_mileage integer, status text DEFAULT ''pending'', created_at timestamptz DEFAULT now(), updated_at timestamptz)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS mileage_requests_user_idx ON public.mileage_requests(user_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS mileage_requests_status_idx ON public.mileage_requests(status)';
    ops := ops || jsonb_build_array(jsonb_build_object('create','mileage_requests'));
  END IF;
  IF to_regclass('public.interactions') IS NULL THEN
    EXECUTE 'CREATE TABLE public.interactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid NOT NULL, sender_role text, sender_name text, recipient_id uuid NOT NULL, recipient_role text, recipient_name text, message text NOT NULL, type text DEFAULT ''message'', status text DEFAULT ''unread'', related_entity text, related_entity_id text, created_at timestamptz DEFAULT now())';
    EXECUTE 'CREATE INDEX IF NOT EXISTS interactions_sender_idx ON public.interactions(sender_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS interactions_recipient_idx ON public.interactions(recipient_id)';
    ops := ops || jsonb_build_array(jsonb_build_object('create','interactions'));
  END IF;
  IF to_regclass('public.notifications') IS NULL THEN
    EXECUTE 'CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, title text NOT NULL, message text NOT NULL, is_read boolean DEFAULT false, created_at timestamptz DEFAULT now())';
    EXECUTE 'CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS notifications_read_idx ON public.notifications(is_read)';
    ops := ops || jsonb_build_array(jsonb_build_object('create','notifications'));
  END IF;
  IF to_regclass('public.appointments') IS NULL THEN
    EXECUTE 'CREATE TABLE public.appointments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, vehicle_vin text, mechanic_id uuid, scheduled_time timestamptz NOT NULL, service_type text, status text DEFAULT ''pending'', notes text, created_at timestamptz DEFAULT now())';
    EXECUTE 'CREATE INDEX IF NOT EXISTS appointments_user_idx ON public.appointments(user_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS appointments_mechanic_time_idx ON public.appointments(mechanic_id, scheduled_time)';
    ops := ops || jsonb_build_array(jsonb_build_object('create','appointments'));
  END IF;
  IF to_regclass('public.vehicle_makes') IS NULL THEN
    EXECUTE 'CREATE TABLE public.vehicle_makes (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text NOT NULL UNIQUE)';
    ops := ops || jsonb_build_array(jsonb_build_object('create','vehicle_makes'));
  END IF;
  IF to_regclass('public.vehicle_models') IS NULL THEN
    EXECUTE 'CREATE TABLE public.vehicle_models (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, make_id bigint NOT NULL REFERENCES public.vehicle_makes(id) ON DELETE CASCADE, name text NOT NULL, UNIQUE(make_id, name))';
    ops := ops || jsonb_build_array(jsonb_build_object('create','vehicle_models'));
  END IF;

  PERFORM 1 FROM pg_class WHERE relname='users' AND relrowsecurity;
  IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY'; END IF;
  PERFORM 1 FROM pg_class WHERE relname='user_settings' AND relrowsecurity;
  IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY'; END IF;
  PERFORM 1 FROM pg_class WHERE relname='services' AND relrowsecurity;
  IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.services ENABLE ROW LEVEL SECURITY'; END IF;
  PERFORM 1 FROM pg_class WHERE relname='parts' AND relrowsecurity;
  IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY'; END IF;
  PERFORM 1 FROM pg_class WHERE relname='reminders' AND relrowsecurity;
  IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY'; END IF;
  PERFORM 1 FROM pg_class WHERE relname='mileage_requests' AND relrowsecurity;
  IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.mileage_requests ENABLE ROW LEVEL SECURITY'; END IF;
  PERFORM 1 FROM pg_class WHERE relname='interactions' AND relrowsecurity;
  IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY'; END IF;
  PERFORM 1 FROM pg_class WHERE relname='notifications' AND relrowsecurity;
  IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY'; END IF;
  PERFORM 1 FROM pg_class WHERE relname='appointments' AND relrowsecurity;
  IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY'; END IF;
  PERFORM 1 FROM pg_class WHERE relname='vehicle_makes' AND relrowsecurity;
  IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.vehicle_makes ENABLE ROW LEVEL SECURITY'; END IF;
  PERFORM 1 FROM pg_class WHERE relname='vehicle_models' AND relrowsecurity;
  IF NOT FOUND THEN EXECUTE 'ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='admin_select_all_users') THEN
    EXECUTE 'CREATE POLICY admin_select_all_users ON public.users FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''admin''))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='self_select_user') THEN
    EXECUTE 'CREATE POLICY self_select_user ON public.users FOR SELECT USING (id = auth.uid())';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_settings' AND policyname='user_settings_select') THEN
    EXECUTE 'CREATE POLICY user_settings_select ON public.user_settings FOR SELECT USING (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_settings' AND policyname='user_settings_upsert') THEN
    EXECUTE 'CREATE POLICY user_settings_upsert ON public.user_settings FOR INSERT WITH CHECK (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_settings' AND policyname='user_settings_update') THEN
    EXECUTE 'CREATE POLICY user_settings_update ON public.user_settings FOR UPDATE USING (user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reminders' AND policyname='reminders_select') THEN
    EXECUTE 'CREATE POLICY reminders_select ON public.reminders FOR SELECT USING (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reminders' AND policyname='reminders_insert') THEN
    EXECUTE 'CREATE POLICY reminders_insert ON public.reminders FOR INSERT WITH CHECK (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reminders' AND policyname='reminders_update') THEN
    EXECUTE 'CREATE POLICY reminders_update ON public.reminders FOR UPDATE USING (user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mileage_requests' AND policyname='mileage_requests_select') THEN
    EXECUTE 'CREATE POLICY mileage_requests_select ON public.mileage_requests FOR SELECT USING (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mileage_requests' AND policyname='mileage_requests_insert') THEN
    EXECUTE 'CREATE POLICY mileage_requests_insert ON public.mileage_requests FOR INSERT WITH CHECK (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mileage_requests' AND policyname='mileage_requests_update') THEN
    EXECUTE 'CREATE POLICY mileage_requests_update ON public.mileage_requests FOR UPDATE USING (user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='interactions' AND policyname='interactions_select') THEN
    EXECUTE 'CREATE POLICY interactions_select ON public.interactions FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='interactions' AND policyname='interactions_insert') THEN
    EXECUTE 'CREATE POLICY interactions_insert ON public.interactions FOR INSERT WITH CHECK (sender_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='interactions' AND policyname='interactions_update') THEN
    EXECUTE 'CREATE POLICY interactions_update ON public.interactions FOR UPDATE USING (sender_id = auth.uid() OR recipient_id = auth.uid())';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_select') THEN
    EXECUTE 'CREATE POLICY notifications_select ON public.notifications FOR SELECT USING (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_insert') THEN
    EXECUTE 'CREATE POLICY notifications_insert ON public.notifications FOR INSERT WITH CHECK (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_update') THEN
    EXECUTE 'CREATE POLICY notifications_update ON public.notifications FOR UPDATE USING (user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointments' AND policyname='appointments_select') THEN
    EXECUTE 'CREATE POLICY appointments_select ON public.appointments FOR SELECT USING (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointments' AND policyname='appointments_insert') THEN
    EXECUTE 'CREATE POLICY appointments_insert ON public.appointments FOR INSERT WITH CHECK (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointments' AND policyname='appointments_update') THEN
    EXECUTE 'CREATE POLICY appointments_update ON public.appointments FOR UPDATE USING (user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicle_makes' AND policyname='vehicle_makes_select') THEN
    EXECUTE 'CREATE POLICY vehicle_makes_select ON public.vehicle_makes FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicle_models' AND policyname='vehicle_models_select') THEN
    EXECUTE 'CREATE POLICY vehicle_models_select ON public.vehicle_models FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='services' AND policyname='admin_select_services') THEN
    EXECUTE 'CREATE POLICY admin_select_services ON public.services FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''admin''))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='parts' AND policyname='admin_select_parts') THEN
    EXECUTE 'CREATE POLICY admin_select_parts ON public.parts FOR SELECT USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''admin''))';
  END IF;

  RETURN ops::json;
END $$;
