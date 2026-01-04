import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getUserInteractions, updateInteractionStatus } from '../api/interactionService';
import FloatingActionButton from '../components/FloatingActionButton';

export default function InteractionsScreen({ navigation }) {
  const { t } = useTranslation();
  const { user, getToken } = useAuth();
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInteractions = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const data = await getUserInteractions(token);
      setInteractions(data);
    } catch (error) {
      console.error('[InteractionsScreen] Помилка при отриманні взаємодій:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchInteractions();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchInteractions();
    
    // Оновлюємо дані при фокусі на екрані
    const unsubscribe = navigation.addListener('focus', fetchInteractions);
    return unsubscribe;
  }, [navigation]);

  const handleInteractionPress = async (interaction) => {
    // Позначаємо взаємодію як прочитану
    if (interaction.status === 'unread') {
      try {
        const token = await getToken();
        await updateInteractionStatus(interaction.id, 'read', token);
        
        // Оновлюємо локальний стан
        setInteractions(prevInteractions => 
          prevInteractions.map(item => 
            item.id === interaction.id ? { ...item, status: 'read' } : item
          )
        );
      } catch (error) {
        console.error('[InteractionsScreen] Помилка при оновленні статусу взаємодії:', error);
      }
    }

    // Переходимо до відповідного екрану в залежності від типу взаємодії
    if (interaction.related_entity === 'appointment') {
      navigation.navigate('AppointmentDetails', { appointmentId: interaction.related_entity_id });
    } else if (interaction.related_entity === 'service_record') {
      navigation.navigate('ServiceRecordDetails', { recordId: interaction.related_entity_id });
    } else if (interaction.related_entity === 'vehicle') {
      navigation.navigate('VehicleDetails', { vehicleId: interaction.related_entity_id });
    } else {
      // Якщо немає пов'язаної сутності, відкриваємо діалог
      navigation.navigate('ChatScreen', { 
        recipientId: interaction.sender_id,
        recipientName: interaction.sender_name,
        recipientRole: interaction.sender_role
      });
    }
  };

  const getInteractionIcon = (type) => {
    switch (type) {
      case 'notification':
        return 'notifications-outline';
      case 'service_update':
        return 'construct-outline';
      case 'appointment_update':
        return 'calendar-outline';
      case 'message':
        return 'chatbubble-outline';
      default:
        return 'information-circle-outline';
    }
  };

  const renderInteractionItem = ({ item }) => {
    const isUnread = item.status === 'unread';
    const date = new Date(item.created_at);
    
    return (
      <TouchableOpacity
        style={[styles.interactionItem, isUnread && styles.unreadItem]}
        onPress={() => handleInteractionPress(item)}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={getInteractionIcon(item.type)} size={24} color="#1976d2" />
          {isUnread && <View style={styles.unreadDot} />}
        </View>
        
        <View style={styles.interactionContent}>
          <View style={styles.interactionHeader}>
            <Text style={styles.senderName}>{item.sender_name}</Text>
            <Text style={styles.interactionTime}>
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          
          <Text style={[styles.interactionMessage, isUnread && styles.unreadText]} numberOfLines={2}>
            {item.message}
          </Text>
          
          {item.related_entity && (
            <View style={styles.relatedEntityTag}>
              <Text style={styles.relatedEntityText}>
                {t(`interactions.entities.${item.related_entity}`)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>{t('interactions.no_interactions')}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={interactions}
        renderItem={renderInteractionItem}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#1976d2']}
            tintColor={'#1976d2'}
          />
        }
        ListEmptyComponent={!loading ? renderEmptyComponent : null}
        contentContainerStyle={interactions.length === 0 ? styles.emptyList : null}
      />
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      )}
      
      <FloatingActionButton 
        onPress={() => navigation.navigate('NewInteraction')}
        icon="chatbubble-outline"
        color="#4CAF50"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  interactionItem: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  unreadItem: {
    backgroundColor: '#f1f8e9',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f44336',
  },
  interactionContent: {
    flex: 1,
  },
  interactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  interactionTime: {
    fontSize: 12,
    color: '#757575',
  },
  interactionMessage: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  unreadText: {
    fontWeight: '500',
    color: '#333',
  },
  relatedEntityTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  relatedEntityText: {
    fontSize: 12,
    color: '#616161',
  },
});
