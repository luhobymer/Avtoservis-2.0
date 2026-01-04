import React, { createContext, useContext, useState, useEffect } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

// Створюємо контекст для локалізації
export const LocalizationContext = createContext({
  language: 'uk',
  setLanguage: () => {},
  t: (key) => key,
});

// Компонент-провайдер для локалізації
export const LocalizationProvider = ({ children }) => {
  const [language, setLanguage] = useState('uk');

  // Завантажуємо збережену мову при першому рендері
  useEffect(() => {
    const loadSavedLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('userLanguage');
        if (savedLang && ['uk', 'ru', 'en'].includes(savedLang)) {
          setLanguage(savedLang);
          await i18n.changeLanguage(savedLang);
          console.log('Завантажена збережена мова:', savedLang);
        }
      } catch (error) {
        console.error('Помилка при завантаженні мови:', error);
      }
    };

    loadSavedLanguage();
  }, []);

  // Функція для зміни мови
  const changeLanguage = async (newLanguage) => {
    if (!['uk', 'ru', 'en'].includes(newLanguage)) {
      console.error('Непідтримувана мова:', newLanguage);
      return false;
    }

    try {
      // Зберігаємо вибрану мову
      await AsyncStorage.setItem('userLanguage', newLanguage);
      
      // Змінюємо мову в i18n
      await i18n.changeLanguage(newLanguage);
      
      // Оновлюємо стан
      setLanguage(newLanguage);
      
      console.log('Мова змінена на:', newLanguage);
      console.log('Поточна мова i18n:', i18n.language);
      
      return true;
    } catch (error) {
      console.error('Помилка при зміні мови:', error);
      return false;
    }
  };

  // Значення контексту
  const contextValue = {
    language,
    setLanguage: changeLanguage,
    t: (key, options) => i18n.t(key, options),
  };

  return (
    <LocalizationContext.Provider value={contextValue}>
      <I18nextProvider i18n={i18n}>
        {children}
      </I18nextProvider>
    </LocalizationContext.Provider>
  );
};

// Хук для використання локалізації
export const useLocalization = () => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};

// Компонент для примусового оновлення перекладів
export const TranslationUpdater = ({ children }) => {
  const { i18n } = useTranslation();
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const handleLanguageChanged = (lng) => {
      console.log('Мова змінена на:', lng);
      forceUpdate(prev => prev + 1);
    };

    // Додаємо обробник події зміни мови
    i18n.on('languageChanged', handleLanguageChanged);

    // Видаляємо обробник при розмонтуванні
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  return <>{children}</>;
};

export default LocalizationProvider;
