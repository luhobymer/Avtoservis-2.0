import React, { useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';

const useQueryParams = () => {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const params = useQueryParams();
  const initialEmail = params.get('email') || '';
  const token = params.get('token') || '';

  const [email, setEmail] = useState(initialEmail);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError('Відсутній токен для скидання пароля');
      return;
    }
    if (!email) {
      setError('Вкажіть email');
      return;
    }
    if (newPassword.length < 8) {
      setError('Пароль має бути мінімум 8 символів');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Паролі не співпадають');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        '/api/auth/reset-password',
        { email, token, newPassword },
        { withCredentials: true }
      );
      setSuccess(response?.data?.message || 'Пароль змінено');
      setTimeout(() => navigate('/auth/login'), 1200);
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || 'Помилка при зміні пароля';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography component="h1" variant="h5">
            Встановити новий пароль
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ width: '100%', mt: 2 }}>
              {success}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="newPassword"
              label="Новий пароль"
              type="password"
              id="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Повторіть пароль"
              type="password"
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Змінити пароль'}
            </Button>
            <Button
              component={RouterLink}
              to="/auth/login"
              fullWidth
              sx={{ mt: 1 }}
            >
              Повернутись до входу
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default ResetPassword;
