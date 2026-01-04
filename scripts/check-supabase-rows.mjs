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

async function count(db, table) {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return count || 0
}

;(async () => {
  for (const t of tables) {
    const oldCount = await count(oldDb, t)
    const newCount = await count(newDb, t)
    const status = oldCount === newCount ? 'OK' : 'DIFF'
    console.log(`${t}: old=${oldCount} new=${newCount} [${status}]`)
  }
  process.exit(0)
})().catch(e => {
  console.error('error', e)
  process.exit(1)
})

