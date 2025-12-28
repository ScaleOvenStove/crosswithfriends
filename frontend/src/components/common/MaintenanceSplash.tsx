import React from 'react';

const MaintenanceSplash: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#f8f9fa',
        color: '#333',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        padding: '20px',
      }}
    >
      <h1 style={{fontSize: '3rem', marginBottom: '1rem'}}>Maintenance in Progress</h1>
      <p style={{fontSize: '1.5rem', color: '#666'}}>
        We are currently performing scheduled maintenance. We will be back shortly.
      </p>
    </div>
  );
};

export default MaintenanceSplash;
