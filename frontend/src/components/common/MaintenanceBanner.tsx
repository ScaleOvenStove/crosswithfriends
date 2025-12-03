import React from 'react';

const MaintenanceBanner: React.FC = () => {
  const isActive = import.meta.env.VITE_MAINTENANCE_BANNER_ACTIVE === 'true';
  const message = import.meta.env.VITE_MAINTENANCE_BANNER_MESSAGE || 'Site is under maintenance';

  if (!isActive) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: '#ff9800',
        color: '#fff',
        padding: '10px',
        textAlign: 'center',
        fontWeight: 'bold',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 9999,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}
    >
      {message}
    </div>
  );
};

export default MaintenanceBanner;
