DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completion_date TIMESTAMPTZ';
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT';
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_date TIMESTAMPTZ';
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_appointments_completion_date ON appointments (completion_date)';
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_appointments_cancellation_date ON appointments (cancellation_date)';
  EXCEPTION WHEN others THEN NULL; END;

  IF to_regclass('public.service_records') IS NULL THEN
    EXECUTE 'CREATE TABLE public.service_records (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      vehicle_vin VARCHAR(17) NOT NULL REFERENCES vehicles(vin) ON DELETE CASCADE,
      service_details TEXT,
      cost DECIMAL(10,2) DEFAULT 0,
      performed_at TIMESTAMPTZ,
      mechanic_notes TEXT,
      service_date TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )';
  END IF;

  BEGIN
    EXECUTE 'CREATE TRIGGER update_service_records_updated_at BEFORE UPDATE ON service_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_service_records_vehicle_vin ON service_records(vehicle_vin)';
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_service_records_service_date ON service_records(service_date)';
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER TABLE service_records ENABLE ROW LEVEL SECURITY';
  EXCEPTION WHEN others THEN NULL; END;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='service_records' AND policyname='Users can view their service records'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their service records" ON service_records FOR SELECT USING (
      EXISTS (SELECT 1 FROM vehicles WHERE vehicles.vin = service_records.vehicle_vin AND vehicles.user_id = auth.uid())
    )';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='service_records' AND policyname='Users can create their service records'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can create their service records" ON service_records FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM vehicles WHERE vehicles.vin = service_records.vehicle_vin AND vehicles.user_id = auth.uid())
    )';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='service_records' AND policyname='Users can update their service records'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their service records" ON service_records FOR UPDATE USING (
      EXISTS (SELECT 1 FROM vehicles WHERE vehicles.vin = service_records.vehicle_vin AND vehicles.user_id = auth.uid())
    )';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='service_records' AND policyname='Users can delete their service records'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete their service records" ON service_records FOR DELETE USING (
      EXISTS (SELECT 1 FROM vehicles WHERE vehicles.vin = service_records.vehicle_vin AND vehicles.user_id = auth.uid())
    )';
  END IF;
END $$;
