import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Alert,
  CircularProgress
} from '@mui/material';

const Register = () => {
  const { t } = useTranslation();

  const [phoneError, setPhoneError] = useState('');
  const navigate = useNavigate();
  const { register } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    patronymic: '',
    region: '',
    city: '',
    email: '',
    phone: '',
    password: '',
    role: 'client'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      const phoneRegex = /^(\+?380|0)\d{0,9}$/;
      if (!phoneRegex.test(value)) {
        setPhoneError(t('auth.errors.phone_format'));
      } else {
        setPhoneError('');
      }
    }

    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const isMaster = formData.role === 'master';
      const missingRequired =
        !formData.name?.trim() ||
        !formData.lastName?.trim() ||
        !formData.region?.trim() ||
        !formData.city?.trim() ||
        (isMaster && !formData.patronymic?.trim());

      if (missingRequired) {
        throw new Error(t('auth.errors.required_field'));
      }

      // Логування початкових даних
      console.log('Початок реєстрації користувача:', {
        name: formData.name,
        lastName: formData.lastName,
        patronymic: formData.patronymic,
        region: formData.region,
        city: formData.city,
        email: formData.email,
        phone: formData.phone,
        role: formData.role
      });
      
      // Форматування та валідація номера телефону
      let cleanedPhone = formData.phone.trim().replace(/\s+/g, '');
      console.log('Очищений номер телефону:', cleanedPhone);
      
      // Перевірка формату телефону
      if (!cleanedPhone.match(/^(\+?380|0)\d{9}$/)) {
        console.error('Помилка валідації телефону:', cleanedPhone);
        throw new Error(t('auth.errors.phone_format'));
      }
      
      // Форматування до єдиного формату +380XXXXXXXXX
      if (cleanedPhone.startsWith('0')) {
        cleanedPhone = '+380' + cleanedPhone.slice(1);
      } else if (cleanedPhone.startsWith('380')) {
        cleanedPhone = '+' + cleanedPhone;
      }
      console.log('Відформатований номер телефону:', cleanedPhone);

      console.log('Відправка даних на сервер...');
      const response = await register({
        ...formData,
        phone: cleanedPhone
      });
      
      if (response.success) {
        setError(null);
        if (response.requiresEmailConfirmation) {
          // Показуємо повідомлення про необхідність підтвердження email
          setError(response.message);
          // Перенаправляємо на сторінку входу через 3 секунди
          setTimeout(() => {
            navigate('/auth/login');
          }, 3000);
        } else {
          // Якщо підтвердження email не потрібне, перенаправляємо на головну сторінку
          console.log('Реєстрація успішна, перенаправлення на головну сторінку');
          navigate('/');
        }
      }
    } catch (err) {
      console.error('Помилка реєстрації:', err);
      setError(err.message || err.response?.data?.msg || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography component="h1" variant="h5">
            {t('auth.register')}
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              select
              name="role"
              label={t('auth.role')}
              id="role"
              value={formData.role}
              onChange={handleChange}
              SelectProps={{
                native: true
              }}
            >
              <option value="client">{t('auth.roleClient')}</option>
              <option value="master">{t('auth.roleMaster')}</option>
            </TextField>
            <TextField
              margin="normal"
              required
              fullWidth
              id="name"
              label={t('auth.name')}
              name="name"
              autoFocus
              value={formData.name}
              onChange={handleChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="lastName"
              label={t('auth.lastName')}
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
            />
            {formData.role === 'master' && (
              <TextField
                margin="normal"
                required
                fullWidth
                id="patronymic"
                label={t('auth.patronymic')}
                name="patronymic"
                value={formData.patronymic}
                onChange={handleChange}
              />
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              id="region"
              label={t('auth.region')}
              name="region"
              value={formData.region}
              onChange={handleChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="city"
              label={t('auth.city')}
              name="city"
              value={formData.city}
              onChange={handleChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label={t('auth.email')}
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="phone"
              label={t('auth.phone')}
              name="phone"
              value={formData.phone}
              inputMode="tel"
              error={!!phoneError}
              helperText={phoneError}
              onChange={handleChange}
              placeholder="+380XXXXXXXXX"
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label={t('auth.password')}
              type="password"
              id="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : t('auth.register')}
            </Button>
            <Grid container justifyContent="flex-end">
              <Grid item>
                <Link to="/auth/login" variant="body2">
                  {t('auth.login')}
                </Link>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Register;
