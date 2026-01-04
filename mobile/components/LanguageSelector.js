import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { changeLanguage, changeLanguageWithReload } from '../i18n';

const LanguageSelector = () => {
  const [currentLang, setCurrentLang] = useState('');
  
  // Завантажуємо поточну мову при монтуванні компонента
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('userLanguage');
        setCurrentLang(savedLang || i18n.language || 'uk');
      } catch (error) {
        console.error('Помилка при завантаженні мови:', error);
      }
    };
    
    loadLanguage();
    
    // Підписуємося на зміну мови
    const handleLanguageChanged = (lng) => {
      console.log('Мова змінилася на:', lng);
      setCurrentLang(lng);
    };
    
    i18n.on('languageChanged', handleLanguageChanged);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);
  
  // Функція для зміни мови з перезавантаженням додатку
  const switchLanguage = async (lang) => {
    try {
      if (lang === currentLang) {
        console.log('Мова вже встановлена на:', lang);
        return;
      }
      
      // Запитуємо користувача про перезавантаження
      Alert.alert(
        'Зміна мови',
        'Для зміни мови потрібно перезавантажити додаток. Продовжити?',
        [
          {
            text: 'Скасувати',
            style: 'cancel'
          },
          {
            text: 'Змінити',
            onPress: async () => {
              await AsyncStorage.setItem('userLanguage', lang);
              
              // Показуємо повідомлення про успішну зміну
              Alert.alert(
                'Мову змінено',
                'Мову буде змінено після перезавантаження',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Перезавантажуємо додаток
                      if (Platform.OS === 'web') {
                        window.location.reload();
                      } else {
                        // Для мобільних платформ
                        const { DevSettings } = require('react-native');
                        DevSettings.reload();
                      }
                    }
                  }
                ]
              );
            }
          }
        ]
      );
    } catch (error) {
      console.error('Помилка при зміні мови:', error);
      Alert.alert('Помилка', 'Не вдалося змінити мову');
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Виберіть мову / Choose language:</Text>
      <Text style={styles.currentLang}>Поточна мова: {currentLang}</Text>
      
      <View style={styles.buttonsContainer}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f7',
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  currentLang: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#e0e0e0',
    padding: 10,
    borderRadius: 5,
    flex: 1,
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
});

export default LanguageSelector;
