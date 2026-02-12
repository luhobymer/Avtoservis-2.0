const defaultMaintenanceTasks = [
  { service_item: 'Заміна моторної оливи', interval_km: 10000, interval_months: 12 },
  { service_item: 'Заміна масляного фільтра', interval_km: 10000, interval_months: 12 },
  { service_item: 'Заміна повітряного фільтра', interval_km: 20000, interval_months: 24 },
  { service_item: 'Заміна фільтра салону', interval_km: 20000, interval_months: 12 },
  { service_item: 'Заміна паливного фільтра', interval_km: 40000, interval_months: 48 },
  { service_item: 'Заміна гальмівної рідини', interval_km: null, interval_months: 24 },
  { service_item: 'Заміна антифризу', interval_km: 60000, interval_months: 60 },
  { service_item: 'Заміна свічок запалювання', interval_km: 40000, interval_months: null },
  { service_item: 'Перевірка гальмівних колодок', interval_km: 10000, interval_months: null },
  { service_item: 'Заміна комплекту ГРМ', interval_km: 60000, interval_months: 60 },
];

module.exports = defaultMaintenanceTasks;
