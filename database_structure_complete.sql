-- ПОВНА СТРУКТУРА БАЗИ ДАНИХ АВТОСЕРВІСУ
-- Згенеровано автоматично з усіх файлів міграцій та структури
-- Дата створення: $(date)

-- ========================================
-- ОСНОВНІ ТАБЛИЦІ
-- ========================================

-- Таблиця користувачів
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'client',
  profile_id UUID,
  two_factor_secret TEXT,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_pending BOOLEAN DEFAULT FALSE,
  recovery_codes TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця refresh токенів
CREATE TABLE public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Таблиця транспортних засобів
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vin VARCHAR(17) UNIQUE NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  color VARCHAR(50),
  license_plate VARCHAR(20),
  mileage INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця запитів на пробіг
CREATE TABLE public.mileage_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_vin VARCHAR(17) NOT NULL,
  user_id UUID NOT NULL,
  current_mileage INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT mileage_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT mileage_requests_vehicle_vin_fkey FOREIGN KEY (vehicle_vin) REFERENCES vehicles(vin) ON DELETE CASCADE
);

-- ========================================
-- ТАБЛИЦІ СЕРВІСНИХ СТАНЦІЙ ТА МЕХАНІКІВ
-- ========================================

-- Таблиця сервісних станцій
CREATE TABLE public.service_stations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  working_hours JSONB,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця механіків
CREATE TABLE public.mechanics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  specialization VARCHAR(255),
  station_id UUID REFERENCES service_stations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця послуг
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2),
  duration_minutes INTEGER,
  category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- ТАБЛИЦІ ЗАПИСІВ ТА ІСТОРІЇ ОБСЛУГОВУВАННЯ
-- ========================================

-- Таблиця записів на обслуговування
CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_vin text NOT NULL,
  service_type text NOT NULL,
  scheduled_time timestamp with time zone NOT NULL,
  status text NULL DEFAULT 'pending'::text,
  created_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP,
  appointment_date date NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT appointments_vehicle_vin_fkey FOREIGN KEY (vehicle_vin) REFERENCES vehicles(vin),
  CONSTRAINT appointments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'canceled'::text])))
);

