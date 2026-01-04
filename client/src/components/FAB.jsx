import React, { useState } from 'react';
import { Fab, Menu, MenuItem, Tooltip, Zoom } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EventIcon from '@mui/icons-material/Event';
import BuildIcon from '@mui/icons-material/Build';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const FloatingActionButton = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (path) => {
    handleClose();
    navigate(path);
  };

  return (
    <>
      <Zoom in={true} timeout={300} unmountOnExit>
        <Tooltip title={t('fab.add')} placement="left">
          <Fab
            color="primary"
            aria-label={t('fab.add')}
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: 1000,
            }}
            onClick={handleClick}
          >
            <AddIcon />
          </Fab>
        </Tooltip>
      </Zoom>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => handleMenuItemClick('/vehicles/add')}>
          <DirectionsCarIcon sx={{ mr: 1 }} />
          {t('fab.addVehicle')}
        </MenuItem>
        <MenuItem onClick={() => handleMenuItemClick('/appointments/add')}>
          <EventIcon sx={{ mr: 1 }} />
          {t('fab.bookAppointment')}
        </MenuItem>
        <MenuItem onClick={() => handleMenuItemClick('/service-records/add')}>
          <BuildIcon sx={{ mr: 1 }} />
          {t('fab.addServiceRecord')}
        </MenuItem>
      </Menu>
    </>
  );
};

export default FloatingActionButton;
