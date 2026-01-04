const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAppointmentsDirect() {
  console.log('🔧 Виправлення структури таблиці appointments (прямий метод)...');
  
  try {
    // Перевіряємо поточні колонки
    console.log('📋 Перевірка поточних колонок appointments...');
    
    const { data: currentColumns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'appointments')
      .eq('table_schema', 'public');
    
    if (columnsError) {
      console.error('❌ Помилка при отриманні колонок:', columnsError);
      return;
    }
    
    const existingColumns = currentColumns.map(col => col.column_name);
    console.log('📊 Існуючі колонки:', existingColumns);
    
    // Список колонок, які потрібно додати
    const requiredColumns = [
      { name: 'service_id', type: 'UUID', constraint: 'REFERENCES services(id) ON DELETE CASCADE' },
      { name: 'mechanic_id', type: 'UUID', constraint: 'REFERENCES mechanics(id) ON DELETE SET NULL' },
      { name: 'station_id', type: 'UUID', constraint: 'REFERENCES service_stations(id) ON DELETE CASCADE' },
      { name: 'vehicle_id', type: 'UUID', constraint: 'REFERENCES vehicles(id) ON DELETE CASCADE' },
      { name: 'notes', type: 'TEXT', constraint: null },
      { name: 'completion_notes', type: 'TEXT', constraint: null }
    ];
    
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col.name));
    
    if (missingColumns.length === 0) {
      console.log('✅ Всі необхідні колонки вже існують!');
      return;
    }
    
    console.log('🔍 Відсутні колонки:', missingColumns.map(col => col.name));
    
    // Створюємо SQL команди для додавання колонок
    const alterCommands = [];
    
    for (const column of missingColumns) {
      let sql = `ALTER TABLE appointments ADD COLUMN ${column.name} ${column.type}`;
      if (column.constraint) {
        sql += ` ${column.constraint}`;
      }
      alterCommands.push(sql);
    }
    
    // Додаємо команди для створення індексів
    const indexCommands = [
      'CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments(service_id)',
      'CREATE INDEX IF NOT EXISTS idx_appointments_mechanic_id ON appointments(mechanic_id)',
      'CREATE INDEX IF NOT EXISTS idx_appointments_station_id ON appointments(station_id)',
      'CREATE INDEX IF NOT EXISTS idx_appointments_vehicle_id ON appointments(vehicle_id)'
    ];
    
    const allCommands = [...alterCommands, ...indexCommands];
    
    console.log('📝 SQL команди для виконання:');
    allCommands.forEach((cmd, index) => {
      console.log(`   ${index + 1}. ${cmd}`);
    });
    
    // Зберігаємо команди у файл
    const fs = require('fs');
    const sqlContent = allCommands.join(';\n') + ';';
    fs.writeFileSync('fix_appointments_manual.sql', sqlContent);
    
    console.log('\n💾 SQL команди збережено у файл fix_appointments_manual.sql');
    console.log('\n📋 ІНСТРУКЦІЇ ДЛЯ РУЧНОГО ВИКОНАННЯ:');
    console.log('   1. Відкрийте Supabase Dashboard');
    console.log('   2. Перейдіть до SQL Editor');
    console.log('   3. Скопіюйте та виконайте наступні команди по одній:');
    console.log('\n' + '='.repeat(60));
    allCommands.forEach((cmd, index) => {
      console.log(`-- Команда ${index + 1}:`);
      console.log(cmd + ';');
      console.log('');
    });
    console.log('='.repeat(60));
    
    console.log('\n⚠️  ВАЖЛИВО: Виконайте ці команди в Supabase Dashboard, а потім перезапустіть сервер!');
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error);
  }
}

fixAppointmentsDirect();