-- Таблиця історії обслуговування
CREATE TABLE public.service_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  service_type VARCHAR(255) NOT NULL,
  mileage INTEGER,
  service_date TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT,
  cost DECIMAL(10,2),
  mechanic_id UUID REFERENCES mechanics(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця записів про обслуговування
CREATE TABLE public.service_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  mileage INTEGER,
  description TEXT,
  recommendations TEXT,
  next_service_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- ТАБЛИЦІ ЗАПЧАСТИН ТА РЕМОНТНИХ РОБІТ
-- ========================================

-- Таблиця запчастин
CREATE TABLE public.parts (
  id serial NOT NULL,
  name character varying(255) NOT NULL,
  article character varying(100) NULL,
  manufacturer character varying(255) NULL,
  price numeric(10,2) NULL,
  warranty_period integer NULL,
  description TEXT,
  part_number VARCHAR(50),
  CONSTRAINT parts_pkey PRIMARY KEY (id)
);

-- Таблиця ремонтних робіт
CREATE TABLE public.repair_works (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_history_id UUID REFERENCES service_history(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  labor_cost DECIMAL(10,2) NOT NULL,
  duration INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця запчастин для ремонту
CREATE TABLE public.repair_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID REFERENCES service_records(id),
  part_id INTEGER REFERENCES parts(id),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Нові ремонтні роботи
CREATE TABLE public.new_repair_works (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  service_id uuid NULL,
  part_id integer NULL,
  quantity integer NOT NULL,
  service_history_id bigint NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT new_repair_works_pkey PRIMARY KEY (id),
  CONSTRAINT new_repair_works_part_id_fkey FOREIGN KEY (part_id) REFERENCES parts(id),
  CONSTRAINT new_repair_works_service_id_fkey FOREIGN KEY (service_id) REFERENCES service_records(id)
);

-- Нові ремонтні роботи V2
CREATE TABLE public.new_repair_works_v2 (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  service_id uuid NULL,
  part_id integer NULL,
  quantity integer NOT NULL,
  service_history_id bigint NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT new_repair_works_v2_pkey PRIMARY KEY (id),
  CONSTRAINT new_repair_works_v2_part_id_fkey FOREIGN KEY (part_id) REFERENCES parts(id),
  CONSTRAINT new_repair_works_v2_service_id_fkey FOREIGN KEY (service_id) REFERENCES service_records(id)
);

-- ========================================
-- ТАБЛИЦІ ПОВІДОМЛЕНЬ ТА НОТИФІКАЦІЙ
-- ========================================

-- Таблиця повідомлень
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  is_read boolean NULL DEFAULT false,
  created_at timestamp with time zone NULL DEFAULT now(),
  scheduled_for timestamp with time zone NULL,
  title text NOT NULL DEFAULT ''::text,
  type text NOT NULL DEFAULT 'general'::text,
  status text NULL DEFAULT 'pending'::text,
  data jsonb NULL DEFAULT '{}'::jsonb,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Таблиця налаштувань повідомлень
CREATE TABLE public.notification_settings (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NULL,
  email_notifications boolean NULL DEFAULT true,
  push_notifications boolean NULL DEFAULT true,
  sms_notifications boolean NULL DEFAULT false,
  telegram_notifications boolean NULL DEFAULT false,
  viber_notifications boolean NULL DEFAULT false,
  maintenance_reminders boolean NULL DEFAULT true,
  appointment_reminders boolean NULL DEFAULT true,
  payment_reminders boolean NULL DEFAULT true,
  telegram_chat_id character varying(100) NULL,
  viber_chat_id character varying(100) NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notification_settings_pkey PRIMARY KEY (id),
  CONSTRAINT notification_settings_user_id_key UNIQUE (user_id),
  CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Таблиця запланованих повідомлень
CREATE TABLE public.scheduled_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  is_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_scheduled_notification_type CHECK (type IN ('appointment_reminder', 'appointment_status', 'mileage_request', 'maintenance_reminder', 'system', 'chat'))
);

-- Таблиця push токенів
CREATE TABLE public.push_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL,
  device_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(token)
);

-- ========================================
-- ТАБЛИЦІ НАЛАШТУВАНЬ ТА ДОДАТКОВИХ ФУНКЦІЙ
-- ========================================

-- Таблиця налаштувань користувачів
CREATE TABLE public.user_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Таблиця страхування
CREATE TABLE public.insurance (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  vehicle_vin text NULL,
  policy_number text NOT NULL,
  insurance_company text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT insurance_pkey PRIMARY KEY (id),
  CONSTRAINT insurance_vehicle_vin_fkey FOREIGN KEY (vehicle_vin) REFERENCES vehicles(vin)
);

-- Таблиця фотографій
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object_id UUID NOT NULL,
  object_type VARCHAR(50) NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця документів
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  service_history_id bigint NULL,
  type character varying(50) NOT NULL,
  file_path text NOT NULL,
  file_name character varying(255) NOT NULL,
  mime_type character varying(100) NOT NULL,
  size integer NOT NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT documents_service_history_id_fkey FOREIGN KEY (service_history_id) REFERENCES service_history(id) ON DELETE CASCADE
);

-- Таблиця акцій
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  discount_percent INTEGER,
  discount_amount DECIMAL(10,2),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця відгуків
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_history_id UUID REFERENCES service_history(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  response TEXT,
  response_date TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця платежів
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_history_id UUID REFERENCES service_history(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payment_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- ІНДЕКСИ ДЛЯ ОПТИМІЗАЦІЇ
-- ========================================

-- Індекси для appointments
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON public.appointments USING btree (user_id);

-- Індекси для refresh_tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON public.refresh_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_revoked ON public.refresh_tokens USING btree (is_revoked);

-- Індекси для documents
CREATE INDEX IF NOT EXISTS idx_documents_service_history_id ON public.documents USING btree (service_history_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents USING btree (type);

-- Індекси для notifications
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON public.notifications USING btree (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON public.notifications USING btree (scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications USING btree (type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications USING btree (is_read);

-- Індекси для user_settings
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Індекси для scheduled_notifications
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user_id ON public.scheduled_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_for ON public.scheduled_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_is_sent ON public.scheduled_notifications(is_sent);

-- Індекси для push_tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform ON public.push_tokens(platform);

-- Індекси для photos
CREATE INDEX IF NOT EXISTS idx_photos_object ON public.photos(object_id, object_type);

-- Індекси для promotions
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON public.promotions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(is_active);

-- Індекси для service_records
CREATE INDEX IF NOT EXISTS idx_service_records_vehicle ON public.service_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_service_records_dates ON public.service_records(service_date, next_service_date);

-- Індекси для repair_parts
CREATE INDEX IF NOT EXISTS idx_repair_parts_service ON public.repair_parts(service_id);
CREATE INDEX IF NOT EXISTS idx_repair_parts_part ON public.repair_parts(part_id);

-- Індекси для repair_works
CREATE INDEX IF NOT EXISTS idx_repair_works_service_history ON public.repair_works(service_history_id);

-- Індекси для reviews
CREATE INDEX IF NOT EXISTS idx_reviews_service_history ON public.reviews(service_history_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);

-- Індекси для service_stations
CREATE INDEX IF NOT EXISTS idx_service_stations_name ON public.service_stations(name);
CREATE INDEX IF NOT EXISTS idx_service_stations_address ON public.service_stations(address);

-- Індекси для payments
CREATE INDEX IF NOT EXISTS idx_payments_service_history_id ON public.payments(service_history_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- ========================================
-- ПІДСУМОК СТРУКТУРИ
-- ========================================

/*
ОСНОВНІ ТАБЛИЦІ:
1. users - користувачі системи
2. refresh_tokens - токени оновлення
3. vehicles - транспортні засоби
4. mileage_requests - запити на оновлення пробігу
5. service_stations - сервісні станції
6. mechanics - механіки
7. services - послуги
8. appointments - записи на обслуговування
9. service_history - історія обслуговування
10. service_records - записи про обслуговування
11. parts - запчастини
12. repair_works - ремонтні роботи
13. repair_parts - запчастини для ремонту
14. new_repair_works - нові ремонтні роботи
15. new_repair_works_v2 - нові ремонтні роботи V2
16. notifications - повідомлення
17. notification_settings - налаштування повідомлень
18. scheduled_notifications - заплановані повідомлення
19. push_tokens - push токени
20. user_settings - налаштування користувачів
21. insurance - страхування
22. photos - фотографії
23. documents - документи
24. promotions - акції
25. reviews - відгуки
26. payments - платежі

ВСЬОГО ТАБЛИЦЬ: 26
*/