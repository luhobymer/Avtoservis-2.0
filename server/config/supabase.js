require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Створюємо клієнт Supabase з змінних середовища
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = { supabase };
