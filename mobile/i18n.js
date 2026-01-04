import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Завантажуємо файли локалізації
import uk from './locales/uk/translation.json';
import ukAdmin from './locales/uk/admin.json';

// Функція для завантаження збереженої мови
const loadSavedLanguage = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem('userLanguage');
    console.log('Збережена мова:', savedLanguage);
    
    if (savedLanguage && ['uk'].includes(savedLanguage)) {
      return savedLanguage;
    }
    
    // Якщо збереженої мови немає, використовуємо мову пристрою
    const deviceLang = Localization.locale.split('-')[0];
    console.log('Мова пристрою:', deviceLang);
    
    // Перевіряємо, чи підтримується мова пристрою
    if (['uk'].includes(deviceLang)) {
      return deviceLang;
    }
    
    // За замовчуванням використовуємо українську
    return 'uk';
  } catch (error) {
    console.error('Помилка при завантаженні мови:', error);
    return 'uk';
  }
};

// Ініціалізуємо i18n з базовими налаштуваннями
const initI18n = async () => {
  const language = await loadSavedLanguage();
  
  console.log('Ініціалізація i18n з мовою:', language);
  console.log('Перевірка перекладів:', {
    uk: Object.keys(uk).length
  });
  
  i18n
    .use(initReactI18next)
    .init({
      compatibilityJSON: 'v3',
      lng: language,
      fallbackLng: 'uk',
      resources: {
        uk: { translation: uk, admin: ukAdmin },
      },
      ns: ['translation', 'admin'],
      defaultNS: 'translation',
      debug: false,
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
        bindI18n: 'languageChanged',
        bindI18nStore: 'added removed',
      },
      // Додаємо обробник відсутніх ключів
      missingKeyHandler: (lng, ns, key, fallbackValue) => {
        console.warn(`Відсутній ключ локалізації: ${key} для мови ${lng} в просторі імен ${ns}`);
      }
    });
  
  return i18n;
};

// Ініціалізуємо i18n синхронно
initI18n();

// Функція для зміни мови
export const changeLanguage = async (language) => {
  try {
    if (!['uk'].includes(language)) {
      console.error('Непідтримувана мова:', language);
      return false;
    }
    
    console.log('Зміна мови на:', language);
    
    // Зберігаємо вибрану мову
    await AsyncStorage.setItem('userLanguage', language);
    
    // Змінюємо мову
    await i18n.changeLanguage(language);
    
    console.log('Поточна мова після зміни:', i18n.language);
    
    // Перевіряємо, чи змінилась мова
    if (i18n.language !== language) {
      console.warn('Мова не змінилась, примусово встановлюємо');
      i18n.language = language;
      
      // Примусово оновлюємо ресурси
      i18n.services.resourceStore.data = {
        uk: { translation: uk, admin: ukAdmin },
      };
      
      // Викликаємо подію зміни мови
      i18n.emit('languageChanged', language);
    }
    
    return true;
  } catch (error) {
    console.error('Помилка при зміні мови:', error);
    return false;
  }
};

// Функція для перезавантаження додатку при зміні мови
export const changeLanguageWithReload = async (language) => {
  try {
    // Зберігаємо вибрану мову
    await AsyncStorage.setItem('userLanguage', language);
    console.log('Мова збережена, перезавантаження додатку...');
    
    // Перезавантажуємо додаток
    if (Platform.OS === 'web') {
      window.location.reload();
    } else {
      // Для мобільних платформ потрібно імпортувати DevSettings
      const { DevSettings } = require('react-native');
      DevSettings.reload();
    }
    
    return true;
  } catch (error) {
    console.error('Помилка при зміні мови з перезавантаженням:', error);
    return false;
  }
};

export default i18n;
