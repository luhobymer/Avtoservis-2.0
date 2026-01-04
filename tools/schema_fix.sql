CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text,
  name text,
  role text DEFAULT 'client',
  phone text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY,
  settings jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  duration integer NOT NULL DEFAULT 60,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS category text;

CREATE TABLE IF NOT EXISTS public.parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 0;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS manufacturer text;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS part_number text;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS specifications jsonb;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS photo_url text;

CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_vin text,
  title text NOT NULL,
  description text,
  reminder_type text,
  due_date date,
  due_mileage integer,
  is_completed boolean DEFAULT false,
  is_recurring boolean DEFAULT false,
  recurrence_interval text,
  priority text DEFAULT 'medium',
  notification_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reminders_user_id_idx ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS reminders_due_date_idx ON public.reminders(due_date);

CREATE TABLE IF NOT EXISTS public.mileage_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id text,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  current_mileage integer,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS mileage_requests_user_idx ON public.mileage_requests(user_id);
CREATE INDEX IF NOT EXISTS mileage_requests_status_idx ON public.mileage_requests(status);

CREATE TABLE IF NOT EXISTS public.interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  sender_role text,
  sender_name text,
  recipient_id uuid NOT NULL,
  recipient_role text,
  recipient_name text,
  message text NOT NULL,
  type text DEFAULT 'message',
  status text DEFAULT 'unread',
  related_entity text,
  related_entity_id text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS interactions_sender_idx ON public.interactions(sender_id);
CREATE INDEX IF NOT EXISTS interactions_recipient_idx ON public.interactions(recipient_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_entity text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_entity_id text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data jsonb;
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON public.notifications(is_read);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_vin text,
  mechanic_id uuid,
  scheduled_time timestamptz NOT NULL,
  service_type text,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointments_user_idx ON public.appointments(user_id);
CREATE INDEX IF NOT EXISTS appointments_mechanic_time_idx ON public.appointments(mechanic_id, scheduled_time);

CREATE TABLE IF NOT EXISTS public.vehicle_makes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.vehicle_models (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  make_id bigint NOT NULL REFERENCES public.vehicle_makes(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE(make_id, name)
);

CREATE TABLE IF NOT EXISTS public.vehicles (
  vin text PRIMARY KEY,
  user_id uuid,
  make text,
  model text,
  year integer,
  license_plate text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicles_user_idx ON public.vehicles(user_id);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='admin_select_all_users'
  ) THEN
    CREATE POLICY admin_select_all_users ON public.users FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='self_select_user'
  ) THEN
    CREATE POLICY self_select_user ON public.users FOR SELECT USING (id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_settings' AND policyname='user_settings_select'
  ) THEN
    CREATE POLICY user_settings_select ON public.user_settings FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_settings' AND policyname='user_settings_upsert'
  ) THEN
    CREATE POLICY user_settings_upsert ON public.user_settings FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_settings' AND policyname='user_settings_update'
  ) THEN
    CREATE POLICY user_settings_update ON public.user_settings FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reminders' AND policyname='reminders_select'
  ) THEN
    CREATE POLICY reminders_select ON public.reminders FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reminders' AND policyname='reminders_insert'
  ) THEN
    CREATE POLICY reminders_insert ON public.reminders FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reminders' AND policyname='reminders_update'
  ) THEN
    CREATE POLICY reminders_update ON public.reminders FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mileage_requests' AND policyname='mileage_requests_select'
  ) THEN
    CREATE POLICY mileage_requests_select ON public.mileage_requests FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mileage_requests' AND policyname='mileage_requests_insert'
  ) THEN
    CREATE POLICY mileage_requests_insert ON public.mileage_requests FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='mileage_requests' AND policyname='mileage_requests_update'
  ) THEN
    CREATE POLICY mileage_requests_update ON public.mileage_requests FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='interactions' AND policyname='interactions_select'
  ) THEN
    CREATE POLICY interactions_select ON public.interactions FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='interactions' AND policyname='interactions_insert'
  ) THEN
    CREATE POLICY interactions_insert ON public.interactions FOR INSERT WITH CHECK (sender_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='interactions' AND policyname='interactions_update'
  ) THEN
    CREATE POLICY interactions_update ON public.interactions FOR UPDATE USING (sender_id = auth.uid() OR recipient_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_select'
  ) THEN
    CREATE POLICY notifications_select ON public.notifications FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_insert'
  ) THEN
    CREATE POLICY notifications_insert ON public.notifications FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_update'
  ) THEN
    CREATE POLICY notifications_update ON public.notifications FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointments' AND policyname='appointments_select'
  ) THEN
    CREATE POLICY appointments_select ON public.appointments FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointments' AND policyname='appointments_insert'
  ) THEN
    CREATE POLICY appointments_insert ON public.appointments FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointments' AND policyname='appointments_update'
  ) THEN
    CREATE POLICY appointments_update ON public.appointments FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicle_makes' AND policyname='vehicle_makes_select'
  ) THEN
    CREATE POLICY vehicle_makes_select ON public.vehicle_makes FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicle_models' AND policyname='vehicle_models_select'
  ) THEN
    CREATE POLICY vehicle_models_select ON public.vehicle_models FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='services' AND policyname='admin_select_services'
  ) THEN
    CREATE POLICY admin_select_services ON public.services FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='parts' AND policyname='admin_select_parts'
  ) THEN
    CREATE POLICY admin_select_parts ON public.parts FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));
  END IF;
END $$;

-- Push tokens schema and push trigger
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  token text NOT NULL,
  platform text NOT NULL,
  app_version text,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, device_id)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='push_tokens_rw'
  ) THEN
    CREATE POLICY push_tokens_rw ON public.push_tokens FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS http;

CREATE OR REPLACE FUNCTION public.expo_push_send(p_user_id uuid, p_title text, p_message text, p_data jsonb)
RETURNS void AS $$
DECLARE
  tok RECORD;
  req jsonb;
BEGIN
  FOR tok IN SELECT token FROM public.push_tokens WHERE user_id = p_user_id LOOP
    SELECT http_post(
      'https://exp.host/--/api/v2/push/send',
      jsonb_build_object('to', tok.token, 'title', p_title, 'body', p_message, 'data', coalesce(p_data, '{}'::jsonb))::text,
      array[http_header('Content-Type','application/json')]
    ) INTO req;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.on_notifications_insert()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status = 'pending' THEN
    PERFORM public.expo_push_send(NEW.user_id, NEW.title, NEW.message, NEW.data);
    UPDATE public.notifications SET status = 'sent' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notifications_push ON public.notifications;
CREATE TRIGGER trg_notifications_push
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.on_notifications_insert();
