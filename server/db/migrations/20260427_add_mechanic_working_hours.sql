CREATE TABLE IF NOT EXISTS mechanic_working_hours (
  master_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time TEXT,
  end_time TEXT,
  is_working_day INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (master_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_mechanic_working_hours_master_id ON mechanic_working_hours(master_id);
