require('dotenv').config();
const crypto = require('crypto');
const { getDb } = require('../db/d1');
const logger = require('../middleware/logger');

const stableId = (prefix, value) =>
  `${prefix}_${crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 32)}`;

const parseMinNumber = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return null;
  if (raw.startsWith('+')) return null;
  const match = raw.replace(',', '.').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
};

const buildPriceList = () => {
  const hourly = { duration: 60, duration_text: 'за 1 год' };

  return [
    {
      category: 'Діагностика',
      items: [
        { name: 'Діагностика ходової', price_text: '200', price: 200 },
        { name: 'Діагностика двигуна', price_text: 'від 200', price: 200 },
        { name: 'Замір компресії', price_text: 'від 250-600', price: 250 },
        { name: 'Діагностика димогенератором', price_text: '500', price: 500 },
        { name: 'Діагностика електрики', price_text: 'від 350 грн/год', price: 350, ...hourly },
        { name: 'Діагностика ендоскопом', price_text: 'від 600-1200', price: 600 },
        { name: 'Комп. діагностика', price_text: 'від 200', price: 200 },
      ],
    },
    {
      category: 'Ремонтні роботи по двигуну',
      items: [
        { name: 'Капітальний ремонт двигуна (01-07)', price_text: '10000 (без рем. ГБЦ)', price: 10000 },
        { name: 'Капітальний ремонт двигуна (ДЕО, Шевроле …)', price_text: '15000', price: 15000 },
        { name: 'Капітальний ремонт двигуна (08-015)', price_text: '10000', price: 10000 },
        { name: 'Капітальний ремонт двигуна (VAG..)', price_text: 'від 15000-40000', price: 15000 },
        { name: 'Заміна подушки двигуна', price_text: 'від 350-2000', price: 350 },
        { name: 'Заміна ГРМ+ролік вкл. бенз. (08-015)', price_text: 'від 1000-1500', price: 1000 },
        { name: 'Заміна ГРМ+ролік 16кл. бенз. (01-2170)', price_text: 'від 1800-2400', price: 1800 },
        { name: 'Заміна ГРМ+ролік 8кл. бенз. (іномарки)', price_text: 'від 1900-2800', price: 1900 },
        { name: 'Заміна ГРМ+ролік V6 бенз.', price_text: 'від 4800-5800', price: 4800 },
        { name: 'Заміна ГРМ+ролік V8 бенз.', price_text: 'від 6500-7500', price: 6500 },
        { name: 'Заміна ГРМ+ролік 8кл. дизель', price_text: 'від 1800-2400', price: 1800 },
        { name: 'Заміна ГРМ+ролік 16кл. дизель', price_text: 'від 2000-6000', price: 2000 },
        { name: 'Заміна ланцюга ГРМ 4 цил.', price_text: 'від 8000-12000', price: 8000 },
        { name: 'Заміна ланцюга ГРМ 6 цил.', price_text: 'від 8000-14000', price: 8000 },
        { name: 'Заміна ланцюга ГРМ 8 цил.', price_text: 'від 4000-19000', price: 4000 },
        { name: 'Зняття/встановлення двигуна', price_text: 'від 500', price: 500 },
        { name: 'Регулювання клапанів 8кл.', price_text: 'від 800', price: 800 },
        { name: 'Регулювання клапанів 16кл.', price_text: 'від 300', price: 300 },
        { name: 'Заміна прокладки клап. кришки', price_text: 'від 600', price: 600 },
        { name: 'Заміна випускного колектора (прокладки)', price_text: 'від 400', price: 400 },
        { name: 'Заміна турбіни', price_text: '1500', price: 1500 },
        { name: 'Заміна шківа к/в', price_text: '400', price: 400 },
        { name: 'Заміна прокладки ГБЦ 4 цил.', price_text: 'від 5000', price: 5000 },
        { name: 'Заміна прокладки ГБЦ 6 цил.', price_text: 'від 6000', price: 6000 },
        { name: 'Заміна прокладки ГБЦ 8 цил.', price_text: 'від 7000', price: 7000 },
        { name: 'Чистка дросельної заслонки', price_text: 'від 400', price: 400 },
        { name: 'Заміна прокладки піддона', price_text: 'від 400', price: 400 },
        { name: 'Заміна пер. сал. к/в', price_text: 'від 500 + заміна ГРМ', price: 500 },
        { name: 'Заміна пер. сал. розпредвала', price_text: 'від 400 + заміна ГРМ', price: 400 },
        { name: 'Заміна теплообмінника', price_text: 'від 800', price: 800 },
      ],
    },
    {
      category: 'Система зчеплення',
      items: [
        { name: 'Заміна зчеплення без зняття підрамника', price_text: 'від 1500-2500', price: 1500 },
        { name: 'Заміна зчеплення зі зняттям підрамника', price_text: 'від 1500-2500 + підрамник', price: 1500 },
        { name: 'Заміна зчеплення на повному приводі', price_text: 'від 3000-5000', price: 3000 },
        { name: 'Заміна вінця', price_text: '+400 до заміни зчеплення' },
        { name: 'Заміна маховика', price_text: '+200 до заміни зчеплення' },
        { name: 'Заміна заднього сальника к/в', price_text: '+100 до заміни зчеплення' },
        { name: 'Заміна троса зчеплення', price_text: 'від 400', price: 400 },
        { name: 'Заміна шланги зчеплення', price_text: 'від 400', price: 400 },
        { name: 'Заміна головного циліндра зчеплення', price_text: 'від 500-900', price: 500 },
        { name: 'Заміна робочого циліндра зчеплення', price_text: 'від 300', price: 300 },
      ],
    },
    {
      category: 'Гальмівна система',
      items: [
        { name: 'Прокачка гальмівної системи', price_text: '300', price: 300 },
        { name: 'Заміна гальмівної трубки', price_text: 'від 250-500 / шт.', price: 250 },
        { name: 'Заміна гальмівної шланги', price_text: 'від 200-250 / шт.', price: 200 },
        { name: 'Заміна гальмівних колодок (барабан)', price_text: 'від 400-700', price: 400 },
        { name: 'Заміна гальмівних колодок (диск)', price_text: '150 / сторона', price: 150 },
        { name: 'Заміна гальмівного диска', price_text: '300', price: 300 },
        { name: 'Регулювання ручного гальма', price_text: 'від 250', price: 250 },
        { name: 'Заміна супорта', price_text: '300', price: 300 },
        { name: 'Заміна головного гальмівного циліндра', price_text: 'від 500-900', price: 500 },
        { name: 'Заміна колодок ручного гальма', price_text: '500', price: 500 },
        { name: 'Заміна вакуумного підсилювача', price_text: 'від 800', price: 800 },
        { name: 'Заміна рем супорта', price_text: '500', price: 500 },
        { name: 'Заміна робочого циліндра гальма', price_text: '300', price: 300 },
        { name: 'Заміна гальмівної рідини', price_text: 'від 300', price: 300 },
        { name: 'Заміна направляючих супорта', price_text: 'від 200 / сторона', price: 200 },
        { name: 'Заміна троса ручного гальма', price_text: 'від 200 / 1 шт.', price: 200 },
        { name: 'Ремонт зад. супорта', price_text: '500', price: 500 },
      ],
    },
    {
      category: 'Система охолодження',
      items: [
        { name: 'Заміна радіатора охолодження', price_text: 'від 500-1500', price: 500 },
        { name: 'Заміна рідини охолодження', price_text: 'від 300-500', price: 300 },
        { name: 'Заміна термостата', price_text: 'від 400-600', price: 400 },
        { name: 'Заміна помпи', price_text: 'від 600-1000', price: 600 },
        { name: 'Промивка системи охолодження', price_text: 'від 600-1000', price: 600 },
        { name: 'Заміна патрубка сис. охолодження', price_text: 'від 300', price: 300 },
        { name: 'Заміна радіатора пічки', price_text: 'від 500-4000', price: 500 },
        { name: 'Заміна розширювального бачка', price_text: 'від 100-300', price: 100 },
      ],
    },
    {
      category: 'Система запалювання',
      items: [
        { name: 'Заміна свічки запалювання', price_text: 'від 250-1000 (зі зняттям колектора)', price: 250 },
        { name: 'Заміна котушки запалювання', price_text: 'від 250-1000', price: 250 },
        { name: 'Заміна ПВН', price_text: 'від 100-400', price: 100 },
        { name: 'Заміна модуля запалювання', price_text: 'від 200-600', price: 200 },
        { name: 'Заміна замка запалювання', price_text: 'від 400-1500', price: 400 },
      ],
    },
    {
      category: 'Вихлопна система',
      items: [
        { name: 'Заміна глушника на хомутах', price_text: 'від 300-500', price: 300 },
        { name: 'Заміна глушника (варка, різка)', price_text: 'від 700-1000', price: 700 },
        { name: 'Ремонт глушника', price_text: 'від 500', price: 500 },
        { name: 'Заміна резонатора на хомутах', price_text: 'від 300-500', price: 300 },
        { name: 'Заміна резонатора (варка, різка)', price_text: 'від 700-1000', price: 700 },
        { name: 'Ремонт резонатора', price_text: 'від 500', price: 500 },
        { name: 'Ремонт каталізатора', price_text: 'від 500', price: 500 },
        { name: 'Заміна гофри (варка, різка)', price_text: 'від 1000', price: 1000 },
        { name: 'Заміна штанів', price_text: 'від 400', price: 400 },
        { name: 'Ремонт штанів (варка, різка)', price_text: 'від 700-1000', price: 700 },
        { name: 'Заміна прокладки штанів', price_text: 'від 400', price: 400 },
      ],
    },
    {
      category: 'Послуги автоелектрика',
      items: [
        { name: 'Заміна генератора', price_text: 'від 300-750', price: 300 },
        { name: 'Заміна стартера', price_text: 'від 300-750', price: 300 },
        { name: 'Ремонт генератора', price_text: 'від 500', price: 500 },
        { name: 'Ремонт стартера', price_text: 'від 500', price: 500 },
        { name: 'Пошук витоку струму', price_text: 'від 300-350 грн/год', price: 300, ...hourly },
        { name: 'Ремонт автопроводки', price_text: 'від 400 грн/год', price: 400, ...hourly },
        { name: 'Заміна датчика', price_text: 'від 100-200 (в доступі)', price: 100 },
        { name: 'Заміна лампи', price_text: 'від 100', price: 100 },
        { name: 'Заміна мотора склопідійомника', price_text: 'від 300', price: 300 },
        { name: 'Заміна моторчика пічки', price_text: 'від 300', price: 300 },
      ],
    },
    {
      category: 'Додаткові послуги',
      items: [
        { name: 'Зняття/встановлення захисту', price_text: 'від 150', price: 150 },
        { name: 'Зняття/встановлення кенгурятника', price_text: 'від 200', price: 200 },
        { name: 'Зняття/встановлення карти двері', price_text: 'від 200-400', price: 200 },
        { name: 'Зняття/встановлення бампера', price_text: 'від 400-1200', price: 400 },
        { name: 'Зняття/встановлення капота', price_text: 'від 300-500', price: 300 },
        { name: 'Зняття/встановлення двері', price_text: 'від 400-650', price: 400 },
        { name: 'Зняття/встановлення кришки багажника', price_text: 'від 400-650', price: 400 },
        { name: 'Заміна АКБ (під капотом)', price_text: '150', price: 150 },
        { name: 'Заміна АКБ (в багажнику)', price_text: '250', price: 250 },
        { name: 'Заміна АКБ (під сидінням, в бампері)', price_text: '400', price: 400 },
        { name: 'Зарядка АКБ', price_text: '150', price: 150 },
        { name: 'Підйом машини на підйомнику', price_text: '100', price: 100 },
        { name: 'Слюсарні роботи (погодинно)', price_text: 'від 300-800 грн/год', price: 300, ...hourly },
      ],
    },
  ];
};

