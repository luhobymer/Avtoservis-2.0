import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import { 
  Box, 
  Typography, 
  Button, 
  TextField, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Alert, 
  CircularProgress,
  Paper,
  Divider,
  Switch,
  FormControlLabel
} from '@mui/material';

const TwoFactorAuth = ({ user }) => {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [enabled, setEnabled] = useState(!!user?.twoFactorEnabled);
  
  
  
  // Стан для діалогових вікон
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  
  // Стан для форм
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    setEnabled(!!user?.twoFactorEnabled);
  }, [user?.twoFactorEnabled]);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const resolveUrl = (url) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

  const requestJson = async (url, options = {}) => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(resolveUrl(url), {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody && typeof errorBody.message === 'string') {
          message = errorBody.message;
        }
      } catch (error) {
        void error;
      }
      throw new Error(message);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return null;
  };
  
  // Генерація секрету 2FA
  const generateSecret = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await requestJson('/api/auth/2fa/generate');
      setQrCode(data?.qrCode || '');
      setSecret(data?.secret || '');
      setSetupDialogOpen(false);
      setVerifyDialogOpen(true);
    } catch (err) {
      setError(
        err?.message ||
          t('2fa.setup_error', 'Не вдалося згенерувати дані для двофакторної автентифікації')
      );
    } finally {
      setLoading(false);
    }
  };
  
  // Верифікація та активація 2FA
  const verifyAndEnable = async () => {
    if (!verificationCode) {
      setError(t('validation.please_fill_all_fields', 'Заповніть всі поля'));
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await requestJson('/api/auth/2fa/verify', {
        method: 'POST',
        body: { token: verificationCode }
      });
      setVerifyDialogOpen(false);
      setVerificationCode('');
      setEnabled(true);
      setSuccess(t('profile.two_factor_enabled', 'Двофакторну автентифікацію активовано'));
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      setError(err?.message || t('2fa.verification_error', 'Невірний код підтвердження'));
    } finally {
      setLoading(false);
    }
  };
  
  // Відключення 2FA
  const disableTwoFactor = async () => {
    if (!password) {
      setError(t('validation.please_fill_all_fields', 'Заповніть всі поля'));
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await requestJson('/api/auth/2fa/disable', {
        method: 'POST',
        body: { password }
      });
      setDisableDialogOpen(false);
      setPassword('');
      setEnabled(false);
      setQrCode('');
      setSecret('');
      setSuccess(t('profile.two_factor_disabled', 'Двофакторну автентифікацію відключено'));
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      setError(err?.message || t('errors.failedToDisableTwoFactor', 'Не вдалося вимкнути 2FA'));
    } finally {
      setLoading(false);
    }
  };
  
  // Обробник зміни статусу 2FA
  const handleToggle = (event) => {
    if (event.target.checked) {
      setSetupDialogOpen(true);
    } else {
      setDisableDialogOpen(true);
    }
  };
  
  return (
    <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        {t('profile.two_factor_auth')}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      
      
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography>
          {t('profile.two_factor_auth_description')}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={handleToggle}
              color="primary"
              disabled={loading}
            />
          }
          label={enabled ? t('profile.enabled', 'Увімкнено') : t('profile.disabled', 'Вимкнено')}
        />
      </Box>
      
      {/* Діалогове вікно для налаштування 2FA */}
      <Dialog open={setupDialogOpen} onClose={() => setSetupDialogOpen(false)}>
        <DialogTitle>{t('profile.setup_two_factor')}</DialogTitle>
        <DialogContent>
          <Typography paragraph>
            {t('profile.two_factor_setup_description')}
          </Typography>
          <Typography paragraph>
            {t('profile.two_factor_app_instruction')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetupDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={generateSecret}
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : t('profile.continue')}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Діалогове вікно для верифікації 2FA */}
      <Dialog open={verifyDialogOpen} onClose={() => setVerifyDialogOpen(false)}>
        <DialogTitle>{t('profile.verify_two_factor')}</DialogTitle>
        <DialogContent>
          
          
          <Typography paragraph>
            {t('profile.scan_qr_code')}
          </Typography>

          {qrCode && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
              <Box
                component="img"
                src={qrCode}
                alt={t('profile.qr_code', 'QR-код')}
                sx={{ width: 200, height: 200, mb: 1 }}
              />
              {secret && (
                <Typography variant="body2" color="text.secondary">
                  {t('profile.manual_code', 'Код для ручного введення')}: {secret}
                </Typography>
              )}
            </Box>
          )}
          
          <TextField
            label={t('profile.verification_code')}
            fullWidth
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            margin="normal"
            autoFocus
            inputProps={{ maxLength: 6 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerifyDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={verifyAndEnable}
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : t('profile.verify_and_enable')}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Діалогове вікно для відключення 2FA */}
      <Dialog open={disableDialogOpen} onClose={() => setDisableDialogOpen(false)}>
        <DialogTitle>{t('profile.disable_two_factor')}</DialogTitle>
        <DialogContent>
          <Typography paragraph>
            {t('profile.disable_two_factor_warning')}
          </Typography>
          
          <TextField
            label={t('auth.password')}
            fullWidth
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            onClick={disableTwoFactor}
            variant="contained" 
            color="error"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : t('profile.disable')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TwoFactorAuth;
