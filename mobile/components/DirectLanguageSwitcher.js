import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import i18n, { changeLanguage } from '../i18n';

/**
 * Компонент для прямої зміни мови без перезавантаження
 * @returns {JSX.Element}
 */
const DirectLanguageSwitcher = () => {
  const { t } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language || 'uk');
  
  // Відслідковуємо зміну мови
  useEffect(() => {
    // Оновлюємо стан при зміні мови
    const handleLanguageChanged = (lng) => {
      setCurrentLang(lng);
    };
    
    // Додаємо обробник події зміни мови
    i18n.on('languageChanged', handleLanguageChanged);
    
    // Видаляємо обробник при розмонтуванні
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);
  
  // Функція для зміни мови
  const switchLanguage = async (lang) => {
    try {
      if (lang === currentLang) {
        console.log('Мова вже встановлена на:', lang);
        return;
      }
      
      // Використовуємо функцію зміни мови з нового файлу i18n.final.js
      const success = await changeLanguage(lang);
      
      if (success) {
        // Оновлюємо стан компонента
        setCurrentLang(lang);
        
        // Показуємо повідомлення про успішну зміну мови
        let message = '';
        switch (lang) {
          case 'uk':
            message = 'Мова змінена на українську';
            break;
          case 'ru':
            message = 'Язык изменен на русский';
            break;
          case 'en':
            message = 'Language changed to English';
            break;
          default:
            message = 'Мова змінена';
        }
        
        Alert.alert('', message);
        
        console.log('Мова змінена на:', lang);
      }
    } catch (error) {
      console.error('Помилка при зміні мови:', error);
      Alert.alert('Помилка', 'Не вдалося змінити мову');
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile.language')}:</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, currentLang === 'uk' && styles.activeButton]}
          onPress={() => switchLanguage('uk')}
        >
          <Text style={[styles.buttonText, currentLang === 'uk' && styles.activeButtonText]}>Українська</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, currentLang === 'ru' && styles.activeButton]}
          onPress={() => switchLanguage('ru')}
        >
          <Text style={[styles.buttonText, currentLang === 'ru' && styles.activeButtonText]}>Русский</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, currentLang === 'en' && styles.activeButton]}
          onPress={() => switchLanguage('en')}
        >
          <Text style={[styles.buttonText, currentLang === 'en' && styles.activeButtonText]}>English</Text>
        </TouchableOpacity>
      </View>
      
      {/* Тестовий блок для перевірки перекладів */}
      <View style={styles.testBlock}>
        <Text style={styles.testTitle}>Тест перекладів:</Text>
        <Text>app.name: {t('app.name')}</Text>
        <Text>common.loading: {t('common.loading')}</Text>
        <Text>navigation.dashboard: {t('navigation.dashboard')}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f7',
    borderRadius: 10,
    padding: 15,
    margin: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  button: {
    flex: 1,
    backgroundColor: '#e0e0e0',
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#c62828',
  },
  buttonText: {
    fontWeight: 'bold',
    color: '#333',
  },
  activeButtonText: {
    color: '#fff',
  },
  testBlock: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  testTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
});

export default DirectLanguageSwitcher;
