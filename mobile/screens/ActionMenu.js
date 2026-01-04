import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

/**
 * Компонент меню дій, який відображається при натисканні на FAB
 */
const ActionMenu = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { actions = [] } = route.params || {};
  const [animation] = React.useState(new Animated.Value(0));
  
  // Анімація появи меню
  React.useEffect(() => {
    Animated.timing(animation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);
  
  // Закриття меню з анімацією
  const closeMenu = (callback) => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      navigation.goBack();
      if (callback) {
        setTimeout(callback, 100);
      }
    });
  };
  
  // Анімовані стилі
  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });
  
  const menuTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });
  
  return (
    <Modal
      transparent
      animationType="none"
      visible={true}
      onRequestClose={() => closeMenu()}
    >
      <View style={styles.container}>
        <Animated.View 
          style={[
            styles.backdrop, 
            { opacity: backdropOpacity }
          ]} 
          onTouchEnd={() => closeMenu()}
        />
        
        <Animated.View 
          style={[
            styles.menuContainer,
            { transform: [{ translateY: menuTranslateY }] }
          ]}
        >
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>{t('common.actions')}</Text>
            <TouchableOpacity onPress={() => closeMenu()}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.menuItems}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={() => closeMenu(action.onPress)}
              >
                <Ionicons name={action.icon} size={24} color="#1976d2" />
                <Text style={styles.menuItemText}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    maxHeight: height * 0.7,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  menuItems: {
    padding: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 16,
    color: '#333',
  },
});

export default ActionMenu;
