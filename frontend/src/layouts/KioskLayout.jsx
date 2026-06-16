import React from 'react';
import { Outlet } from 'react-router-dom';

const KioskLayout = () => {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#000' }}>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default KioskLayout;
