import React, { useState } from 'react';
import { 
  StyleSheet, 
  TouchableOpacity, 
  View, 
  Text, 
  Animated, 
  Modal, 
  TouchableWithoutFeedback 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

/**
 * Компонент плаваючої кнопки дій (FAB) з можливістю відображення меню
 * @param {Object} props - Властивості компонента
 * @param {Function} props.onPress - Функція, яка викликається при натисканні
 * @param {string} props.icon - Назва іконки з бібліотеки Ionicons
 * @param {Object} props.style - Додаткові стилі для кнопки
 * @param {string} props.color - Колір кнопки
 * @param {number} props.size - Розмір іконки
 * @param {string} props.position - Позиція кнопки (bottomRight, bottomLeft, topRight, topLeft)
 * @param {Array} props.actions - Масив дій для меню (кожна дія має icon, label, onPress, color)
 * @param {string} props.label - Текст, який відображається поруч з кнопкою
 */
const FloatingActionButton = ({ 
  onPress, 
  icon = 'add', 
  style, 
  color = '#1976d2', 
  size = 24,
  position = 'bottomRight',
  actions = [],
  label = ''
}) => {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);
  const [animation] = useState(new Animated.Value(0));
  
  const getPositionStyle = () => {
    switch (position) {
      case 'bottomRight':
        return styles.bottomRight;
      case 'bottomLeft':
        return styles.bottomLeft;
      case 'topRight':
        return styles.topRight;
      case 'topLeft':
        return styles.topLeft;
      default:
        return styles.bottomRight;
    }
  };

  const toggleMenu = () => {
    if (actions && actions.length > 0) {
      setMenuVisible(!menuVisible);
      Animated.timing(animation, {
        toValue: menuVisible ? 0 : 1,
        duration: 300,
        useNativeDriver: true
      }).start();
    } else if (onPress) {
      onPress();
    }
  };

  const handleActionPress = (actionOnPress) => {
    setMenuVisible(false);
    animation.setValue(0);
    if (actionOnPress) {
      actionOnPress();
    }
  };

  const renderActions = () => {
    const positionStyle = getPositionStyle();
    const isRight = position.includes('Right');
    const isBottom = position.includes('bottom');
    
    return (
      <Modal
        transparent
        visible={menuVisible}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View 
              style={[
                styles.actionsContainer, 
                positionStyle,
                isBottom ? { bottom: 80 } : { top: 80 },
                isRight ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }
              ]}
            >
              {actions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.actionButton,
                    { backgroundColor: action.color || '#ffffff' }
                  ]}
                  onPress={() => handleActionPress(action.onPress)}
                >
                  <Ionicons name={action.icon} size={20} color="#fff" />
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  const rotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg']
  });

  return (
    <>
      {actions && actions.length > 0 && renderActions()}
      <View style={[getPositionStyle(), styles.fabContainer]}>
        {label ? (
          <View style={styles.labelContainer}>
            <Text style={styles.label}>{label}</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: color }, style]}
          onPress={toggleMenu}
          activeOpacity={0.8}
          accessibilityLabel={label || t('common.add')}
        >
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name={icon} size={size} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 999,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  bottomRight: {
    bottom: 20,
    right: 20,
  },
  bottomLeft: {
    bottom: 20,
    left: 20,
  },
  topRight: {
    top: 20,
    right: 20,
  },
  topLeft: {
    top: 20,
    left: 20,
  },
  labelContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  label: {
    color: '#fff',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  actionsContainer: {
    position: 'absolute',
    padding: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginVertical: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  actionLabel: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default FloatingActionButton;
