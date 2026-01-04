import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

const LanguageSwitcher = () => {
  const { t } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language);

  const switchLanguage = async (lang) => {
    try {
      console.log('Спроба перемикання мови на:', lang);
      
      // Зберігаємо вибрану мову в AsyncStorage
      await AsyncStorage.setItem('userLanguage', lang);
      
      // Змінюємо мову в i18n
      await i18n.changeLanguage(lang);
      
      // Оновлюємо стан компонента
      setCurrentLang(lang);
      
      console.log('Мова успішно змінена на:', lang);
      console.log('Поточна мова i18n:', i18n.language);
      
      // Показуємо повідомлення про успішну зміну мови
      Alert.alert(
        'Мову змінено',
        `Мову додатку змінено на: ${lang === 'uk' ? 'українську' : lang === 'ru' ? 'російську' : 'англійську'}`,
        [{ text: 'OK' }]
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
          <Text style={styles.buttonText}>Українська</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, currentLang === 'ru' && styles.activeButton]}
          onPress={() => switchLanguage('ru')}
        >
          <Text style={styles.buttonText}>Русский</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, currentLang === 'en' && styles.activeButton]}
          onPress={() => switchLanguage('en')}
        >
          <Text style={styles.buttonText}>English</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.testSection}>
        <Text style={styles.testTitle}>Тестові переклади:</Text>
        <Text>app.name: {t('app.name')}</Text>
        <Text>common.loading: {t('common.loading')}</Text>
        <Text>auth.login: {t('auth.login')}</Text>
        <Text>navigation.dashboard: {t('navigation.dashboard')}</Text>
        <Text>vehicles.title: {t('vehicles.title')}</Text>
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
  testSection: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 5,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

export default LanguageSwitcher;
