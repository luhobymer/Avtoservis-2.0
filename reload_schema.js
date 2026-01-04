require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function reloadSchema() {
  try {
    console.log('Attempting to reload schema cache...');
    
    // Спробуємо виконати NOTIFY команду
    const { data, error } = await supabase.rpc('exec_sql', {
      query: "NOTIFY pgrst, 'reload schema'"
    });
    
    if (error) {
      console.log('Error reloading schema:', error);
    } else {
      console.log('Schema reload successful:', data);
    }
    
    // Також спробуємо альтернативний метод
    console.log('\nTrying alternative method...');
    const { data: data2, error: error2 } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (error2) {
      console.log('Users table access error:', error2);
    } else {
      console.log('Users table accessible:', data2);
    }
    
  } catch (err) {
    console.error('Script error:', err);
  }
}

reloadSchema();