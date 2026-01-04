
-- Таблиця запитів на оновлення пробігу
CREATE TABLE IF NOT EXISTS public.mileage_requests (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  vehicle_vin text NOT NULL,
  current_mileage integer NOT NULL,
  photo_url text NULL,
  status text NULL DEFAULT 'pending'::text,
  admin_notes text NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT mileage_requests_pkey PRIMARY KEY (id),
  CONSTRAINT mileage_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT mileage_requests_vehicle_vin_fkey FOREIGN KEY (vehicle_vin) REFERENCES vehicles(vin),
  CONSTRAINT mileage_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

-- Таблиця сервісних станцій
CREATE TABLE IF NOT EXISTS public.service_stations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  phone text NULL,
  email text NULL,
  working_hours text NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT service_stations_pkey PRIMARY KEY (id)
);

-- Таблиця механіків
CREATE TABLE IF NOT EXISTS public.mechanics (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  specialization text NULL,
  phone text NULL,
  email text NULL,
  service_station_id bigint NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT mechanics_pkey PRIMARY KEY (id),
  CONSTRAINT mechanics_service_station_id_fkey FOREIGN KEY (service_station_id) REFERENCES service_stations(id)
);

-- Таблиця послуг
CREATE TABLE IF NOT EXISTS public.services (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  description text NULL,
  price numeric(10,2) NULL,
  duration_minutes integer NULL,
  service_station_id bigint NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT services_pkey PRIMARY KEY (id),
  CONSTRAINT services_service_station_id_fkey FOREIGN KEY (service_station_id) REFERENCES service_stations(id)
);

-- Індекси для оптимізації
CREATE INDEX IF NOT EXISTS idx_mileage_requests_user_id ON public.mileage_requests USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_mileage_requests_vehicle_vin ON public.mileage_requests USING btree (vehicle_vin);
CREATE INDEX IF NOT EXISTS idx_mileage_requests_status ON public.mileage_requests USING btree (status);

CREATE INDEX IF NOT EXISTS idx_service_stations_name ON public.service_stations USING btree (name);
CREATE INDEX IF NOT EXISTS idx_service_stations_address ON public.service_stations USING btree (address);

CREATE INDEX IF NOT EXISTS idx_mechanics_service_station_id ON public.mechanics USING btree (service_station_id);
CREATE INDEX IF NOT EXISTS idx_mechanics_name ON public.mechanics USING btree (name);

CREATE INDEX IF NOT EXISTS idx_services_service_station_id ON public.services USING btree (service_station_id);
CREATE INDEX IF NOT EXISTS idx_services_name ON public.services USING btree (name);
