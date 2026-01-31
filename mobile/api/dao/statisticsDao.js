import axiosAuth from '../axiosConfig'

const normalizeListPayload = payload => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.data)) return payload.data
  return []
}

export async function fetchAdminStatistics() {
  const [appointmentsRes, paymentsRes] = await Promise.all([
    axiosAuth.get('/api/appointments', { params: { admin: 1 } }),
    axiosAuth.get('/api/payments')
  ])

  const appointments = normalizeListPayload(appointmentsRes.data)
  const payments = normalizeListPayload(paymentsRes.data)

  let pending = 0
  let completed = 0
  let cancelled = 0

  appointments.forEach(a => {
    const status = (a.status || '').toLowerCase()
    if (status === 'pending') pending += 1
    else if (status === 'completed') completed += 1
    else if (status === 'cancelled' || status === 'canceled') cancelled += 1
  })

  const byMonth = {}
  let total = 0

  payments.forEach(p => {
    if ((p.status || '').toLowerCase() !== 'completed') return
    const amount = Number(p.amount) || 0
    if (!amount) return
    const dateStr = p.payment_date || p.created_at
    if (!dateStr) return
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return
    const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
    byMonth[key] = (byMonth[key] || 0) + amount
    total += amount
  })

  const monthly = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }))

  const popularMap = {}
  appointments.forEach(a => {
    const raw = typeof a.service_type === 'string' ? a.service_type.trim() : ''
    const name = raw || 'Інше'
    popularMap[name] = (popularMap[name] || 0) + 1
  })

  const popular = Object.entries(popularMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  return {
    revenue: { daily: [], monthly, total },
    appointments: { pending, completed, cancelled },
    services: {
      popular,
      revenue: monthly.map(m => ({ name: m.month, amount: m.amount }))
    }
  }
}
