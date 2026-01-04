import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonGroup, Tooltip } from '@mui/material';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <ButtonGroup size="small" aria-label="language switcher">
      <Tooltip title="Українська">
        <Button 
          onClick={() => changeLanguage('uk')} 
          variant={i18n.language === 'uk' ? 'contained' : 'outlined'}
        >
          UA
        </Button>
      </Tooltip>
      <Tooltip title="Русский">
        <Button 
          onClick={() => changeLanguage('ru')} 
          variant={i18n.language === 'ru' ? 'contained' : 'outlined'}
        >
          RU
        </Button>
      </Tooltip>
      <Tooltip title="English">
        <Button 
          onClick={() => changeLanguage('en')} 
          variant={i18n.language === 'en' ? 'contained' : 'outlined'}
        >
          EN
        </Button>
      </Tooltip>
    </ButtonGroup>
  );
};

export default LanguageSwitcher;