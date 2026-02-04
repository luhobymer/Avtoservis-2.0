-- Add completion_mileage to appointments if not exists (handled via app logic usually, but let's be explicit in new table or alter)
-- SQLite doesn't support IF NOT EXISTS for columns in ALTER TABLE easily, so we usually just run it or check.
-- For this environment, I'll create the new table `vehicle_parts` and assume I can run the SQL.

CREATE TABLE IF NOT EXISTS vehicle_parts (
  id TEXT PRIMARY KEY,
  vehicle_vin TEXT NOT NULL,
  appointment_id TEXT,
  name TEXT NOT NULL,
  part_number TEXT,
  price REAL,
  quantity INTEGER DEFAULT 1,
  purchased_by TEXT DEFAULT 'owner', -- 'owner', 'master'
  installed_at_mileage INTEGER,
  installed_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- We will also need to ensure appointments has completion_mileage. 
-- Since we can't easily alter in a single script without error if exists in some sqlite versions/wrappers, 
-- I will add it via migration if I could, but here I'll just rely on `mileage` in service_records or add a column if I can.
-- Let's try to add it.
ALTER TABLE appointments ADD COLUMN completion_mileage INTEGER;
