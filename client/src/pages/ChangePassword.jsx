import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import axios from 'axios';

const ChangePassword = () => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
    if (success) setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = formData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('validation.please_fill_all_fields'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('validation.password_min_length'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('validation.passwords_do_not_match', 'Паролі не співпадають'));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const baseURL = import.meta.env.VITE_API_BASE_URL || '';
      const response = await axios.post(
        `${baseURL}/api/auth/change-password`,
        { currentPassword, newPassword },
        { withCredentials: true }
      );

      if (response?.data?.status === 'success') {
        setSuccess(true);
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setTimeout(async () => {
          try {
            if (logout) {
              await logout();
            }
          } catch (e) {
            console.error('Logout error:', e);
          }
          window.location.href = '/auth/login';
        }, 2000);
      } else {
        const message =
          response?.data?.message ||
          t('auth.password_change_failed', 'Не вдалося змінити пароль');
        setError(message);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        t('auth.password_change_failed', 'Не вдалося змінити пароль');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
            {t('auth.change_password', 'Змінити пароль')}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
              {t('auth.password_changed', 'Пароль успішно змінено. Ви будете перенаправлені на вхід.')}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              name="currentPassword"
              label={t('auth.current_password', 'Поточний пароль')}
              type="password"
              value={formData.currentPassword}
              onChange={handleChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="newPassword"
              label={t('auth.new_password', 'Новий пароль')}
              type="password"
              value={formData.newPassword}
              onChange={handleChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label={t('auth.confirm_password', 'Підтвердіть пароль')}
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : t('common.save')}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default ChangePassword;

