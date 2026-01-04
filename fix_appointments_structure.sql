
      -- Додаємо відсутні колонки до appointments
      DO $$
      BEGIN
        -- Додаємо service_id якщо не існує
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'appointments' AND column_name = 'service_id') THEN
          ALTER TABLE appointments ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE CASCADE;
          RAISE NOTICE 'Додано колонку service_id';
        END IF;
        
        -- Додаємо mechanic_id якщо не існує
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'appointments' AND column_name = 'mechanic_id') THEN
          ALTER TABLE appointments ADD COLUMN mechanic_id UUID REFERENCES mechanics(id) ON DELETE SET NULL;
          RAISE NOTICE 'Додано колонку mechanic_id';
        END IF;
        
        -- Додаємо station_id якщо не існує
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'appointments' AND column_name = 'station_id') THEN
          ALTER TABLE appointments ADD COLUMN station_id UUID REFERENCES service_stations(id) ON DELETE CASCADE;
          RAISE NOTICE 'Додано колонку station_id';
        END IF;
        
        -- Додаємо notes якщо не існує
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'appointments' AND column_name = 'notes') THEN
          ALTER TABLE appointments ADD COLUMN notes TEXT;
          RAISE NOTICE 'Додано колонку notes';
        END IF;
        
        -- Додаємо completion_notes якщо не існує
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'appointments' AND column_name = 'completion_notes') THEN
          ALTER TABLE appointments ADD COLUMN completion_notes TEXT;
          RAISE NOTICE 'Додано колонку completion_notes';
        END IF;
        
        -- Змінюємо тип vehicle_vin на vehicle_id якщо потрібно
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'appointments' AND column_name = 'vehicle_vin') THEN
          -- Додаємо vehicle_id
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'appointments' AND column_name = 'vehicle_id') THEN
            ALTER TABLE appointments ADD COLUMN vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE;
            RAISE NOTICE 'Додано колонку vehicle_id';
          END IF;
        END IF;
      END
      $$;
      
      -- Створюємо індекси якщо не існують
      CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments(service_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_mechanic_id ON appointments(mechanic_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_station_id ON appointments(station_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_vehicle_id ON appointments(vehicle_id);
    