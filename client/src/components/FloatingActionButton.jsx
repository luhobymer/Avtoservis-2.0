import React, { useState } from 'react';
import { Fab, Zoom, useTheme, SpeedDial, SpeedDialIcon, SpeedDialAction } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EventIcon from '@mui/icons-material/Event';

/**
 * Універсальний компонент Floating Action Button (FAB)
 * Підтримує режими: 'single' - одна кнопка з дією, 'speed-dial' - кнопка з випадаючим меню дій
 * 
 * @param {Object} props - Властивості компонента
 * @param {string} props.mode - Режим відображення: 'single' або 'speed-dial'
 * @param {Function} props.onClick - Функція, яка викликається при натисканні на кнопку (для режиму 'single')
 * @param {Object} props.icon - Іконка для кнопки (для режиму 'single')
 * @param {Array} props.actions - Масив дій для режиму 'speed-dial' у форматі [{icon, name, key, onClick}]
 * @param {string} props.color - Колір кнопки (primary, secondary, error, тощо)
 * @param {string} props.position - Позиція кнопки на екрані ('bottom-right', 'bottom-left', 'top-right', 'top-left')
 * @param {boolean} props.extended - Чи відображати розширену версію кнопки з текстом (тільки для режиму 'single')
 * @param {string} props.label - Текст для розширеної версії кнопки (тільки для режиму 'single' і extended=true)
 */
const FloatingActionButton = ({
  mode = 'single',
  onClick,
  icon = <AddIcon />,
  actions = [],
  color = 'primary',
  position = 'bottom-right',
  extended = false,
  label = '',
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Визначення стилів позиціонування
  const getPositionStyle = () => {
    switch (position) {
      case 'bottom-right':
        return { position: 'fixed', bottom: 16, right: 16 };
      case 'bottom-left':
        return { position: 'fixed', bottom: 16, left: 16 };
      case 'top-right':
        return { position: 'fixed', top: 16, right: 16 };
      case 'top-left':
        return { position: 'fixed', top: 16, left: 16 };
      default:
        return { position: 'fixed', bottom: 16, right: 16 };
    }
  };

  // Обробники подій для SpeedDial
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  // Стандартні дії для SpeedDial, якщо не передані
  const defaultActions = [
    { 
      icon: <DirectionsCarIcon />, 
      name: t('fab.addVehicle'), 
      key: 'add-vehicle',
      onClick: () => console.log('Add vehicle clicked') 
    },
    { 
      icon: <EventIcon />, 
      name: t('fab.newAppointment'), 
      key: 'new-appointment',
      onClick: () => console.log('New appointment clicked') 
    },
    { 
      icon: <HistoryIcon />, 
      name: t('fab.serviceHistory'), 
      key: 'service-history',
      onClick: () => console.log('Service history clicked') 
    },
    { 
      icon: <EditIcon />, 
      name: t('fab.editProfile'), 
      key: 'edit-profile',
      onClick: () => console.log('Edit profile clicked') 
    },
  ];

  // Використовуємо передані дії або стандартні
  const actionsToUse = actions.length > 0 ? actions : defaultActions;

  return (
    <Zoom in={true} style={getPositionStyle()}>
      {mode === 'single' ? (
        <Fab
          color={color}
          aria-label={label || t('fab.action')}
          onClick={onClick}
          variant={extended ? 'extended' : 'circular'}
          sx={{
            boxShadow: theme.shadows[8],
            '&:hover': {
              boxShadow: theme.shadows[12],
            },
          }}
        >
          {icon}
          {extended && label && <span style={{ marginLeft: 8 }}>{label}</span>}
        </Fab>
      ) : (
        <SpeedDial
          ariaLabel={t('fab.speedDial')}
          icon={<SpeedDialIcon />}
          onClose={handleClose}
          onOpen={handleOpen}
          open={open}
          direction="up"
          FabProps={{
            color: color,
            sx: {
              boxShadow: theme.shadows[8],
              '&:hover': {
                boxShadow: theme.shadows[12],
              },
            }
          }}
        >
          {actionsToUse.map((action) => (
            <SpeedDialAction
              key={action.key || action.name}
              icon={action.icon}
              tooltipTitle={action.name}
              tooltipOpen
              onClick={() => {
                action.onClick();
                handleClose();
              }}
            />
          ))}
        </SpeedDial>
      )}
    </Zoom>
  );
};

export default FloatingActionButton;
