import React from 'react';

export const AccountError: React.FC = () => {
  return (
    <div
      style={{
        padding: '40px',
        textAlign: 'center',
        color: '#d32f2f',
      }}
    >
      <h2>Account Error</h2>
      <p style={{margin: '20px 0'}}>Something went wrong while loading your account.</p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 20px',
          marginTop: '10px',
          backgroundColor: '#6aa9f4',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Reload Page
      </button>
    </div>
  );
};

