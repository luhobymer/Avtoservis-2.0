require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const statements = [
    // appointments columns
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completion_date TIMESTAMPTZ",
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT",
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_date TIMESTAMPTZ",
    "CREATE INDEX IF NOT EXISTS idx_appointments_completion_date ON appointments (completion_date)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_cancellation_date ON appointments (cancellation_date)",

    // service_records table
    "CREATE TABLE IF NOT EXISTS service_records (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  vehicle_vin VARCHAR(17) NOT NULL REFERENCES vehicles(vin) ON DELETE CASCADE,\n  service_details TEXT,\n  cost DECIMAL(10,2) DEFAULT 0,\n  performed_at TIMESTAMPTZ,\n  mechanic_notes TEXT,\n  service_date TIMESTAMPTZ NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,\n  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP\n)",
    "DROP TRIGGER IF EXISTS update_service_records_updated_at ON service_records",
    "CREATE TRIGGER update_service_records_updated_at BEFORE UPDATE ON service_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()",
    "CREATE INDEX IF NOT EXISTS idx_service_records_vehicle_vin ON service_records(vehicle_vin)",
    "CREATE INDEX IF NOT EXISTS idx_service_records_service_date ON service_records(service_date)",
    "ALTER TABLE service_records ENABLE ROW LEVEL SECURITY",

    // RLS policies (idempotent via DROP IF EXISTS then CREATE)
    "DROP POLICY IF EXISTS \"Users can view their service records\" ON service_records",
    "CREATE POLICY \"Users can view their service records\" ON service_records FOR SELECT USING (\n      EXISTS (SELECT 1 FROM vehicles WHERE vehicles.vin = service_records.vehicle_vin AND vehicles.user_id = auth.uid())\n    )",
    "DROP POLICY IF EXISTS \"Users can create their service records\" ON service_records",
    "CREATE POLICY \"Users can create their service records\" ON service_records FOR INSERT WITH CHECK (\n      EXISTS (SELECT 1 FROM vehicles WHERE vehicles.vin = service_records.vehicle_vin AND vehicles.user_id = auth.uid())\n    )",
    "DROP POLICY IF EXISTS \"Users can update their service records\" ON service_records",
    "CREATE POLICY \"Users can update their service records\" ON service_records FOR UPDATE USING (\n      EXISTS (SELECT 1 FROM vehicles WHERE vehicles.vin = service_records.vehicle_vin AND vehicles.user_id = auth.uid())\n    )",
    "DROP POLICY IF EXISTS \"Users can delete their service records\" ON service_records",
    "CREATE POLICY \"Users can delete their service records\" ON service_records FOR DELETE USING (\n      EXISTS (SELECT 1 FROM vehicles WHERE vehicles.vin = service_records.vehicle_vin AND vehicles.user_id = auth.uid())\n    )",
  ];

  let success = 0, fail = 0;
  for (const sql of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.log('✗', sql.split('\n')[0], '-', error.message || error);
      fail++;
    } else {
      console.log('✓', sql.split('\n')[0]);
      success++;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  console.log(`Done. Success: ${success}, Fail: ${fail}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
