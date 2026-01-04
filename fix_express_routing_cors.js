// ========================================
// ВИПРАВЛЕННЯ EXPRESS МАРШРУТИЗАЦІЇ ТА CORS
// ========================================

// Цей файл містить оновлений код для server/index.js
// з правильною маршрутизацією та CORS налаштуваннями

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Ініціалізація Supabase клієнта
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ========================================
// MIDDLEWARE НАЛАШТУВАННЯ
// ========================================

// Безпека
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.SUPABASE_URL]
    }
  }
}));

// CORS налаштування
const corsOptions = {
  origin: function (origin, callback) {
    // Дозволяємо запити без origin (мобільні додатки, Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      process.env.FRONTEND_URL,
      process.env.SUPABASE_URL
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'apikey',
    'x-client-info'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 хвилин
  max: 100, // максимум 100 запитів на IP
  message: {
    error: 'Забагато запитів з цього IP, спробуйте пізніше.',
    retryAfter: '15 хвилин'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Парсинг JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Логування запитів
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ========================================
// MIDDLEWARE ДЛЯ АВТЕНТИФІКАЦІЇ
// ========================================

const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Токен автентифікації відсутній або неправильний формат' 
      });
    }
    
    const token = authHeader.substring(7);
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ 
        error: 'Недійсний токен автентифікації' 
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Помилка автентифікації:', error);
    res.status(500).json({ 
      error: 'Внутрішня помилка сервера при автентифікації' 
    });
  }
};

// ========================================
// API МАРШРУТИ
// ========================================

// Здоров'я сервера
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ========================================
// АВТЕНТИФІКАЦІЯ
// ========================================

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email та пароль є обов\'язковими' 
      });
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone
        }
      }
    });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(201).json({ 
      message: 'Користувач створений успішно',
      user: data.user 
    });
  } catch (error) {
    console.error('Помилка реєстрації:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email та пароль є обов\'язковими' 
      });
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      return res.status(401).json({ error: error.message });
    }
    
    res.json({ 
      message: 'Вхід виконано успішно',
      user: data.user,
      session: data.session 
    });
  } catch (error) {
    console.error('Помилка входу:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

app.post('/api/auth/signout', authenticateUser, async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json({ message: 'Вихід виконано успішно' });
  } catch (error) {
    console.error('Помилка виходу:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// ========================================
// КОРИСТУВАЧІ
// ========================================

app.get('/api/users/me', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_profile', { user_uuid: req.user.id });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json(data[0] || {});
  } catch (error) {
    console.error('Помилка отримання профілю:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

app.put('/api/users/me', authenticateUser, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    
    const { data, error } = await supabase
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.id)
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json({ 
      message: 'Профіль оновлено успішно',
      user: data 
    });
  } catch (error) {
    console.error('Помилка оновлення профілю:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// ========================================
// АВТОМОБІЛІ
// ========================================

app.get('/api/vehicles', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_vehicles', { user_uuid: req.user.id });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Помилка отримання автомобілів:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

app.post('/api/vehicles', authenticateUser, async (req, res) => {
  try {
    const { make, model, year, vin, licensePlate, mileage } = req.body;
    
    if (!make || !model || !year) {
      return res.status(400).json({ 
        error: 'Марка, модель та рік є обов\'язковими' 
      });
    }
    
    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        user_id: req.user.id,
        make,
        model,
        year: parseInt(year),
        vin,
        license_plate: licensePlate,
        mileage: mileage ? parseInt(mileage) : null
      })
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(201).json({ 
      message: 'Автомобіль додано успішно',
      vehicle: data 
    });
  } catch (error) {
    console.error('Помилка додавання автомобіля:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// ========================================
// ЗАПИСИ НА ОБСЛУГОВУВАННЯ
// ========================================

app.get('/api/appointments', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_appointments', { user_uuid: req.user.id });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Помилка отримання записів:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

app.post('/api/appointments', authenticateUser, async (req, res) => {
  try {
    const { serviceStationId, vehicleId, serviceType, appointmentDate, notes } = req.body;
    
    if (!serviceStationId || !vehicleId || !serviceType || !appointmentDate) {
      return res.status(400).json({ 
        error: 'Всі обов\'язкові поля повинні бути заповнені' 
      });
    }
    
    const { data, error } = await supabase
      .rpc('create_appointment', {
        p_service_station_id: serviceStationId,
        p_vehicle_id: vehicleId,
        p_service_type: serviceType,
        p_appointment_date: appointmentDate,
        p_notes: notes,
        user_uuid: req.user.id
      });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(201).json({ 
      message: 'Запис створено успішно',
      appointmentId: data 
    });
  } catch (error) {
    console.error('Помилка створення запису:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// ========================================
// НАГАДУВАННЯ
// ========================================

app.get('/api/reminders', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_reminders', { user_uuid: req.user.id });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Помилка отримання нагадувань:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

app.post('/api/reminders', authenticateUser, async (req, res) => {
  try {
    const { title, description, reminderType, dueDate, vehicleId, dueMileage, priority } = req.body;
    
    if (!title || !reminderType || !dueDate) {
      return res.status(400).json({ 
        error: 'Назва, тип та дата є обов\'язковими' 
      });
    }
    
    const { data, error } = await supabase
      .rpc('create_reminder', {
        p_title: title,
        p_description: description,
        p_reminder_type: reminderType,
        p_due_date: dueDate,
        p_vehicle_id: vehicleId,
        p_due_mileage: dueMileage,
        p_priority: priority || 'medium',
        user_uuid: req.user.id
      });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(201).json({ 
      message: 'Нагадування створено успішно',
      reminderId: data 
    });
  } catch (error) {
    console.error('Помилка створення нагадування:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// ========================================
// ПОВІДОМЛЕННЯ
// ========================================

app.get('/api/notifications', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_notifications', { user_uuid: req.user.id });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Помилка отримання повідомлень:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

app.patch('/api/notifications/:id/read', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .rpc('mark_notification_read', {
        p_notification_id: id,
        user_uuid: req.user.id
      });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Повідомлення не знайдено' });
    }
    
    res.json({ message: 'Повідомлення позначено як прочитане' });
  } catch (error) {
    console.error('Помилка оновлення повідомлення:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// ========================================
// ПУБЛІЧНІ ДАНІ
// ========================================

app.get('/api/stations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('api_service_stations')
      .select('*')
      .order('name');
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Помилка отримання станцій:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('api_services')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Помилка отримання послуг:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

app.get('/api/mechanics', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('api_mechanics')
      .select('*')
      .order('rating', { ascending: false });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Помилка отримання механіків:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// ========================================
// ОБРОБКА ПОМИЛОК
// ========================================

// 404 для API маршрутів
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API ендпоінт не знайдено',
    path: req.path,
    method: req.method
  });
});

// Глобальний обробник помилок
app.use((error, req, res, next) => {
  console.error('Глобальна помилка:', error);
  
  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      error: 'CORS: Доступ заборонено',
      origin: req.headers.origin 
    });
  }
  
  res.status(500).json({ 
    error: 'Внутрішня помилка сервера',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// ========================================
// ЗАПУСК СЕРВЕРА
// ========================================

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущено на порту ${PORT}`);
  console.log(`📡 API доступне за адресою: http://localhost:${PORT}/api`);
  console.log(`🔒 CORS налаштовано для: ${corsOptions.origin}`);
  console.log(`📊 Supabase URL: ${process.env.SUPABASE_URL}`);
});

module.exports = app;