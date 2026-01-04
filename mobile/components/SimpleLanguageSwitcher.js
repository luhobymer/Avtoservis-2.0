import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Простий компонент для перемикання мови, який перезавантажує додаток
 * Не залежить від i18n, просто зберігає вибрану мову в AsyncStorage
 */
const SimpleLanguageSwitcher = () => {
  const [currentLang, setCurrentLang] = useState('uk');
  
  // Завантажуємо збережену мову при монтуванні компонента
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('userLanguage');
        if (savedLang) {
          setCurrentLang(savedLang);
        }
      } catch (error) {
        console.error('Помилка при завантаженні мови:', error);
      }
    };
    
    loadLanguage();
  }, []);
  
  // Функція для зміни мови з перезавантаженням додатку
  const changeLanguage = async (lang) => {
    try {
      if (lang === currentLang) {
        console.log('Мова вже встановлена на:', lang);
        return;
      }
      
      // Зберігаємо вибрану мову
      await AsyncStorage.setItem('userLanguage', lang);
      
      // Оновлюємо стан компонента
      setCurrentLang(lang);
      
      // Показуємо повідомлення про успішну зміну мови
      Alert.alert(
        'Зміна мови',
        `Для зміни мови на ${
          lang === 'uk' ? 'українську' : 
          lang === 'ru' ? 'російську' : 
          'англійську'
        } потрібно перезавантажити додаток`,
        [
          {
            text: 'Скасувати',
            style: 'cancel'
          },
          {
            text: 'Перезавантажити',
            onPress: () => {
              // Перезавантажуємо додаток
              if (Platform.OS === 'web') {
                window.location.reload();
              } else {
                try {
                  const { DevSettings } = require('react-native');
                  if (DevSettings && DevSettings.reload) {
                    DevSettings.reload();
                  }
                } catch (error) {
                  console.error('Помилка при перезавантаженні:', error);
                  Alert.alert(
                    'Помилка',
                    'Не вдалося перезавантажити додаток автоматично. Будь ласка, перезавантажте додаток вручну.'
                  );
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
          onPress={() => changeLanguage('uk')}
        >
          <Text style={[styles.buttonText, currentLang === 'uk' && styles.activeButtonText]}>Українська</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, currentLang === 'ru' && styles.activeButton]} 
          onPress={() => changeLanguage('ru')}
        >
          <Text style={[styles.buttonText, currentLang === 'ru' && styles.activeButtonText]}>Русский</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, currentLang === 'en' && styles.activeButton]} 
          onPress={() => changeLanguage('en')}
        >
          <Text style={[styles.buttonText, currentLang === 'en' && styles.activeButtonText]}>English</Text>
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
    color: '#333',
  },
  activeButtonText: {
    color: '#fff',
  },
});

export default SimpleLanguageSwitcher;
