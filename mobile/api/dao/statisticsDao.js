import { supabase } from '../supabaseClient'

export async function fetchAdminStatistics() {
  const { count: completed } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')

  const { count: pending } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: cancelled } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'cancelled')

  const { data: records, error: recErr } = await supabase
    .from('service_records')
    .select('cost, service_date')
  if (recErr) throw recErr

  const total = (records || []).reduce((s, r) => s + (Number(r.cost) || 0), 0)
  const byMonth = {}
  ;(records || []).forEach(r => {
    const d = r.service_date ? new Date(r.service_date) : new Date()
    const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
    byMonth[key] = (byMonth[key] || 0) + (Number(r.cost) || 0)
  })

  const { data: appts, error: apptsErr } = await supabase
    .from('appointments')
    .select('service_id, services ( name )')
    .not('service_id', 'is', null)
  if (apptsErr) throw apptsErr

  const popularMap = {}
  ;(appts || []).forEach(a => {
    const name = (a.services && a.services.name) || 'Інше'
    popularMap[name] = (popularMap[name] || 0) + 1
  })

  const monthly = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }))

  const popular = Object.entries(popularMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  return {
    revenue: { daily: [], monthly, total },
    appointments: { pending: pending || 0, completed: completed || 0, cancelled: cancelled || 0 },
    services: { popular, revenue: monthly.map(m => ({ name: m.month, amount: m.amount })) }
  }
}