async function seedPriceList(options = {}) {
  const db = await getDb();
  const now = new Date().toISOString();
  const list = buildPriceList();

  const serviceColumns = await db.prepare('PRAGMA table_info(services)').all();
  const serviceNames = new Set((serviceColumns || []).map((c) => c.name));
  const hasPriceText = serviceNames.has('price_text');
  const hasDurationText = serviceNames.has('duration_text');

  const stationId = options.service_station_id || null;

  for (const group of list) {
    const categoryName = String(group.category).trim();
    if (!categoryName) continue;

    const categoryId = stableId('cat', categoryName);
    await db
      .prepare(
        'INSERT INTO service_categories (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, updated_at = excluded.updated_at'
      )
      .run(categoryId, categoryName, null, now, now);

    for (const item of group.items || []) {
      const serviceName = String(item.name || '').trim();
      if (!serviceName) continue;

      const serviceKey = `${categoryId}::${serviceName}`;
      const serviceId = stableId('srv', serviceKey);

      const priceText = item.price_text != null ? String(item.price_text) : null;
      const durationText = item.duration_text != null ? String(item.duration_text) : null;

      const price = item.price != null ? Number(item.price) : parseMinNumber(priceText);
      const duration = item.duration != null ? Number(item.duration) : null;

      const columns = ['id', 'name', 'description', 'price'];
      const values = [serviceId, serviceName, null, Number.isFinite(price) ? price : null];

      if (hasPriceText) {
        columns.push('price_text');
        values.push(priceText);
      }

      columns.push('duration');
      values.push(Number.isFinite(duration) ? duration : null);

      if (hasDurationText) {
        columns.push('duration_text');
        values.push(durationText);
      }

      columns.push(
        'is_active',
        'service_station_id',
        'category_id',
        'created_at',
        'updated_at'
      );
      values.push(1, stationId, categoryId, now, now);

      const placeholders = columns.map(() => '?').join(', ');
      await db
        .prepare(
          `INSERT INTO services (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${columns
            .filter((c) => c !== 'id' && c !== 'created_at')
            .map((c) => `${c} = excluded.${c}`)
            .join(', ')}`
        )
        .run(...values);
    }
  }

  logger.info('Прайс-лист послуг імпортовано/оновлено');
}

module.exports = { seedPriceList };

if (require.main === module) {
  seedPriceList().catch((err) => {
    logger.error('Seed price list failed:', err);
    process.exitCode = 1;
  });
}
