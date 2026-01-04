import { createClient } from '@supabase/supabase-js'

const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL
const OLD_SERVICE_KEY = process.env.OLD_SERVICE_KEY
const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL
const NEW_SERVICE_KEY = process.env.NEW_SERVICE_KEY

if (!OLD_SUPABASE_URL || !OLD_SERVICE_KEY || !NEW_SUPABASE_URL || !NEW_SERVICE_KEY) {
  console.error('Missing environment variables')
  process.exit(1)
}

const oldDb = createClient(OLD_SUPABASE_URL, OLD_SERVICE_KEY, { auth: { persistSession: false } })
const newDb = createClient(NEW_SUPABASE_URL, NEW_SERVICE_KEY, { auth: { persistSession: false } })

const tables = [
  'users',
  'service_stations',
  'mechanics',
  'services',
  'parts',
  'vehicles',
  'appointments',
  'service_records',
  'service_history',
  'documents',
  'insurance',
  'repair_works',
  'repair_parts',
  'payments',
  'notifications'
]

const conflictKeys = {
  users: 'id',
  service_stations: 'id',
  mechanics: 'id',
  services: 'id',
  parts: 'id',
  vehicles: 'vin',
  appointments: 'id',
  service_records: 'id',
  service_history: 'id',
  documents: 'id',
  insurance: 'id',
  repair_works: 'id',
  repair_parts: 'id',
  payments: 'id',
  notifications: 'id'
}

const columns = {
  users: 'id, email, password_hash, role, name, phone, created_at',
  service_stations: 'id, name, address, phone, email, working_hours, created_at, updated_at',
  mechanics: 'id, name, specialization, phone, email, service_station_id, created_at, updated_at',
  services: 'id, name, description, price, duration, service_station_id, created_at, updated_at',
  parts: 'id, name, article, manufacturer, price, warranty_period, created_at, updated_at, part_number, quantity, min_quantity',
  vehicles: 'vin, user_id, brand, model, year, make, body_type, registration_number, engine_type, engine_volume, color, mileage',
  appointments: 'id, user_id, vehicle_vin, service_type, scheduled_time, status, created_at, updated_at, appointment_date, service_id, mechanic_id, station_id, vehicle_id, notes, completion_notes, date, time',
  service_records: 'id, vehicle_vin, service_details, cost, performed_at, mechanic_notes, service_date',
  service_history: '*',
  documents: '*',
  insurance: 'id, vehicle_vin, policy_number, insurance_company, start_date, end_date, created_at, updated_at',
  repair_works: '*',
  repair_parts: '*',
  payments: '*',
  notifications: 'id, user_id, message, is_read, created_at, scheduled_for, title, type, status, data'
}

const pageSize = 1000

async function migrateTable(table) {
  let start = 0
  const sel = columns[table] || '*'
  for (;;) {
    const { data, error } = await oldDb.from(table).select(sel).range(start, start + pageSize - 1)
    if (error) {
      console.error('read error', table, error)
      return
    }
    if (!data || data.length === 0) break
    const { error: upsertError } = await newDb.from(table).upsert(data, { onConflict: conflictKeys[table] })
    if (upsertError) {
      console.error('upsert error', table, upsertError)
      return
    }
    start += pageSize
  }
}

;(async () => {
  for (const t of tables) {
    console.log('migrating', t)
    await migrateTable(t)
    console.log('done', t)
  }
  console.log('completed')
  process.exit(0)
})().catch(e => {
  console.error('error', e)
  process.exit(1)
})
