import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, TextInput, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import CustomButton from '../components/CustomButton';
import QRCode from 'react-native-qrcode-svg';

export default function TwoFactorSetupScreen({ navigation }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState(1); // 1: початок, 2: верифікація

  useEffect(() => {
    initiate2FASetup();
  }, []);

  const initiate2FASetup = async () => {
    setLoading(true);
    try {
      Alert.alert(t('common.error'), t('2fa.setup_error'));
      navigation.goBack();
    } catch (error) {
      console.error('Failed to initiate 2FA setup:', error);
      Alert.alert(t('common.error'), t('2fa.setup_error'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const verify2FASetup = async () => {
    if (!verificationCode.trim()) {
      Alert.alert(t('common.error'), t('2fa.enter_code'));
      return;
    }

    setLoading(true);
    try {
      Alert.alert(t('common.error'), t('2fa.verification_error'));
    } catch (error) {
      console.error('2FA verification failed:', error);
      Alert.alert(t('common.error'), t('2fa.verification_error'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('2fa.setup_title')}</Text>

        {step === 1 && setupData && (
          <>
            <Text style={styles.description}>{t('2fa.setup_description')}</Text>

            <View style={styles.qrContainer}>
              {setupData.qrCode ? (
                <Image source={{ uri: setupData.qrCode }} style={{ width: 200, height: 200 }} />
              ) : (
                <QRCode
                  value={setupData.otpAuthUrl}
                  size={200}
                  backgroundColor="white"
                  color="black"
                />
              )}
            </View>

            <View style={styles.secretContainer}>
              <Text style={styles.secretLabel}>{t('2fa.secret_key')}:</Text>
              <Text style={styles.secretValue}>{setupData.secret}</Text>
            </View>

            <CustomButton
              title={t('2fa.continue')}
              onPress={() => setStep(2)}
              style={styles.button}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.description}>{t('2fa.enter_code_description')}</Text>

            <TextInput
              style={styles.input}
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder={t('2fa.verification_code')}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <CustomButton
              title={t('2fa.verify')}
              onPress={verify2FASetup}
              style={styles.button}
            />

            <CustomButton
              title={t('common.back')}
              onPress={() => setStep(1)}
              style={styles.secondaryButton}
              textStyle={styles.secondaryButtonText}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f7',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 24,
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  secretContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  secretLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  secretValue: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 8,
  },
  button: {
    backgroundColor: '#1976d2',
    marginBottom: 10,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: '#666',
  },
});
