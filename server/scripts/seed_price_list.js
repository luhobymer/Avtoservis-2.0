const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { getDb } = require('../db/d1');

const nowIso = () => new Date().toISOString();

const categories = [
  { key: 'diagnostics', name: 'Діагностика' },
  { key: 'engine', name: 'Ремонтні роботи по двигуну' },
  { key: 'clutch', name: 'Система зчеплення' },
  { key: 'brakes', name: 'Гальмівна система' },
];

const price = (v) => (typeof v === 'number' ? v : v && v.min ? v.min : null);
const minutes = (v) => (typeof v === 'number' ? v : null);

const services = [
  // Діагностика
  { c: 'diagnostics', name: 'Діагностика ходової', price: 200 },
  { c: 'diagnostics', name: 'Діагностика двигуна', price: 200 },
  { c: 'diagnostics', name: 'Замір компресії', price: { min: 250, max: 600 } },
  { c: 'diagnostics', name: 'Діагностика димогенератором', price: 500 },
  { c: 'diagnostics', name: 'Діагностика електрики', price: 350, duration: 60, description: 'грн/год' },
  { c: 'diagnostics', name: 'Діагностика ендоскопом', price: { min: 600, max: 1200 } },
  { c: 'diagnostics', name: 'Комп. діагностика', price: 200 },

  // Двигун
  { c: 'engine', name: 'Капітальний ремонт двигуна (01-07)', price: 10000, description: 'без ремонту ГБЦ' },
  { c: 'engine', name: 'Капітальний ремонт двигуна (ДЕО, Шевроле …)', price: 15000 },
  { c: 'engine', name: 'Капітальний ремонт двигуна (08-015)', price: 10000 },
  { c: 'engine', name: 'Капітальний ремонт двигуна (VAG..)', price: { min: 15000, max: 40000 } },
  { c: 'engine', name: 'Заміна подушки двигуна', price: { min: 350, max: 2000 } },
  { c: 'engine', name: 'Заміна ГРМ+ролік вкл. бенз. (08-015)', price: { min: 1000, max: 1500 } },
  { c: 'engine', name: 'Заміна ГРМ+ролік 16кл. бенз. (01-2170)', price: 1200 },
  { c: 'engine', name: 'Заміна ГРМ+ролік 8кл. бенз. (іномарки)', price: { min: 1900, max: 2800 } },
  { c: 'engine', name: 'Заміна ГРМ+ролік V6 бенз.', price: { min: 4800, max: 5800 } },
  { c: 'engine', name: 'Заміна ГРМ+ролік V8 бенз.', price: { min: 6500, max: 7500 } },
  { c: 'engine', name: 'Заміна ГРМ+ролік 8кл. дизель', price: { min: 1800, max: 2400 } },
  { c: 'engine', name: 'Заміна ГРМ+ролік 16кл. дизель', price: { min: 2000, max: 6000 } },
  { c: 'engine', name: 'Заміна ланцюга ГРМ 4 цил.', price: { min: 8000, max: 12000 } },
  { c: 'engine', name: 'Заміна ланцюга ГРМ 6 цил.', price: { min: 8000, max: 14000 } },
  { c: 'engine', name: 'Заміна ланцюга ГРМ 8 цил.', price: { min: 4000, max: 19000 } },
  { c: 'engine', name: 'Зняття/встановлення двигуна', price: 500 },
  { c: 'engine', name: 'Регулювання клапанів 8кл.', price: 800 },
  { c: 'engine', name: 'Регулювання клапанів 16кл.', price: 800 },
  { c: 'engine', name: "Заміна прокладки клап. кришки", price: 300 },
  { c: 'engine', name: 'Заміна випускного колектора (прокладки)', price: 600, description: '+1500 зі зняттям турбіни' },
  { c: 'engine', name: 'Заміна турбіни', price: 1500 },
  { c: 'engine', name: 'Заміна шківа к/в', price: 400 },
  { c: 'engine', name: 'Заміна прокладки ГБЦ 4 цил.', price: 5000 },
  { c: 'engine', name: 'Заміна прокладки ГБЦ 6 цил.', price: 6000 },
  { c: 'engine', name: 'Заміна прокладки ГБЦ 8 цил.', price: 7000 },
  { c: 'engine', name: 'Чистка дросельної заслонки', price: 400 },
  { c: 'engine', name: 'Заміна прокладки піддона', price: 400 },
  { c: 'engine', name: 'Заміна пер. сал. к/в', price: 500, description: 'разом із заміною ГРМ' },
  { c: 'engine', name: 'Заміна пер. сал. розпредвала', price: 400 },
  { c: 'engine', name: 'Заміна теплообмінника', price: 800 },
  { c: 'engine', name: 'Слюсарні роботи (погодинно)', price: 300, duration: 60, description: 'від 300-800 грн/год' },

  // Зчеплення
  { c: 'clutch', name: 'Заміна зчеплення без зняття підрамника', price: { min: 1500, max: 2500 } },
  { c: 'clutch', name: 'Заміна зчеплення зі зняттям підрамника', price: { min: 1500, max: 2500 }, description: '+ підрамник' },
  { c: 'clutch', name: 'Заміна зчеплення на повному приводі', price: { min: 3000, max: 5000 } },
  { c: 'clutch', name: 'Заміна вінця', price: 400, description: '+ до заміни зчеплення' },
  { c: 'clutch', name: 'Заміна маховика', price: 200, description: '+ до заміни зчеплення' },
  { c: 'clutch', name: 'Заміна заднього сальника к/в', price: 100, description: '+ до заміни зчеплення' },
  { c: 'clutch', name: 'Заміна троса зчеплення', price: 400 },
  { c: 'clutch', name: 'Заміна шланги зчеплення', price: 400 },
  { c: 'clutch', name: 'Заміна головного циліндра зчеплення', price: { min: 500, max: 900 } },
  { c: 'clutch', name: 'Заміна робочого циліндра зчеплення', price: 300 },

  // Гальмівна система
  { c: 'brakes', name: 'Прокачка гальмівної системи', price: 300 },
  { c: 'brakes', name: 'Заміна гальмівної трубки', price: 250, description: 'шт.' },
  { c: 'brakes', name: 'Заміна гальмівної шланги', price: 200, description: 'шт.' },
  { c: 'brakes', name: 'Заміна гальмівних колодок (барабан)', price: { min: 400, max: 700 } },
  { c: 'brakes', name: 'Заміна гальмівних колодок (диск)', price: 150, description: 'сторона' },
  { c: 'brakes', name: 'Заміна гальмівного диска', price: 300 },
  { c: 'brakes', name: 'Регулювання ручного гальма', price: 250 },
  { c: 'brakes', name: 'Заміна супорта', price: 300 },
  { c: 'brakes', name: 'Заміна головного гальмівного циліндра', price: { min: 500, max: 900 } },
  { c: 'brakes', name: 'Заміна колодок ручного гальма', price: 500 },
  { c: 'brakes', name: 'Заміна вакуумного підсилювача', price: 800 },
  { c: 'brakes', name: 'Заміна рем супорта', price: 500 },
  { c: 'brakes', name: 'Заміна робочого циліндра гальма', price: 300 },
  { c: 'brakes', name: 'Заміна гальмівної рідини', price: 300 },
  { c: 'brakes', name: 'Заміна направляючих супорта', price: 200, description: 'сторона' },
  { c: 'brakes', name: 'Заміна троса ручного гальма', price: 200, description: '1 шт.' },
  { c: 'brakes', name: 'Ремонт зад. супорта', price: 500 },
];

