import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEW_SUPABASE_URL
const SERVICE_KEY = process.env.NEW_SERVICE_KEY

if (!URL || !SERVICE_KEY) {
  console.error('Missing NEW_SUPABASE_URL or NEW_SERVICE_KEY')
  process.exit(1)
}

const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

function genPass() {
  const s = Math.random().toString(36).slice(2)
  return `Temp${s}A!1`
}

;(async () => {
  const { data: rows, error } = await admin.from('users').select('id, email, name, role, phone')
  if (error) throw error
  for (const u of rows || []) {
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const exists = existing?.users?.find(x => x.email === u.email)
    if (exists) continue
    const pwd = genPass()
    const { error: createErr } = await admin.auth.admin.createUser({
      email: u.email,
      password: pwd,
      email_confirm: true,
      user_metadata: { name: u.name, role: u.role, phone: u.phone }
    })
    if (createErr) throw createErr
    console.log('created auth user', u.email)
  }
  console.log('done')
  process.exit(0)
})().catch(e => {
  console.error('error', e)
  process.exit(1)
})

