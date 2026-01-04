import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

/**
 * Простий компонент для перемикання мови додатку
 */
const LanguageToggle = () => {
  const { i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState('uk');
  
  // Завантажуємо збережену мову при монтуванні компонента
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('userLanguage');
        if (savedLang) {
          setCurrentLang(savedLang);
        } else {
          // Якщо мова не збережена, використовуємо поточну мову i18n
          setCurrentLang(i18n.language || 'uk');
        }
      } catch (error) {
        console.error('Помилка при завантаженні мови:', error);
      }
    };
    
    loadLanguage();
    
    // Відслідковуємо зміну мови
    setCurrentLang(i18n.language);
  }, [i18n.language]);
  
  // Функція для зміни мови
  const setLanguage = async (lang) => {
    try {
      // Зберігаємо вибрану мову
      await AsyncStorage.setItem('userLanguage', lang);
      
      // Змінюємо мову в i18n
      await i18n.changeLanguage(lang);
      
      // Оновлюємо стан компонента
      setCurrentLang(lang);
      
      // Показуємо повідомлення про успішну зміну мови
      Alert.alert(
        'Мову змінено',
        `Мову додатку змінено на: ${
          lang === 'uk' ? 'українську' : 
          lang === 'ru' ? 'російську' : 
          'англійську'
        }`,
        [
          { 
            text: 'OK',
            onPress: () => {
              // Перезавантажуємо додаток для застосування змін
              if (Platform.OS === 'web') {
                window.location.reload();
              } else {
                // Для мобільних платформ
                const { DevSettings } = require('react-native');
                if (DevSettings && DevSettings.reload) {
                  DevSettings.reload();
                }
              }
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
      <Text style={styles.title}>Виберіть мову / Choose language</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, currentLang === 'uk' && styles.activeButton]} 
          onPress={() => setLanguage('uk')}
        >
          <Text style={styles.buttonText}>Українська</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, currentLang === 'ru' && styles.activeButton]} 
          onPress={() => setLanguage('ru')}
        >
          <Text style={styles.buttonText}>Русский</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, currentLang === 'en' && styles.activeButton]} 
          onPress={() => setLanguage('en')}
        >
          <Text style={styles.buttonText}>English</Text>
        </TouchableOpacity>
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
    marginBottom: 15,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  },
});

export default LanguageToggle;
