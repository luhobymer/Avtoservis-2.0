require('dotenv/config');
const dotenv = require('dotenv');
dotenv.config({ path: './server/.env' });

const supabase = require('../config/supabaseClient.js');

async function up() {
  const { data, error } = await supabase.rpc('alter_table_add_column', {
    table: 'users',
    column: 'phone',
    type: 'text',
  });

  if (error) throw error;
  console.log('Added phone column to users table');
}

async function down() {
  const { data, error } = await supabase.rpc('alter_table_drop_column', {
    table: 'users',
    column: 'phone',
  });

  if (error) throw error;
  console.log('Removed phone column from users table');
}
