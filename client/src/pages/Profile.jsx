import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import { UA_REGION_NAMES, getCitiesByRegion } from '../data/uaRegionsCities';
import TwoFactorAuth from '../components/TwoFactorAuth';
import { getUserSettings, updateUserSettings } from '../api/dao/userSettingsDao';
import {
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Box,
  Divider,
  MenuItem,
  Switch,
  FormControlLabel
} from '@mui/material';
import * as webPushDao from '../api/dao/webPushDao';

const normalizeNotificationPermission = () => {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission || 'default';
  } catch (_) {
    return 'default';
  }
};

const urlBase64ToUint8Array = (base64String) => {
  if (!base64String) return null;
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
};

const Profile = () => {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();

  const [loading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    patronymic: '',
    region: '',
    city: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settings, setSettings] = useState(null);

  const [notificationPermission, setNotificationPermission] = useState(normalizeNotificationPermission());
  const [webPushLoading, setWebPushLoading] = useState(false);
  const [webPushError, setWebPushError] = useState('');
  const [webPushEndpoint, setWebPushEndpoint] = useState('');
  const [webPushSupported, setWebPushSupported] = useState(false);

  useEffect(() => {
    if (user) {
      console.log('[Profile] User data from context:', user);

      // Додаємо підтримку різних форматів даних
      const userName = user.firstName || user.first_name || user.name || user.full_name || user.username || '';
      const userLastName = user.lastName || user.last_name || '';
      const userPatronymic = user.patronymic || '';
      const userRegion = user.region || '';
      const userCity = user.city || '';
      const userEmail = user.email || '';
      const userPhone = user.phone || user.phone_number || '';

      setFormData(prev => ({
        ...prev,
        name: userName,
        lastName: userLastName,
        patronymic: userPatronymic,
        region: userRegion,
        city: userCity,
        email: userEmail,
        phone: userPhone
      }));

      console.log('[Profile] Form data set:', {
        name: userName,
        lastName: userLastName,
        patronymic: userPatronymic,
        region: userRegion,
        city: userCity,
        email: userEmail,
        phone: userPhone
      });
    }
  }, [user]);

  const loadSettings = useCallback(async () => {
    if (!user?.id) return;
    setSettingsLoading(true);
    setSettingsError('');
    try {
      const payload = await getUserSettings(user.id);
      setSettings(payload?.settings ?? null);
    } catch (err) {
      setSettings(null);
      setSettingsError(err?.message || t('common.error', 'Помилка'));
    } finally {
      setSettingsLoading(false);
    }
  }, [t, user?.id]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const update = () => setNotificationPermission(normalizeNotificationPermission());
    update();
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, []);

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      typeof Notification !== 'undefined';
    setWebPushSupported(!!supported);
  }, []);

  useEffect(() => {
    if (!webPushSupported) return;

    let alive = true;
    const run = async () => {
      try {
        setWebPushError('');
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!alive) return;
        setWebPushEndpoint(sub?.endpoint ? String(sub.endpoint) : '');
      } catch (err) {
        if (!alive) return;
        setWebPushEndpoint('');
        setWebPushError(err?.message || t('common.error', 'Помилка'));
      }
    };

    void run();
    return () => {
      alive = false;
    };
  }, [t, webPushSupported, notificationPermission]);

  const mergedSettings = useMemo(() => {
    const s = settings && typeof settings === 'object' ? settings : {};
    return {
      notifications: {
        enabled: s?.notifications?.enabled ?? false,
        reminders: s?.notifications?.reminders ?? true,
        appointments: s?.notifications?.appointments ?? true,
        chat: s?.notifications?.chat ?? true
      },
      integrations: {
        telegramEnabled: s?.integrations?.telegramEnabled ?? false,
        telegramUsername: s?.integrations?.telegramUsername ?? ''
      },
      locale: {
        language: s?.locale?.language ?? ''
      },
      appearance: {
        darkMode: s?.appearance?.darkMode ?? false
      }
    };
  }, [settings]);

  const saveSettings = async (nextSettings) => {
    if (!user?.id) return;
    setSettingsSaving(true);
    setSettingsError('');
    try {
      const payload = await updateUserSettings(user.id, nextSettings);
      const persisted = payload?.settings ?? nextSettings;
      setSettings(persisted);
      try {
        window.dispatchEvent(new CustomEvent('userSettingsUpdated', { detail: persisted }));
      } catch (_) {
        void _;
      }
    } catch (err) {
      setSettingsError(err?.message || t('common.error', 'Помилка'));
    } finally {
      setSettingsSaving(false);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      if (typeof Notification === 'undefined') return;
      await Notification.requestPermission();
      setNotificationPermission(normalizeNotificationPermission());
    } catch (_) {
      void _;
    }
  };

  const enableWebPush = async () => {
    if (!webPushSupported) return;
    setWebPushLoading(true);
    setWebPushError('');
    try {
      if (notificationPermission === 'denied') {
        throw new Error(
          t('reminders.notificationsDenied', 'Сповіщення вимкнені в налаштуваннях браузера.')
        );
      }

      if (notificationPermission !== 'granted') {
        await requestNotificationPermission();
      }

      const afterPermission = normalizeNotificationPermission();
      if (afterPermission !== 'granted') {
        if (afterPermission === 'denied') {
          throw new Error(
            t('reminders.notificationsDenied', 'Сповіщення вимкнені в налаштуваннях браузера.')
          );
        }
        throw new Error(t('reminders.notificationsDefault', 'Дозвольте сповіщення, щоб отримувати нагадування.'));
      }

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing?.endpoint) {
        await webPushDao.subscribe(existing);
        setWebPushEndpoint(String(existing.endpoint));
        return;
      }

      const publicKey = await webPushDao.getVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      if (!applicationServerKey) {
        throw new Error('Invalid VAPID public key');
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      await webPushDao.subscribe(sub);
      setWebPushEndpoint(sub?.endpoint ? String(sub.endpoint) : '');
    } catch (err) {
      setWebPushError(err?.message || t('common.error', 'Помилка'));
    } finally {
      setWebPushLoading(false);
    }
  };

  const disableWebPush = async () => {
    if (!webPushSupported) return;
    setWebPushLoading(true);
    setWebPushError('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint ? String(sub.endpoint) : webPushEndpoint;
      if (endpoint) {
        await webPushDao.unsubscribe(endpoint);
      }
      if (sub) {
        await sub.unsubscribe();
      }
      setWebPushEndpoint('');
    } catch (err) {
      setWebPushError(err?.message || t('common.error', 'Помилка'));
    } finally {
      setWebPushLoading(false);
    }
  };

  const testWebPush = async () => {
    setWebPushLoading(true);
    setWebPushError('');
    try {
      await webPushDao.testPush();
    } catch (err) {
      setWebPushError(err?.message || t('common.error', 'Помилка'));
    } finally {
      setWebPushLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'region') {
      setFormData({
        ...formData,
        region: value,
        city: ''
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
    // Clear success message when form is changed
    if (success) setSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    // Validate passwords if trying to change password
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        setError(t('errors.currentPasswordRequired'));
        setSaving(false);
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError(t('errors.passwordsDoNotMatch'));
        setSaving(false);
        return;
      }
    }

    try {
      const fullName = [formData.name, formData.lastName, formData.patronymic]
        .filter(Boolean)
        .join(' ')
        .trim();
      const payload = {
        name: fullName || formData.name,
        phone: formData.phone,
        firstName: formData.name,
        lastName: formData.lastName,
        patronymic: formData.patronymic,
        region: formData.region,
        city: formData.city
      };
      if (formData.newPassword) {
        payload.newPassword = formData.newPassword;
      }
      if (updateProfile) {
        await updateProfile(payload);
      }
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      setSuccess(true);
    } catch (err) {
      setError(err.message || t('errors.failedToUpdateProfile'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {t('nav.profile')}
        </Typography>
        <Divider sx={{ mb: 3 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {t('common.success')}: {t('nav.profile')} {t('common.save').toLowerCase()}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                {t('auth.name')}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label={t('auth.name')}
                name="name"
                value={formData.name}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label={t('auth.lastName')}
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
              />
            </Grid>

            {(user?.role || '').toLowerCase() === 'master' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label={t('auth.patronymic')}
                  name="patronymic"
                  value={formData.patronymic}
                  onChange={handleChange}
                />
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label={t('auth.region')}
                name="region"
                select
                value={formData.region}
                onChange={handleChange}
              >
                {(formData.region
                  ? Array.from(new Set([...UA_REGION_NAMES, formData.region]))
                  : UA_REGION_NAMES
                ).map((region) => (
                  <MenuItem key={region} value={region}>
                    {region}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label={t('auth.city')}
                name="city"
                select
                disabled={!formData.region}
                value={formData.city}
                onChange={handleChange}
              >
                {(formData.city
                  ? Array.from(new Set([...getCitiesByRegion(formData.region), formData.city]))
                  : getCitiesByRegion(formData.region)
                ).map((city) => (
                  <MenuItem key={city} value={city}>
                    {city}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label={t('auth.phone')}
                name="phone"
                value={formData.phone}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('auth.email')}
                name="email"
                value={formData.email || t('common.notAvailable')}
                disabled
                helperText={formData.email ? t('auth.emailCannotBeChanged') : t('common.notAvailable')}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                {t('auth.password')}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('auth.leaveBlankPassword')}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('auth.currentPassword')}
                name="currentPassword"
                type="password"
                value={formData.currentPassword}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('auth.newPassword')}
                name="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('auth.confirmPassword')}
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={saving}
              >
                {saving ? <CircularProgress size={24} /> : t('common.save')}
              </Button>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                {t('profile.settings', 'Налаштування')}
              </Typography>
            </Grid>

            {settingsError ? (
              <Grid item xs={12}>
                <Alert severity="error">{settingsError}</Alert>
              </Grid>
            ) : null}

            {settingsLoading ? (
              <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={24} />
              </Grid>
            ) : (
              <>
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {t('profile.notifications', 'Сповіщення')}
                    </Typography>

                    {notificationPermission !== 'granted' ? (
                      <Alert
                        severity={notificationPermission === 'denied' ? 'warning' : 'info'}
                        sx={{ mb: 2 }}
                        action={
                          notificationPermission === 'unsupported' ? null : (
                            <Button size="small" color="inherit" onClick={requestNotificationPermission}>
                              {t('reminders.enableNotifications', 'Увімкнути сповіщення')}
                            </Button>
                          )
                        }
                      >
                        {notificationPermission === 'unsupported'
                          ? t('reminders.notificationsUnsupported', 'Цей браузер не підтримує push-сповіщення.')
                          : notificationPermission === 'denied'
                            ? t('reminders.notificationsDenied', 'Сповіщення вимкнені в налаштуваннях браузера.')
                            : t('reminders.notificationsDefault', 'Дозвольте сповіщення, щоб отримувати нагадування.')}
                      </Alert>
                    ) : null}

                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!mergedSettings.notifications.enabled}
                          onChange={(_, checked) =>
                            saveSettings({
                              ...mergedSettings,
                              notifications: { ...mergedSettings.notifications, enabled: checked }
                            })
                          }
                          disabled={settingsSaving}
                        />
                      }
                      label={t('profile.notificationsEnabled', 'Увімкнути сповіщення (налаштування акаунту)')}
                    />

                    <Box sx={{ pl: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!!mergedSettings.notifications.reminders}
                            onChange={(_, checked) =>
                              saveSettings({
                                ...mergedSettings,
                                notifications: { ...mergedSettings.notifications, reminders: checked }
                              })
                            }
                            disabled={settingsSaving}
                          />
                        }
                        label={t('profile.notifyReminders', 'Нагадування')}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!!mergedSettings.notifications.appointments}
                            onChange={(_, checked) =>
                              saveSettings({
                                ...mergedSettings,
                                notifications: { ...mergedSettings.notifications, appointments: checked }
                              })
                            }
                            disabled={settingsSaving}
                          />
                        }
                        label={t('profile.notifyAppointments', 'Записи')}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!!mergedSettings.notifications.chat}
                            onChange={(_, checked) =>
                              saveSettings({
                                ...mergedSettings,
                                notifications: { ...mergedSettings.notifications, chat: checked }
                              })
                            }
                            disabled={settingsSaving}
                          />
                        }
                        label={t('profile.notifyChat', 'Чат')}
                      />
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {webPushSupported ? (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          {t('profile.webPushTitle', 'Push-сповіщення (PWA)')}
                        </Typography>

                        {notificationPermission === 'denied' ? (
                          <Alert severity="warning" sx={{ mb: 2 }}>
                            {t(
                              'reminders.notificationsDenied',
                              'Сповіщення вимкнені в налаштуваннях браузера.'
                            )}
                          </Alert>
                        ) : null}

                        {webPushError ? (
                          <Alert severity="error" sx={{ mb: 2 }}>
                            {webPushError}
                          </Alert>
                        ) : null}

                        <Alert severity={webPushEndpoint ? 'success' : 'info'} sx={{ mb: 2 }}>
                          {webPushEndpoint
                            ? t('profile.webPushEnabled', 'Push увімкнено на цьому пристрої.')
                            : t('profile.webPushDisabled', 'Push вимкнено. Увімкніть, щоб отримувати сповіщення у фоні.')}
                        </Alert>

                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Button
                            variant="contained"
                            onClick={enableWebPush}
                            disabled={webPushLoading || !!webPushEndpoint || notificationPermission === 'denied'}
                          >
                            {t('profile.webPushEnable', 'Увімкнути push')}
                          </Button>
                          <Button
                            variant="outlined"
                            color="warning"
                            onClick={disableWebPush}
                            disabled={webPushLoading || !webPushEndpoint}
                          >
                            {t('profile.webPushDisable', 'Вимкнути push')}
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={testWebPush}
                            disabled={webPushLoading || !webPushEndpoint}
                          >
                            {t('profile.webPushTest', 'Тест push')}
                          </Button>
                        </Box>
                      </Box>
                    ) : (
                      <Alert severity="warning">
                        {t('profile.webPushUnsupported', 'Web Push не підтримується у цьому браузері/режимі.')}
                      </Alert>
                    )}
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {t('profile.integrations', 'Інтеграції')}
                    </Typography>

                    <Alert
                      severity="info"
                      sx={{ mb: 2 }}
                      action={
                        <Button
                          size="small"
                          color="inherit"
                          component="a"
                          href="https://t.me/sanya_sto_bot"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t('profile.openTelegramBot', 'Відкрити бота')}
                        </Button>
                      }
                    >
                      {t(
                        'profile.telegramConnectHelp',
                        'Підключення Telegram виконується через бота @sanya_sto_bot. У боті реєстрація/вхід через номер телефону. Після прив\'язки увімкніть Telegram тут.'
                      )}
                    </Alert>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!mergedSettings.integrations.telegramEnabled}
                          onChange={(_, checked) =>
                            saveSettings({
                              ...mergedSettings,
                              integrations: { ...mergedSettings.integrations, telegramEnabled: checked }
                            })
                          }
                          disabled={settingsSaving}
                        />
                      }
                      label={t('profile.telegramEnabled', 'Telegram')}
                    />

                    <TextField
                      fullWidth
                      label={t('profile.telegramUsername', 'Telegram username')}
                      value={mergedSettings.integrations.telegramUsername}
                      onChange={(e) =>
                        saveSettings({
                          ...mergedSettings,
                          integrations: {
                            ...mergedSettings.integrations,
                            telegramUsername: e.target.value
                          }
                        })
                      }
                      disabled={settingsSaving}
                      sx={{ mb: 0 }}
                    />
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {t('profile.appearance', 'Зовнішній вигляд')}
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!mergedSettings.appearance.darkMode}
                          onChange={(_, checked) =>
                            saveSettings({
                              ...mergedSettings,
                              appearance: { ...mergedSettings.appearance, darkMode: checked }
                            })
                          }
                          disabled={settingsSaving}
                        />
                      }
                      label={t('profile.darkMode', 'Темна тема (налаштування акаунту)')}
                    />

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle1" gutterBottom>
                      {t('profile.language', 'Мова')}
                    </Typography>
                    <TextField
                      select
                      fullWidth
                      label={t('profile.language', 'Мова')}
                      value={mergedSettings.locale.language || ''}
                      onChange={(e) =>
                        saveSettings({
                          ...mergedSettings,
                          locale: {
                            ...mergedSettings.locale,
                            language: e.target.value
                          }
                        })
                      }
                      disabled={settingsSaving}
                    >
                      <MenuItem value="">{t('profile.languageAuto', 'Автоматично')}</MenuItem>
                      <MenuItem value="uk">Українська</MenuItem>
                      <MenuItem value="ru">Русский</MenuItem>
                      <MenuItem value="en">English</MenuItem>
                    </TextField>
                  </Paper>
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                {t('profile.security', 'Безпека')}
              </Typography>
              <TwoFactorAuth />
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
};

export default Profile;
