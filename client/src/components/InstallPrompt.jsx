import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Snackbar, Typography } from '@mui/material';

const isIos = () => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua);
};

const isInStandaloneMode = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
};

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [open, setOpen] = useState(false);

  const ios = useMemo(() => isIos(), []);
  const standalone = useMemo(() => isInStandaloneMode(), []);

  useEffect(() => {
    if (standalone) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setOpen(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [standalone]);

  useEffect(() => {
    if (standalone) return;
    if (!ios) return;

    const key = 'pwa_install_prompt_dismissed_v1';
    const dismissed = window.localStorage.getItem(key) === '1';
    if (!dismissed) setOpen(true);
  }, [ios, standalone]);

  const handleClose = () => {
    setOpen(false);
    if (ios) {
      try {
        window.localStorage.setItem('pwa_install_prompt_dismissed_v1', '1');
      } catch (_) {
        void _;
      }
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
      setOpen(false);
    }
  };

  if (standalone) return null;

  const showAndroid = !!deferredPrompt;
  const showIos = ios && !deferredPrompt;

  if (!showAndroid && !showIos) return null;

  return (
    <Snackbar
      open={open}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      autoHideDuration={showAndroid ? 12000 : null}
    >
      <Alert
        severity="info"
        onClose={handleClose}
        sx={{ width: '100%', alignItems: 'center' }}
        action={
          showAndroid ? (
            <Button color="inherit" size="small" onClick={handleInstallClick}>
              Встановити
            </Button>
          ) : null
        }
      >
        {showAndroid ? (
          'Встановіть додаток Автосервіс на телефон для швидкого доступу.'
        ) : (
          <Box>
            <Typography variant="body2">
              Додайте сайт на екран «Додому»: Поділитися → «На екран «Додому»».
            </Typography>
          </Box>
        )}
      </Alert>
    </Snackbar>
  );
};

export default InstallPrompt;
