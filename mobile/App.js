import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthContext';
import { LocalizationProvider, TranslationUpdater } from './components/TranslationProvider';
import AppNavigator from './navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <LocalizationProvider>
        <TranslationUpdater>
          <AuthProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </AuthProvider>
        </TranslationUpdater>
      </LocalizationProvider>
    </SafeAreaProvider>
  );
}
