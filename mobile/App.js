import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthContext';
import { LocalizationProvider, TranslationUpdater } from './components/TranslationProvider';
import ErrorBoundary from './components/ErrorBoundary';
import AppNavigator from './navigation/AppNavigator';
import { Provider as PaperProvider } from 'react-native-paper';

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider>
          <LocalizationProvider>
            <TranslationUpdater>
              <AuthProvider>
                <NavigationContainer>
                  <AppNavigator />
                </NavigationContainer>
              </AuthProvider>
            </TranslationUpdater>
          </LocalizationProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
