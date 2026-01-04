import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { createInteraction, getEntityInteractions } from '../api/interactionService';

export default function ChatScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { user, getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const flatListRef = useRef(null);
  
  // Отримуємо параметри з маршруту
  const { 
    recipientId, 
    recipientName, 
    recipientRole,
    entityType,
    entityId 
  } = route.params || {};

  // Встановлюємо заголовок екрану
  useEffect(() => {
    if (recipientName) {
      navigation.setOptions({ title: recipientName });
    } else if (entityType && entityId) {
      navigation.setOptions({ 
        title: t(`interactions.chat_about`, { 
          entity: t(`interactions.entities.${entityType}`) 
        }) 
      });
    }
  }, [navigation, recipientName, entityType, entityId, t]);

  // Завантажуємо повідомлення
  const fetchMessages = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      let chatMessages = [];
      
      if (entityType && entityId) {
        // Отримуємо повідомлення для конкретної сутності
        chatMessages = await getEntityInteractions(entityType, entityId, token);
      } else {
        // Тестові дані для прямого чату
        chatMessages = [
          {
            id: 1,
            sender_id: user.id,
            sender_name: user.name || user.email,
            recipient_id: recipientId,
            recipient_name: recipientName,
            message: 'Доброго дня! Коли буде готовий мій автомобіль?',
            created_at: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: 2,
            sender_id: recipientId,
            sender_name: recipientName,
            recipient_id: user.id,
            recipient_name: user.name || user.email,
            message: 'Доброго дня! Ваш автомобіль буде готовий сьогодні до 18:00.',
            created_at: new Date(Date.now() - 3000000).toISOString()
          }
        ];
      }
      
      // Сортуємо повідомлення за датою
      chatMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      setMessages(chatMessages);
    } catch (error) {
      console.error('[ChatScreen] Помилка при отриманні повідомлень:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    
    // Оновлюємо повідомлення кожні 30 секунд
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  // Прокручуємо до останнього повідомлення при завантаженні або отриманні нових повідомлень
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      setSending(true);
      const token = await getToken();
      
      const messageData = {
        senderId: user.id,
        senderRole: user.role,
        senderName: user.name || user.email,
        recipientId: recipientId,
        recipientRole: recipientRole,
        recipientName: recipientName,
        message: newMessage.trim(),
        type: 'message',
        relatedEntity: entityType,
        relatedEntityId: entityId
      };
      
      // Додаємо повідомлення локально для миттєвого відображення
      const tempMessage = {
        id: `temp-${Date.now()}`,
        sender_id: user.id,
        sender_name: user.name || user.email,
        recipient_id: recipientId,
        recipient_name: recipientName,
        message: newMessage.trim(),
        created_at: new Date().toISOString(),
        sending: true
      };
      
      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      
      // Відправляємо повідомлення на сервер
      const result = await createInteraction(messageData, token);
      
      // Оновлюємо повідомлення з даними з сервера
      if (result) {
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id ? { ...result, sending: false } : msg
        ));
      }
      
      // Прокручуємо до останнього повідомлення
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    } catch (error) {
      console.error('[ChatScreen] Помилка при відправленні повідомлення:', error);
      
      // Позначаємо повідомлення як помилкове
      setMessages(prev => prev.map(msg => 
        msg.sending ? { ...msg, sending: false, error: true } : msg
      ));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isOwnMessage = item.sender_id === user.id;
    const messageDate = new Date(item.created_at);
    
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
      ]}>
        {!isOwnMessage && (
          <Text style={styles.senderName}>{item.sender_name}</Text>
        )}
        
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
          item.error && styles.errorMessageBubble
        ]}>
          <Text style={styles.messageText}>{item.message}</Text>
          <Text style={styles.messageTime}>
            {messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {item.sending && ' • ' + t('chat.sending')}
            {item.error && ' • ' + t('chat.error')}
          </Text>
        </View>
      </View>
    );
  };

  const renderDateSeparator = (date) => (
    <View style={styles.dateSeparator}>
      <View style={styles.dateLine} />
      <Text style={styles.dateText}>{date}</Text>
      <View style={styles.dateLine} />
    </View>
  );

  const getMessageList = () => {
    if (messages.length === 0) return [];
    
    const result = [];
    let currentDate = null;
    
    messages.forEach(message => {
      const messageDate = new Date(message.created_at);
      const dateString = messageDate.toLocaleDateString();
      
      if (dateString !== currentDate) {
        currentDate = dateString;
        result.push({ id: `date-${dateString}`, type: 'date', date: dateString });
      }
      
      result.push({ ...message, type: 'message' });
    });
    
    return result;
  };

  const renderItem = ({ item }) => {
    if (item.type === 'date') {
      return renderDateSeparator(item.date);
    }
    return renderMessage({ item });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={getMessageList()}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>{t('chat.no_messages')}</Text>
            </View>
          }
        />
      )}
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t('chat.message_placeholder')}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !newMessage.trim() && styles.disabledButton]}
          onPress={handleSendMessage}
          disabled={sending || !newMessage.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  },
  messagesList: {
    padding: 16,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    minWidth: 80,
  },
  ownMessageBubble: {
    backgroundColor: '#e3f2fd',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  errorMessageBubble: {
    backgroundColor: '#ffebee',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    color: '#757575',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dateText: {
    fontSize: 12,
    color: '#757575',
    marginHorizontal: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#bdbdbd',
  },
});
