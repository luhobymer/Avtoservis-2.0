import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  
  
  // Стан для діалогових вікон
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  
  // Стан для форм
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  
  // Генерація секрету 2FA
  const generateSecret = async () => {
    setLoading(true);
    setError(null);
    try {
      setError(t('2fa.setup_error'));
      setSetupDialogOpen(false);
      setVerifyDialogOpen(true);
    } finally {
      setLoading(false);
    }
  };
  
  // Верифікація та активація 2FA
  const verifyAndEnable = async () => {
    if (!verificationCode) {
      setError(t('validation.please_fill_all_fields'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setError(t('2fa.verification_error'));
    } finally {
      setLoading(false);
    }
  };
  
  // Відключення 2FA
  const disableTwoFactor = async () => {
    if (!password) {
      setError(t('validation.please_fill_all_fields'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setError(t('errors.failedToDisableTwoFactor'));
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
      
      
      
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography>
          {t('profile.two_factor_auth_description')}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={user?.twoFactorEnabled || false}
              onChange={handleToggle}
              color="primary"
            />
          }
          label={user?.twoFactorEnabled ? t('profile.enabled') : t('profile.disabled')}
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