async function ensureCategory(db, name) {
  const row = await db.prepare('SELECT id FROM service_categories WHERE name = ? LIMIT 1').get(name);
  if (row && row.id) return row.id;
  const id = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO service_categories (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(id, name, null, nowIso(), nowIso());
  return id;
}

async function upsertService(db, svc, categoryId) {
  const existing = await db.prepare('SELECT id FROM services WHERE name = ? LIMIT 1').get(svc.name);
  const payload = {
    description: svc.description || null,
    price: price(svc.price),
    duration: minutes(svc.duration),
    category_id: categoryId,
    updated_at: nowIso(),
  };
  if (existing && existing.id) {
    await db
      .prepare(
        'UPDATE services SET description = ?, price = ?, duration = ?, category_id = ?, updated_at = ? WHERE id = ?'
      )
      .run(payload.description, payload.price, payload.duration, payload.category_id, payload.updated_at, existing.id);
    return existing.id;
  }
  const id = crypto.randomUUID();
  await db
    .prepare(
      'INSERT INTO services (id, name, description, price, duration, is_active, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)'
    )
    .run(id, svc.name, payload.description, payload.price, payload.duration, payload.category_id, nowIso(), nowIso());
  return id;
}

(async () => {
  const db = await getDb();
  const categoryIds = {};
  for (const cat of categories) {
    categoryIds[cat.key] = await ensureCategory(db, cat.name);
  }
  let created = 0;
  for (const s of services) {
    const cid = categoryIds[s.c];
    await upsertService(db, s, cid);
    created++;
  }
  console.log('Seeded services count:', created);
  process.exit(0);
})().catch((e) => {
  console.error('Seed error:', e && e.message ? e.message : e);
  process.exit(1);
});

